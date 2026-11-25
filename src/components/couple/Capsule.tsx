"use client";

import { addMonths, addYears, format, parseISO } from "date-fns";
import { ImagePlus, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Chip, Field, Input, Sheet, Spinner, Textarea, cn, useToast } from "@/components/ui";
import { parisDateTime, todayISO } from "@/lib/dates";
import { uploadPhoto, useSignedUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase/client";
import type { CapsuleContent, Message } from "@/lib/types";
import { FloatingHearts, makeHearts, type HeartBurst } from "./FullscreenImage";
import { formatCountdown, formatUnlockDate, insertMessage, notifyNewMessage, useNow } from "./lib";

// ---------------------------------------------------------------- dates rapides
function nextAnnual(month: number, day: number): string {
  const today = todayISO();
  const y = Number(today.slice(0, 4));
  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const candidate = `${y}-${mmdd}`;
  return candidate > today ? candidate : `${y + 1}-${mmdd}`;
}

function quickDates(): { label: string; date: string }[] {
  const t = parseISO(todayISO());
  return [
    { label: "Dans 1 mois", date: format(addMonths(t, 1), "yyyy-MM-dd") },
    { label: "Dans 6 mois", date: format(addMonths(t, 6), "yyyy-MM-dd") },
    { label: "Dans 1 an", date: format(addYears(t, 1), "yyyy-MM-dd") },
    { label: "🎄 Noël", date: nextAnnual(12, 25) },
    { label: "💘 Saint-Valentin", date: nextAnnual(2, 14) },
    { label: "🎆 Nouvel an", date: nextAnnual(1, 1) },
  ];
}

// ---------------------------------------------------------------- création
export function CapsuleSheet({
  open,
  onClose,
  meId,
  myName,
  partnerId,
  partnerName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  meId: string;
  myName: string;
  partnerId: string | null;
  partnerName: string;
  onSent?: (m: Message) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="🔒 Capsule temporelle">
      {open && (
        <CapsuleForm meId={meId} myName={myName} partnerId={partnerId} partnerName={partnerName} onClose={onClose} onSent={onSent} />
      )}
    </Sheet>
  );
}

function CapsuleForm({
  meId,
  myName,
  partnerId,
  partnerName,
  onClose,
  onSent,
}: {
  meId: string;
  myName: string;
  partnerId: string | null;
  partnerName: string;
  onClose: () => void;
  onSent?: (m: Message) => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [quick] = useState(quickDates);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [date, setDate] = useState(quick[0].date);
  const [time, setTime] = useState("08:00");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function send() {
    if (!body.trim() && !file) return;
    const unlock = parisDateTime(date, time || "08:00");
    if (unlock.getTime() <= Date.now() + 60_000) {
      toast("Choisis une date dans le futur ⏳", "error");
      return;
    }
    setSending(true);
    let messageId: string | null = null;
    try {
      const mediaPath = file ? await uploadPhoto("capsules", file) : null;
      const m = await insertMessage(meId, {
        kind: "capsule",
        unlock_at: unlock.toISOString(),
        meta: partnerId ? { to: partnerId } : {},
      });
      messageId = m.id;
      const { error } = await supabase()
        .from("capsule_contents")
        .insert({ message_id: m.id, body: body.trim() || null, media_path: mediaPath });
      if (error) throw error;
      notifyNewMessage(myName, "capsule");
      toast(`🔒 Capsule scellée jusqu'au ${formatUnlockDate(m.unlock_at!)}`, "success");
      onSent?.(m);
      onClose();
    } catch {
      if (messageId) await supabase().from("messages").delete().eq("id", messageId);
      toast("La capsule n'a pas pu être scellée 😕", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted">
        Écris un mot (et glisse une photo si tu veux) pour {partnerName}. Impossible de l&apos;ouvrir avant la date choisie… même en trichant 😉
      </p>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Cher·e ${partnerName} du futur…`}
        maxLength={4000}
        className="min-h-32"
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setFile(f);
          setPreview(URL.createObjectURL(f));
        }}
      />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="" className="max-h-56 w-full rounded-3xl object-cover" />
          <button
            type="button"
            aria-label="Retirer la photo"
            onClick={() => {
              setFile(null);
              setPreview(null);
            }}
            className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-ink/70 text-bg"
          >
            <X className="size-5" />
          </button>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="size-5" /> Ajouter une photo
        </Button>
      )}
      <div>
        <p className="mb-2 px-1 text-sm font-medium text-muted">Elle s&apos;ouvrira…</p>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {quick.map((q) => (
            <Chip key={q.label} active={date === q.date} onClick={() => setDate(q.date)}>
              {q.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_7.5rem] gap-2">
        <Field label="Date">
          <Input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Heure">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Button className="w-full" size="lg" disabled={!body.trim() && !file} loading={sending} onClick={send}>
        <Send className="size-5" /> Sceller la capsule
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- contenu
const OPENED_KEY = (id: string) => `noesia-capsule-ouverte-${id}`;

/** Charge le contenu d'une capsule (la RLS ne le renvoie qu'après la date, sauf à l'expéditeur). */
export async function fetchCapsuleContent(messageId: string): Promise<CapsuleContent | null> {
  const { data } = await supabase().from("capsule_contents").select("*").eq("message_id", messageId).maybeSingle();
  return (data as CapsuleContent | null) ?? null;
}

function CapsuleReveal({ content, onPhoto, animate }: { content: CapsuleContent; onPhoto?: (path: string) => void; animate?: boolean }) {
  const url = useSignedUrl(content.media_path);
  return (
    <div className={cn("space-y-2", animate && "animate-pop")}>
      {content.body && <p className="whitespace-pre-wrap break-words">{content.body}</p>}
      {content.media_path && (
        <button type="button" onClick={() => onPhoto?.(content.media_path!)} className="block w-full overflow-hidden rounded-2xl bg-card-2">
          {url ? <img src={url} alt="" className="max-h-72 w-full object-cover" /> : <div className="flex h-40 items-center justify-center"><Spinner /></div>}
        </button>
      )}
    </div>
  );
}

/** Carte d'une capsule (dans la discussion ou la page Nous deux). */
export function CapsuleCard({
  m,
  mine,
  partnerName,
  onPhoto,
  className,
  full,
}: {
  m: Message;
  mine: boolean;
  partnerName: string;
  onPhoto?: (path: string) => void;
  className?: string;
  /** pleine largeur (liste des capsules) */
  full?: boolean;
}) {
  const unlockAt = m.unlock_at ? new Date(m.unlock_at).getTime() : 0;
  const now = useNow(1000);
  const locked = unlockAt > now;
  const [opened, setOpened] = useState<boolean | null>(null);
  const [content, setContent] = useState<CapsuleContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [hearts, setHearts] = useState<HeartBurst[]>([]);
  const [peek, setPeek] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      setOpened(mine || localStorage.getItem(OPENED_KEY(m.id)) === "1");
    } catch {
      setOpened(true);
    }
  }, [m.id, mine]);

  const load = useCallback(async () => {
    setLoading(true);
    let c = await fetchCapsuleContent(m.id);
    // Petit décalage d'horloge possible avec le serveur : on réessaie
    for (let i = 0; !c && i < 3; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      c = await fetchCapsuleContent(m.id);
    }
    setContent(c);
    setFailed(!c);
    setLoading(false);
    return c;
  }, [m.id]);

  // Capsule déjà ouverte : on affiche directement le contenu
  useEffect(() => {
    if (!locked && opened && !content && !loading && !failed) void load();
  }, [locked, opened, content, loading, failed, load]);

  async function open() {
    setHearts(makeHearts(12));
    setAnimate(true);
    try {
      localStorage.setItem(OPENED_KEY(m.id), "1");
    } catch {
      // stockage indisponible
    }
    setOpened(true);
    await load();
  }

  const dateLabel = m.unlock_at ? formatUnlockDate(m.unlock_at) : "";

  if (locked) {
    return (
      <div className={cn("relative overflow-hidden rounded-3xl bg-sky-soft p-4", full ? "w-full" : "w-64", className)}>
        <p className="font-bold">🔒 Capsule — s&apos;ouvre le {dateLabel}</p>
        <p className="mt-1 text-sm text-muted">{mine ? `Pour ${partnerName}, ` : ""}dans</p>
        <p className="font-display text-2xl font-bold tabular-nums text-sky">{formatCountdown(unlockAt - now)}</p>
        {mine && (
          <>
            <button type="button" onClick={async () => { setPeek(!peek); if (!content) await load(); }} className="mt-2 text-sm font-semibold text-sky underline-offset-2 active:underline">
              {peek ? "Cacher" : "👀 Relire ce que j'ai écrit"}
            </button>
            {peek && (
              <div className="mt-2 rounded-2xl bg-card p-3 text-sm">
                {content ? <CapsuleReveal content={content} onPhoto={onPhoto} /> : loading ? <Spinner /> : <p className="text-muted">Contenu introuvable.</p>}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (opened === false) {
    return (
      <button
        type="button"
        onClick={open}
        className={cn("relative rounded-3xl bg-gradient-to-br from-sand-soft to-rose-soft p-4 text-left active:scale-[0.98] transition", full ? "w-full" : "w-64", className)}
      >
        <span className="block text-4xl motion-safe:animate-bounce">🎁</span>
        <span className="mt-2 block font-bold">Ta capsule s&apos;est ouverte !</span>
        <span className="block text-sm text-muted">Scellée le {formatUnlockDate(m.created_at)} — touche pour l&apos;ouvrir</span>
      </button>
    );
  }

  return (
    <div className={cn("relative max-w-full rounded-3xl bg-sand-soft p-4", full ? "w-full" : "w-72", className)}>
      <FloatingHearts bursts={hearts} emoji="✨" />
      <p className="mb-2 text-sm font-semibold text-muted">
        🔓 Capsule du {formatUnlockDate(m.created_at)} · ouverte le {dateLabel}
      </p>
      {content ? (
        <CapsuleReveal content={content} onPhoto={onPhoto} animate={animate} />
      ) : loading || opened === null ? (
        <Spinner />
      ) : (
        <button type="button" onClick={() => void load()} className="text-sm text-muted underline">
          Le contenu n&apos;est pas encore disponible — toucher pour réessayer
        </button>
      )}
    </div>
  );
}
