"use client";

// Fiche enfant : carnet (table child_entries) — mots d'enfants, santé, croissance, souvenirs & dessins.

import Link from "next/link";
import { Camera, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Chip, EmptyState, Field, Input, LoadingBlock, Segmented, Textarea, cn, useToast } from "@/components/ui";
import { ageFrom, formatDateFull, formatDayShort, todayISO } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { deleteMedia, uploadPhoto, useSignedUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase/client";
import type { ChildEntry, Person } from "@/lib/types";

type Kind = ChildEntry["kind"];

// ------------------------------------------------------------------ données
function useEntries(personId: string, kinds: Kind[]) {
  const [items, setItems] = useState<ChildEntry[] | null>(null);
  const key = kinds.join(",");
  const load = useCallback(async () => {
    const { data } = await supabase()
      .from("child_entries")
      .select("*")
      .eq("person_id", personId)
      .in("kind", key.split(","))
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as ChildEntry[]);
  }, [personId, key]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sb = supabase();
    const ch = sb
      .channel(`enfants-entries-${personId}-${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "child_entries" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [personId, key, load]);

  return { items, reload: load };
}

function useEntryActions(personId: string, reload: () => Promise<void>) {
  const { me } = useFamily();
  const toast = useToast();
  return {
    async add(values: Partial<ChildEntry> & { kind: Kind }) {
      const { error } = await supabase()
        .from("child_entries")
        .insert({ person_id: personId, created_by: me.id, ...values });
      if (error) {
        toast("Impossible d'enregistrer 😕", "error");
        return false;
      }
      await reload();
      return true;
    },
    async remove(entry: ChildEntry) {
      const { error } = await supabase().from("child_entries").delete().eq("id", entry.id);
      if (error) return toast("Impossible de supprimer", "error");
      if (entry.media_path) deleteMedia(entry.media_path).catch(() => {});
      await reload();
    },
  };
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="Supprimer" onClick={onClick} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted active:bg-card-2">
      <Trash2 className="size-4" />
    </button>
  );
}

function confirmDelete(what: string) {
  return window.confirm(`Supprimer ${what} ?`);
}

// ------------------------------------------------------------------ Mots d'enfants
export function QuotesTab({ child }: { child: Person }) {
  const { items, reload } = useEntries(child.id, ["quote"]);
  const { add, remove } = useEntryActions(child.id, reload);
  const toast = useToast();
  const [text, setText] = useState("");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim().replace(/^[«"]\s*|\s*[»"]$/g, "");
    if (!t) return;
    setBusy(true);
    const ok = await add({ kind: "quote", body: t, entry_date: date || todayISO() });
    setBusy(false);
    if (ok) {
      setText("");
      toast("Mot gardé précieusement 💬", "success");
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Ce que ${child.name} vient de dire…`}
            className="min-h-20 text-lg"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
          />
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto flex-1" aria-label="Date" />
            <Button type="submit" loading={busy} disabled={!text.trim()} className="h-12 shrink-0">
              Garder 💬
            </Button>
          </div>
        </form>
      </Card>

      {items === null ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState emoji="💬" title="Aucun mot d'enfant pour l'instant" text="Note ses perles dès qu'elles sortent : tu seras content de les relire dans 10 ans." />
      ) : (
        items.map((q) => {
          const age = ageFrom(child.birthdate, q.entry_date);
          return (
            <Card key={q.id} className="relative">
              <p className="pr-8 text-lg font-medium leading-snug">« {q.body} »</p>
              <p className="mt-2 text-sm text-muted">
                — {child.name}
                {age !== null ? `, ${age} an${age > 1 ? "s" : ""}` : ""} · {formatDateFull(q.entry_date)}
              </p>
              <div className="absolute right-2 top-2">
                <DeleteButton onClick={() => confirmDelete("ce mot") && remove(q)} />
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Santé
const HEALTH_TYPES = [
  { emoji: "💉", label: "Vaccin" },
  { emoji: "🩺", label: "Rendez-vous" },
  { emoji: "💊", label: "Traitement" },
  { emoji: "🤒", label: "Maladie" },
  { emoji: "📝", label: "Autre" },
];

export function HealthTab({ child }: { child: Person }) {
  const { items, reload } = useEntries(child.id, ["health"]);
  const { add, remove } = useEntryActions(child.id, reload);
  const toast = useToast();
  const [type, setType] = useState(HEALTH_TYPES[0].emoji);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayISO();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return toast("Précise de quoi il s'agit ✏️", "error");
    setBusy(true);
    const ok = await add({ kind: "health", title: `${type} ${t}`, body: body.trim() || null, entry_date: date || today });
    setBusy(false);
    if (ok) {
      setTitle("");
      setBody("");
      setOpen(false);
      toast("Ajouté au carnet de santé 🩺", "success");
    }
  }

  const upcoming = (items ?? []).filter((i) => i.entry_date > today).reverse();
  const past = (items ?? []).filter((i) => i.entry_date <= today);

  return (
    <div className="space-y-3">
      {!open ? (
        <Button variant="soft" className="w-full" onClick={() => setOpen(true)}>
          + Vaccin, rendez-vous, traitement…
        </Button>
      ) : (
        <Card>
          <form onSubmit={submit} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {HEALTH_TYPES.map((h) => (
                <Chip key={h.emoji} active={type === h.emoji} onClick={() => setType(h.emoji)}>
                  {h.emoji} {h.label}
                </Chip>
              ))}
            </div>
            <Input placeholder={type === "💉" ? "ROR 2e dose" : type === "💊" ? "Amoxicilline 2×/jour" : "Pédiatre, dentiste…"} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Textarea placeholder="Détails (facultatif)" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-16" />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" loading={busy}>
                Ajouter
              </Button>
            </div>
          </form>
        </Card>
      )}

      {items === null ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState emoji="🩺" title="Carnet de santé vide" text="Vaccins, rendez-vous chez le pédiatre, traitements en cours…" />
      ) : (
        <>
          {upcoming.length > 0 && <p className="px-1 pt-2 text-sm font-semibold uppercase tracking-wide text-muted">À venir</p>}
          {upcoming.map((h) => (
            <HealthRow key={h.id} entry={h} child={child} upcoming onDelete={() => confirmDelete("cette entrée") && remove(h)} />
          ))}
          {past.length > 0 && <p className="px-1 pt-2 text-sm font-semibold uppercase tracking-wide text-muted">Historique</p>}
          {past.map((h) => (
            <HealthRow key={h.id} entry={h} child={child} onDelete={() => confirmDelete("cette entrée") && remove(h)} />
          ))}
        </>
      )}
    </div>
  );
}

function HealthRow({ entry, child, upcoming, onDelete }: { entry: ChildEntry; child: Person; upcoming?: boolean; onDelete: () => void }) {
  const title = entry.title ?? "";
  const emoji = HEALTH_TYPES.find((h) => title.startsWith(h.emoji))?.emoji ?? "🩺";
  const text = title.startsWith(emoji) ? title.slice(emoji.length).trim() : title;
  const agendaHref = `/agenda/nouveau?titre=${encodeURIComponent(text)}&date=${entry.entry_date}&emoji=${encodeURIComponent(emoji)}&personne=${child.id}`;
  return (
    <Card className={cn("flex items-start gap-3 p-3", upcoming && "border-sky/40 bg-sky-soft")}>
      <span className="text-2xl">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{text}</p>
        <p className="text-sm capitalize text-muted">{formatDateFull(entry.entry_date)}</p>
        {entry.body && <p className="mt-1 whitespace-pre-wrap text-sm">{entry.body}</p>}
        {upcoming && (
          <Link href={agendaHref} className="mt-1 inline-block text-sm font-semibold text-sky">
            📅 Mettre dans l&apos;agenda
          </Link>
        )}
      </div>
      <DeleteButton onClick={onDelete} />
    </Card>
  );
}

// ------------------------------------------------------------------ Croissance
function parseNum(s: string): number | null {
  const n = Number(s.replace(",", ".").trim());
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

export function GrowthTab({ child }: { child: Person }) {
  const { items, reload } = useEntries(child.id, ["measure"]);
  const { add, remove } = useEntryActions(child.id, reload);
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [metric, setMetric] = useState<"height" | "weight">("height");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = parseNum(height);
    const w = parseNum(weight);
    if (h === null && w === null) return toast("Indique une taille ou un poids 📏", "error");
    setBusy(true);
    const ok = await add({ kind: "measure", entry_date: date || todayISO(), height_cm: h, weight_kg: w });
    setBusy(false);
    if (ok) {
      setHeight("");
      setWeight("");
      toast(`${child.name} a grandi ! 🌱`, "success");
    }
  }

  const points = (items ?? [])
    .map((m) => ({ date: m.entry_date, value: metric === "height" ? m.height_cm : m.weight_kg }))
    .filter((p): p is { date: string; value: number } => p.value !== null && p.value !== undefined)
    .map((p) => ({ date: p.date, value: Number(p.value) }))
    .reverse();

  return (
    <div className="space-y-3">
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="📏 Taille (cm)">
              <Input inputMode="decimal" placeholder="116" value={height} onChange={(e) => setHeight(e.target.value)} />
            </Field>
            <Field label="⚖️ Poids (kg)">
              <Input inputMode="decimal" placeholder="21,5" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto flex-1" aria-label="Date" />
            <Button type="submit" loading={busy} className="h-12 shrink-0">
              Noter
            </Button>
          </div>
        </form>
      </Card>

      {items === null ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState emoji="📏" title="Pas encore de mesure" text="La marque sur le chambranle de la porte, en version numérique." />
      ) : (
        <>
          <Card>
            <Segmented
              value={metric}
              onChange={setMetric}
              options={[
                { value: "height", label: "📏 Taille" },
                { value: "weight", label: "⚖️ Poids" },
              ]}
            />
            <GrowthChart key={metric} points={points} unit={metric === "height" ? "cm" : "kg"} color={child.color} />
          </Card>
          <Card className="divide-y divide-line py-1">
            {items.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-sm capitalize text-muted">{formatDayShort(m.entry_date)} {m.entry_date.slice(0, 4)}</span>
                <span className="w-20 text-right font-semibold">{m.height_cm !== null ? `${Number(m.height_cm)} cm` : "—"}</span>
                <span className="w-20 text-right font-semibold">{m.weight_kg !== null ? `${Number(m.weight_kg)} kg` : "—"}</span>
                <DeleteButton onClick={() => confirmDelete("cette mesure") && remove(m)} />
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

/** Petite courbe SVG faite main : une seule série, valeur affichée au toucher (par défaut : la dernière). */
function GrowthChart({ points, unit, color }: { points: { date: string; value: number }[]; unit: string; color: string }) {
  const [selected, setSelected] = useState(points.length - 1);
  if (points.length < 2) {
    return <p className="py-8 text-center text-sm text-muted">Encore une mesure et la courbe apparaît ✨</p>;
  }
  const W = 320;
  const H = 170;
  const pad = { l: 36, r: 14, t: 26, b: 24 };
  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const margin = Math.max((hi - lo) * 0.15, unit === "cm" ? 2 : 0.5);
  lo = Math.max(0, lo - margin);
  hi = hi + margin;
  const x = (d: string) => pad.l + (t1 === t0 ? 0.5 : (Date.parse(d) - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [lo, (lo + hi) / 2, hi];
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const sel = points[Math.min(selected, points.length - 1)];
  const fmt = (v: number) => (unit === "kg" ? v.toFixed(1).replace(".", ",") : String(Math.round(v * 10) / 10).replace(".", ","));
  const sx = x(sel.date);
  const anchor = sx > W - 70 ? "end" : sx < pad.l + 40 ? "start" : "middle";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`Courbe de ${unit === "cm" ? "taille" : "poids"}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
            {Math.round(t)}
          </text>
        </g>
      ))}
      <text x={pad.l} y={H - 6} fontSize={10} fill="var(--muted)">
        {formatDayShort(points[0].date)} {points[0].date.slice(2, 4)}
      </text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize={10} fill="var(--muted)">
        {formatDayShort(points[points.length - 1].date)} {points[points.length - 1].date.slice(2, 4)}
      </text>
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={`${p.date}-${i}`} onClick={() => setSelected(i)} className="cursor-pointer">
          <circle cx={x(p.date)} cy={y(p.value)} r={14} fill="transparent" />
          <circle cx={x(p.date)} cy={y(p.value)} r={i === selected ? 5.5 : 4} fill={color} stroke="var(--card)" strokeWidth={2} />
        </g>
      ))}
      <text x={sx} y={Math.max(12, y(sel.value) - 12)} textAnchor={anchor} fontSize={12} fontWeight={700} fill="var(--ink)">
        {fmt(sel.value)} {unit} · {formatDayShort(sel.date)}
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------ Souvenirs & dessins
export function MemoriesTab({ child }: { child: Person }) {
  const { items, reload } = useEntries(child.id, ["memory", "drawing"]);
  const { add, remove } = useEntryActions(child.id, reload);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"memory" | "drawing">("memory");
  const [filter, setFilter] = useState<"all" | "memory" | "drawing">("all");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<ChildEntry | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function reset() {
    setFile(null);
    setTitle("");
    setBody("");
    setDate(todayISO());
    setOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "drawing" && !file) return toast("Prends le dessin en photo 📸", "error");
    if (!file && !title.trim() && !body.trim()) return toast("Ajoute une photo ou quelques mots ✏️", "error");
    setBusy(true);
    try {
      const media_path = file ? await uploadPhoto("family", file, "kids") : null;
      const ok = await add({ kind, title: title.trim() || null, body: body.trim() || null, entry_date: date || todayISO(), media_path });
      if (ok) {
        toast(kind === "drawing" ? "Dessin accroché au frigo 🖍️" : "Souvenir gardé 💛", "success");
        reset();
      }
    } catch {
      toast("L'envoi de la photo a échoué 😕", "error");
    } finally {
      setBusy(false);
    }
  }

  const shown = (items ?? []).filter((i) => filter === "all" || i.kind === filter);

  return (
    <div className="space-y-3">
      {!open ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={() => { setKind("memory"); setOpen(true); }}>
            💛 Un souvenir
          </Button>
          <Button variant="soft" onClick={() => { setKind("drawing"); setOpen(true); }}>
            🖍️ Un dessin
          </Button>
        </div>
      ) : (
        <Card>
          <form onSubmit={submit} className="space-y-3">
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: "memory", label: "💛 Souvenir" },
                { value: "drawing", label: "🖍️ Dessin" },
              ]}
            />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-card-2 text-muted"
            >
              {preview ? (
                <img src={preview} alt="Aperçu" className="size-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1">
                  <Camera className="size-8" />
                  {kind === "drawing" ? "Photographier le dessin" : "Ajouter une photo (facultatif)"}
                </span>
              )}
            </button>
            <Input placeholder={kind === "drawing" ? "Le dragon de la cabane" : "Premier jour d'école"} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
            {kind === "memory" && <Textarea placeholder="Raconte…" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-16" />}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={reset}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" loading={busy}>
                Garder
              </Button>
            </div>
          </form>
        </Card>
      )}

      {items && items.length > 0 && (
        <div className="flex gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>Tout</Chip>
          <Chip active={filter === "memory"} onClick={() => setFilter("memory")}>💛 Souvenirs</Chip>
          <Chip active={filter === "drawing"} onClick={() => setFilter("drawing")}>🖍️ Dessins</Chip>
        </div>
      )}

      {items === null ? (
        <LoadingBlock />
      ) : shown.length === 0 ? (
        <EmptyState emoji="🖼️" title="La galerie est vide" text={`Les dessins de ${child.name} méritent mieux que le fond d'un tiroir.`} />
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {shown.map((m) => (
            <Thumb key={m.id} entry={m} onOpen={() => setViewing(m)} />
          ))}
        </div>
      )}

      {viewing && (
        <FullScreen
          entry={viewing}
          onClose={() => setViewing(null)}
          onDelete={async () => {
            if (!confirmDelete(viewing.kind === "drawing" ? "ce dessin" : "ce souvenir")) return;
            await remove(viewing);
            setViewing(null);
          }}
        />
      )}
    </div>
  );
}

function Thumb({ entry, onOpen }: { entry: ChildEntry; onOpen: () => void }) {
  const url = useSignedUrl(entry.media_path);
  return (
    <button type="button" onClick={onOpen} className="relative aspect-square overflow-hidden rounded-2xl bg-card-2">
      {entry.media_path ? (
        url ? <img src={url} alt={entry.title ?? ""} className="size-full object-cover" loading="lazy" /> : null
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
          <span className="text-2xl">💛</span>
          <span className="line-clamp-2 text-xs font-medium">{entry.title ?? entry.body}</span>
        </span>
      )}
      {entry.kind === "drawing" && <span className="absolute bottom-1 right-1 text-sm">🖍️</span>}
    </button>
  );
}

function FullScreen({ entry, onClose, onDelete }: { entry: ChildEntry; onClose: () => void; onDelete: () => void }) {
  const url = useSignedUrl(entry.media_path);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white pt-safe pb-safe" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" aria-label="Supprimer" onClick={onDelete} className="flex size-11 items-center justify-center rounded-full active:bg-white/10">
          <Trash2 className="size-5" />
        </button>
        <button type="button" aria-label="Fermer" onClick={onClose} className="flex size-11 items-center justify-center rounded-full active:bg-white/10">
          <X className="size-6" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2" onClick={onClose}>
        {entry.media_path ? (
          url ? <img src={url} alt={entry.title ?? ""} className="max-h-full max-w-full rounded-xl object-contain" /> : <LoadingBlock />
        ) : (
          <p className="max-w-sm whitespace-pre-wrap text-center text-xl">{entry.body}</p>
        )}
      </div>
      <div className="px-5 pb-6 pt-3">
        {entry.title && <p className="text-lg font-bold">{entry.title}</p>}
        <p className="text-sm text-white/70">{formatDateFull(entry.entry_date)}</p>
        {entry.media_path && entry.body && <p className="mt-1 whitespace-pre-wrap text-sm text-white/90">{entry.body}</p>}
      </div>
    </div>
  );
}
