"use client";

import { ChevronLeft, Send, Settings2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Avatar, Button, Chip, EmptyState, Field, IconButton, Input, LinkButton, Sheet, Spinner, cn, useToast } from "@/components/ui";
import { DrawingCanvas, DrawingToolbar } from "@/components/couple/DrawingCanvas";
import { DEFAULT_TOOL, useBoardModel } from "@/components/couple/SketchSheet";
import { exportPng, sanitizeStrokes, type Pt, type Stroke, type Tool } from "@/components/couple/drawing";
import { insertMessage, notifyNewMessage } from "@/components/couple/lib";
import { useFamily } from "@/lib/family";
import { deleteMedia, uploadMedia } from "@/lib/media";
import { supabase } from "@/lib/supabase/client";
import type { Drawing } from "@/lib/types";

const FLUSH_MS = 40; // envoi des points pendant le tracé
const SAVE_MS = 1500; // sauvegarde différée des traits

type Peer = { key: string; name: string };

export default function DessinBoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { me, children, isParent, personById, nameOf } = useFamily();
  const { model, version } = useBoardModel();

  const [drawing, setDrawing] = useState<Drawing | null | undefined>(undefined);
  const [tool, setTool] = useState<Tool>(DEFAULT_TOOL);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [drawingBy, setDrawingBy] = useState<string | null>(null);
  const [options, setOptions] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pending = useRef(new Map<string, Pt[]>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsaved = useRef(new Set<string>());
  const dirtySave = useRef(false);
  const dirtyPreview = useRef(false);
  const activityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewPath = useRef<string | null>(null);

  // ------------------------------------------------------------ sauvegarde
  const saveNow = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!dirtySave.current) return;
    dirtySave.current = false;
    const sent = new Set(unsaved.current);
    const { error } = await supabase()
      .from("drawings")
      .update({ strokes: model.strokes, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) dirtySave.current = true;
    else sent.forEach((sid) => unsaved.current.delete(sid));
  }, [id, model]);

  const scheduleSave = useCallback(() => {
    dirtySave.current = true;
    dirtyPreview.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveNow(), SAVE_MS);
  }, [saveNow]);

  const savePreview = useCallback(async () => {
    if (!dirtyPreview.current) return previewPath.current;
    dirtyPreview.current = false;
    try {
      const blob = await exportPng(model.strokes, 720);
      const path = await uploadMedia("family", blob, "png", "dessins");
      const old = previewPath.current;
      previewPath.current = path;
      await supabase().from("drawings").update({ preview_path: path }).eq("id", id);
      if (old) deleteMedia(old).catch(() => {});
      return path;
    } catch {
      dirtyPreview.current = true;
      return previewPath.current;
    }
  }, [id, model]);

  // ------------------------------------------------------------ temps réel
  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  const flush = useCallback(() => {
    flushTimer.current = null;
    for (const [sid, pts] of pending.current) if (pts.length) send("points", { id: sid, points: pts });
    pending.current.clear();
  }, [send]);

  const markActivity = useCallback((by: string) => {
    setDrawingBy(by);
    if (activityTimer.current) clearTimeout(activityTimer.current);
    activityTimer.current = setTimeout(() => setDrawingBy(null), 1500);
  }, []);

  useEffect(() => {
    const sb = supabase();
    let alive = true;
    let ch: RealtimeChannel | null = null;

    (async () => {
      const { data } = await sb.from("drawings").select("*").eq("id", id).maybeSingle();
      if (!alive) return;
      const d = (data as Drawing | null) ?? null;
      setDrawing(d);
      if (!d) return;
      setTitleDraft(d.title);
      previewPath.current = d.preview_path;
      model.setStrokes(sanitizeStrokes(d.strokes));

      ch = sb.channel(`dessin-${id}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
      channelRef.current = ch;
      ch.on("broadcast", { event: "begin" }, ({ payload }) => {
        const s = payload?.stroke as Stroke | undefined;
        if (!s?.id) return;
        model.remote.set(s.id, { ...s, points: [...(s.points ?? [])] });
        model.emit();
        markActivity(s.by);
      })
        .on("broadcast", { event: "points" }, ({ payload }) => {
          const s = model.remote.get(payload?.id);
          if (!s || !Array.isArray(payload?.points)) return;
          s.points.push(...(payload.points as Pt[]));
          model.emit();
          markActivity(s.by);
        })
        .on("broadcast", { event: "end" }, ({ payload }) => {
          const s = payload?.stroke as Stroke | undefined;
          if (!s?.id) return;
          model.commit(s);
          unsaved.current.add(s.id);
          scheduleSave();
        })
        .on("broadcast", { event: "undo" }, ({ payload }) => {
          if (typeof payload?.id === "string") {
            model.remove(payload.id);
            scheduleSave();
          }
        })
        .on("broadcast", { event: "clear" }, () => {
          model.clear();
          scheduleSave();
        })
        .on("broadcast", { event: "sync" }, ({ payload }) => {
          if (payload?.to === me.id) model.merge(sanitizeStrokes(payload.strokes));
        })
        .on("presence", { event: "sync" }, () => {
          const state = ch!.presenceState<{ name: string }>();
          setPeers(
            Object.entries(state)
              .filter(([key]) => key !== me.id)
              .map(([key, metas]) => ({ key, name: metas[0]?.name ?? "Quelqu'un" })),
          );
        })
        .on("presence", { event: "join" }, ({ key }) => {
          if (key === me.id) return;
          // Le nouvel arrivant charge la base : on lui envoie les traits pas encore sauvegardés
          const extra = model.strokes.filter((s) => unsaved.current.has(s.id));
          if (extra.length) send("sync", { to: key, strokes: extra });
          void saveNow();
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          // Trait en cours d'un participant parti : on l'oublie
          let changed = false;
          for (const [sid, s] of model.remote) {
            if (s.by === key) {
              model.remote.delete(sid);
              changed = true;
            }
          }
          if (changed) model.emit();
        })
        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED") return;
          void ch?.track({ name: me.display_name });
          // Rattrape ce qui a pu être sauvegardé entre le chargement et l'abonnement
          const { data: fresh } = await sb.from("drawings").select("strokes").eq("id", id).maybeSingle();
          if (alive && fresh) model.merge(sanitizeStrokes(fresh.strokes));
        });
    })();

    return () => {
      alive = false;
      if (ch) sb.removeChannel(ch);
      channelRef.current = null;
    };
  }, [id, me.id, me.display_name, model, markActivity, scheduleSave, saveNow, send]);

  // Métadonnées modifiées par l'autre (titre, enfant) ou dessin supprimé
  useEffect(() => {
    const sb = supabase();
    const ch = sb
      .channel(`dessin-meta-${id}-${me.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drawings", filter: `id=eq.${id}` }, (p) => {
        const d = p.new as Drawing;
        previewPath.current = d.preview_path;
        setDrawing((cur) => (cur ? { ...cur, title: d.title, person_id: d.person_id, preview_path: d.preview_path } : cur));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "drawings", filter: `id=eq.${id}` }, () => {
        setDrawing(null);
      })
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [id, me.id]);

  // Sauvegarde en quittant la page / l'app
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void saveNow();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void saveNow();
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (activityTimer.current) clearTimeout(activityTimer.current);
    };
  }, [saveNow]);

  // ------------------------------------------------------------ tracé local
  const onBegin = useCallback(
    (s: Stroke) => {
      send("begin", { stroke: s });
    },
    [send],
  );
  const onPoints = useCallback(
    (sid: string, pts: Pt[]) => {
      const list = pending.current.get(sid) ?? [];
      list.push(...pts);
      pending.current.set(sid, list);
      if (!flushTimer.current) flushTimer.current = setTimeout(flush, FLUSH_MS);
    },
    [flush],
  );
  const onEnd = useCallback(
    (s: Stroke) => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      pending.current.delete(s.id);
      flushTimer.current = null;
      send("end", { stroke: s });
      unsaved.current.add(s.id);
      scheduleSave();
    },
    [send, scheduleSave],
  );

  function undo() {
    const last = model.lastBy(me.id);
    if (!last) return;
    model.remove(last.id);
    send("undo", { id: last.id });
    scheduleSave();
  }

  function clearAll() {
    model.clear();
    send("clear", {});
    scheduleSave();
    setConfirmClear(false);
  }

  async function goBack() {
    setLeaving(true);
    await saveNow();
    if (model.strokes.length) await savePreview();
    router.push("/dessin");
  }

  async function sendToChat() {
    if (!model.strokes.length) return;
    setSending(true);
    try {
      await saveNow();
      const blob = await exportPng(model.strokes, 1080);
      const path = await uploadMedia("couple", blob, "png");
      await insertMessage(me.id, { kind: "drawing", media_path: path, meta: { drawing_id: id } });
      notifyNewMessage(me.display_name, "drawing");
      toast("🎨 Envoyé dans la discussion !", "success");
      void savePreview();
    } catch {
      toast("Le dessin n'est pas parti 😕", "error");
    } finally {
      setSending(false);
    }
  }

  async function saveMeta(patch: Partial<Pick<Drawing, "title" | "person_id">>) {
    setDrawing((cur) => (cur ? { ...cur, ...patch } : cur));
    const { error } = await supabase().from("drawings").update(patch).eq("id", id);
    if (error) toast("Modification non enregistrée 😕", "error");
  }

  async function removeDrawing() {
    if (!window.confirm("Supprimer ce dessin pour de bon ?")) return;
    dirtySave.current = false;
    const { error } = await supabase().from("drawings").delete().eq("id", id);
    if (error) return toast("Suppression impossible 😕", "error");
    if (previewPath.current) deleteMedia(previewPath.current).catch(() => {});
    router.push("/dessin");
  }

  // ------------------------------------------------------------ rendu
  if (drawing === undefined) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg">
        <Spinner />
      </div>
    );
  }
  if (drawing === null) {
    return (
      <div className="pt-6">
        <EmptyState emoji="🫥" title="Ce dessin n'existe plus" action={<LinkButton href="/dessin">Retour au mur</LinkButton>} />
      </div>
    );
  }

  const canUndo = version >= 0 && !!model.lastBy(me.id);
  const other = peers[0];
  const activeName = drawingBy && drawingBy !== me.id ? nameOf(drawingBy) : null;
  const person = personById(drawing.person_id);

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-lg flex-col bg-bg pt-safe pb-safe">
      <header className="flex items-center gap-1 px-2 pt-1">
        <IconButton label="Retour" onClick={goBack} disabled={leaving}>
          {leaving ? <Spinner className="size-5" /> : <ChevronLeft className="size-6" />}
        </IconButton>
        <button type="button" onClick={() => setOptions(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {person && <Avatar person={person} size={28} />}
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-bold leading-tight">{drawing.title}</span>
            <span className={cn("block truncate text-xs", activeName ? "font-semibold text-accent" : "text-muted")}>
              {activeName ? `${activeName} dessine…` : other ? `🟢 ${other.name} est là` : "Personne d'autre pour l'instant"}
            </span>
          </span>
        </button>
        <IconButton label="Options" onClick={() => setOptions(true)}>
          <Settings2 className="size-5" />
        </IconButton>
      </header>

      <DrawingCanvas
        model={model}
        tool={tool}
        meId={me.id}
        onBegin={onBegin}
        onPoints={onPoints}
        onEnd={onEnd}
        className="min-h-0 flex-1 px-3 py-2"
      />

      <div className="px-3 pb-2">
        <DrawingToolbar tool={tool} onChange={setTool} onUndo={undo} onClear={() => setConfirmClear(true)} canUndo={canUndo} />
        {isParent && (
          <Button variant="soft" className="mt-2 w-full" loading={sending} disabled={!model.strokes.length} onClick={sendToChat}>
            <Send className="size-4" /> Envoyer dans la discussion
          </Button>
        )}
      </div>

      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title="Tout effacer ?">
        <p className="mb-4 text-muted">Le tableau sera vidé pour vous deux.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setConfirmClear(false)}>
            Non
          </Button>
          <Button variant="danger" onClick={clearAll}>
            Effacer
          </Button>
        </div>
      </Sheet>

      <Sheet open={options} onClose={() => setOptions(false)} title="Options du dessin">
        <div className="space-y-4">
          <Field label="Titre">
            <div className="flex gap-2">
              <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} maxLength={60} />
              <Button variant="soft" onClick={() => saveMeta({ title: titleDraft.trim() || "Dessin" })}>
                OK
              </Button>
            </div>
          </Field>
          {children.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-sm font-medium text-muted">C&apos;est le dessin de…</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={!drawing.person_id} onClick={() => saveMeta({ person_id: null })}>
                  💑 Nous deux
                </Chip>
                {children.map((c) => (
                  <Chip key={c.id} active={drawing.person_id === c.id} color={c.color} onClick={() => saveMeta({ person_id: c.id })}>
                    {c.emoji} {c.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <Button variant="ghost" className="w-full text-danger" onClick={removeDrawing}>
            Supprimer ce dessin
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
