"use client";

import { ImagePlus, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Segmented, Sheet, cn, useToast } from "@/components/ui";
import { uploadPhoto } from "@/lib/media";
import type { Message } from "@/lib/types";
import { FullscreenImage } from "./FullscreenImage";
import { formatCountdown, insertMessage, keepVote, markViewed, notifyNewMessage, useNow } from "./lib";

const VIEW_ONCE_SECONDS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------- envoi
export function EphemeralSheet({
  open,
  onClose,
  meId,
  myName,
  partnerName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  meId: string;
  myName: string;
  partnerName: string;
  onSent: (m: Message) => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<"once" | "day">("once");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function close() {
    setFile(null);
    setPreview(null);
    onClose();
  }

  async function send() {
    if (!file) return;
    setSending(true);
    try {
      const path = await uploadPhoto("couple", file);
      const m = await insertMessage(meId, {
        kind: "ephemeral",
        media_path: path,
        view_once: mode === "once",
        // Toujours une expiration à 24 h, même en vue unique (sécurité)
        expires_at: new Date(Date.now() + DAY_MS).toISOString(),
      });
      notifyNewMessage(myName, "ephemeral");
      onSent(m);
      close();
    } catch {
      toast("La photo n'a pas pu partir 😕", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title="📸 Photo éphémère">
      <div className="space-y-4">
        <p className="text-muted">
          Une photo rien que pour {partnerName}, qui disparaît après avoir été vue. Si vous votez tous les deux « on la garde », elle rejoint vos souvenirs 💛
        </p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-line bg-card-2"
        >
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-muted">
              <ImagePlus className="size-8" />
              Choisir ou prendre une photo
            </span>
          )}
        </button>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "once", label: "👁️ Vue unique" },
            { value: "day", label: "⏳ 24 h" },
          ]}
        />
        <p className="px-1 text-sm text-muted">
          {mode === "once"
            ? `${partnerName} pourra la regarder une seule fois, pendant ${VIEW_ONCE_SECONDS} secondes.`
            : `${partnerName} pourra la revoir pendant 24 heures.`}
        </p>
        <Button className="w-full" size="lg" disabled={!file} loading={sending} onClick={send}>
          <Send className="size-5" /> Envoyer
        </Button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- visionneuse
export function EphemeralViewer({
  message,
  meId,
  partnerName,
  parentCount,
  onClose,
  onUpdate,
}: {
  message: Message;
  meId: string;
  partnerName: string;
  parentCount: number;
  onClose: () => void;
  onUpdate: (m: Message) => void;
}) {
  const toast = useToast();
  const mine = message.sender_id === meId;
  const [openedAt] = useState(() => Date.now());
  const now = useNow(250);
  const [voting, setVoting] = useState(false);
  const marked = useRef(false);

  // Le destinataire ouvre la photo : viewed_at = maintenant
  useEffect(() => {
    if (mine || marked.current || message.kept) return;
    marked.current = true;
    markViewed(message).then(onUpdate).catch(() => {});
  }, [message, mine, onUpdate]);

  const viewOnceRunning = message.view_once && !mine && !message.kept;
  const remaining = message.kept
    ? null
    : viewOnceRunning
      ? openedAt + VIEW_ONCE_SECONDS * 1000 - now
      : message.expires_at
        ? new Date(message.expires_at).getTime() - now
        : null;

  useEffect(() => {
    if (remaining !== null && remaining <= 0) onClose();
  }, [remaining, onClose]);

  const voted = message.keep_votes?.includes(meId);
  const otherVoted = message.keep_votes?.some((v) => v !== meId);

  async function vote() {
    setVoting(true);
    try {
      const m = await keepVote(message, meId, parentCount);
      onUpdate(m);
      if (m.kept) toast("💛 Gardée ! Elle rejoint vos souvenirs.", "success");
    } catch {
      toast("Le vote n'est pas passé 😕", "error");
    } finally {
      setVoting(false);
    }
  }

  const seconds = remaining !== null ? Math.max(0, Math.ceil(remaining / 1000)) : null;

  return (
    <FullscreenImage
      path={message.media_path}
      onClose={onClose}
      protect={!message.kept}
      header={
        <div className="flex items-center gap-2">
          <span>📸 {mine ? "Ta photo éphémère" : `De ${partnerName}`}</span>
          {remaining !== null && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 font-bold tabular-nums",
                viewOnceRunning && seconds !== null && seconds <= 3 ? "bg-danger" : "bg-white/15",
              )}
            >
              {viewOnceRunning ? `${seconds} s` : `⏳ ${formatCountdown(remaining)}`}
            </span>
          )}
          {mine && !message.kept && (
            <span className="text-white/60">{message.viewed_at ? "· vue" : "· pas encore vue"}</span>
          )}
        </div>
      }
      footer={
        message.kept ? (
          <p className="py-3 text-center font-semibold">💛 Gardée — elle fait partie de vos souvenirs</p>
        ) : voted ? (
          <p className="py-3 text-center text-white/80">💛 Tu veux la garder — on attend {partnerName}…</p>
        ) : (
          <Button size="lg" className="w-full" loading={voting} onClick={vote}>
            💛 On la garde ?{otherVoted ? ` (${partnerName} a dit oui !)` : ""}
          </Button>
        )
      }
    />
  );
}

// ---------------------------------------------------------------- bulle
export function EphemeralBubble({
  m,
  mine,
  meId,
  partnerName,
  alive,
  onOpen,
  onVote,
}: {
  m: Message;
  mine: boolean;
  meId: string;
  partnerName: string;
  alive: boolean;
  onOpen: () => void;
  onVote: () => void;
}) {
  const voted = m.keep_votes?.includes(meId);
  const otherVoted = m.keep_votes?.some((v) => v !== meId);
  const canStillVote = !m.kept && !m.deleted && !!m.media_path && !voted && (otherVoted || mine);

  if (!alive) {
    return (
      <div className={cn("rounded-3xl border border-line bg-card-2 px-4 py-3 text-sm text-muted", mine ? "rounded-br-lg" : "rounded-bl-lg")}>
        <p>📸 Photo éphémère vue</p>
        {canStillVote && otherVoted && (
          <button type="button" onClick={onVote} className="mt-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
            💛 {partnerName} veut la garder — on la garde ?
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "relative flex h-40 w-52 flex-col items-center justify-center overflow-hidden rounded-3xl text-center",
        mine ? "rounded-br-lg" : "rounded-bl-lg",
      )}
    >
      <span className="absolute inset-0 bg-gradient-to-br from-rose via-accent to-sand opacity-80 blur-xl" />
      <span className="absolute inset-0 bg-card/20 backdrop-blur-2xl" />
      <span className="relative text-3xl">{m.kept ? "💛" : "📸"}</span>
      <span className="relative mt-1 font-bold text-white drop-shadow">
        {m.kept ? "Gardée" : mine ? "Photo éphémère" : "Touche pour voir"}
      </span>
      <span className="relative text-xs font-medium text-white/90 drop-shadow">
        {m.kept
          ? "Dans vos souvenirs"
          : mine
            ? m.viewed_at
              ? "Vue ✓"
              : "Pas encore vue"
            : m.view_once
              ? "Vue unique · 10 s"
              : "Visible 24 h"}
      </span>
      {!m.kept && otherVoted && !voted && (
        <span className="relative mt-1 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold text-white">
          💛 {partnerName} veut la garder
        </span>
      )}
    </button>
  );
}
