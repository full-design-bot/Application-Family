"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, EmptyState, LoadingBlock, PageHeader, Sheet, useToast } from "@/components/ui";
import { CapsuleSheet } from "@/components/couple/Capsule";
import { Composer } from "@/components/couple/Composer";
import { EphemeralSheet, EphemeralViewer } from "@/components/couple/Ephemeral";
import { FullscreenImage } from "@/components/couple/FullscreenImage";
import { MessageBubble, type BubbleHandlers } from "@/components/couple/MessageBubble";
import { SketchSheet } from "@/components/couple/SketchSheet";
import {
  COUPLE_CHANNEL,
  ephemeralAlive,
  insertMessage,
  keepVote,
  markChatRead,
  notifyNewMessage,
  sendThought,
  uniqueChannel,
  useNow,
} from "@/components/couple/lib";
import { useFamily } from "@/lib/family";
import { uploadPhoto } from "@/lib/media";
import { supabase } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

const PAGE = 60;

type SheetName = "actions" | "ephemeral" | "capsule" | "sketch" | null;

export default function MessagesPage() {
  const { me, partner, members, isParent, personOf } = useFamily();
  const toast = useToast();
  const partnerName = partner?.display_name ?? "ton amour";
  const parentCount = members.filter((m) => m.role === "parent").length;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [composerH, setComposerH] = useState(64);
  const [uploading, setUploading] = useState(false);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [image, setImage] = useState<{ path: string; paper?: boolean } | null>(null);
  const [ephemeralId, setEphemeralId] = useState<string | null>(null);
  const now = useNow(15000);

  const stick = useRef(true);
  const prependFrom = useRef<number | null>(null);
  const firstScroll = useRef(true);

  // ------------------------------------------------------------ données
  const upsert = useCallback((m: Message) => {
    setMessages((list) => {
      const i = list.findIndex((x) => x.id === m.id);
      if (i >= 0) {
        const next = list.slice();
        next[i] = m;
        return next;
      }
      const next = [...list, m];
      next.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isParent) return;
    const sb = supabase();
    let alive = true;
    (async () => {
      const { data } = await sb
        .from("messages")
        .select("*")
        .eq("channel", COUPLE_CHANNEL)
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (!alive) return;
      const list = ((data ?? []) as Message[]).reverse();
      setMessages(list);
      setHasMore(list.length === PAGE);
      setLoading(false);
    })();
    void markChatRead(me.id);

    const ch = sb
      .channel(uniqueChannel("couple-messages"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `channel=eq.${COUPLE_CHANNEL}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) setMessages((list) => list.filter((x) => x.id !== id));
            return;
          }
          const m = payload.new as Message;
          upsert(m);
          if (payload.eventType === "INSERT" && m.sender_id !== me.id) void markChatRead(me.id);
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") void markChatRead(me.id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      sb.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
      void markChatRead(me.id);
    };
  }, [isParent, me.id, upsert]);

  async function loadOlder() {
    if (!messages.length) return;
    setLoadingMore(true);
    const { data } = await supabase()
      .from("messages")
      .select("*")
      .eq("channel", COUPLE_CHANNEL)
      .lt("created_at", messages[0].created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const older = ((data ?? []) as Message[]).reverse();
    prependFrom.current = document.documentElement.scrollHeight;
    setMessages((list) => [...older, ...list.filter((m) => !older.some((o) => o.id === m.id))]);
    setHasMore(older.length === PAGE);
    setLoadingMore(false);
  }

  // ------------------------------------------------------------ défilement
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      stick.current = window.innerHeight + window.scrollY >= el.scrollHeight - 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const lastId = messages[messages.length - 1]?.id;
  const lastMine = messages[messages.length - 1]?.sender_id === me.id;
  useLayoutEffect(() => {
    if (prependFrom.current !== null) {
      const delta = document.documentElement.scrollHeight - prependFrom.current;
      prependFrom.current = null;
      window.scrollTo({ top: window.scrollY + delta });
      return;
    }
    if (!lastId) return;
    if (firstScroll.current) {
      firstScroll.current = false;
      scrollToBottom();
      return;
    }
    if (stick.current || lastMine) scrollToBottom(true);
  }, [lastId, lastMine, scrollToBottom]);

  const onMediaLoad = useCallback(() => {
    if (stick.current) scrollToBottom();
  }, [scrollToBottom]);

  // ------------------------------------------------------------ envoi
  async function sendText(text: string) {
    try {
      const m = await insertMessage(me.id, { kind: "text", body: text });
      upsert(m);
      notifyNewMessage(me.display_name, "text", text);
      return true;
    } catch {
      toast("Message non envoyé, réessaie 😕", "error");
      return false;
    }
  }

  async function sendPhoto(file: File) {
    setUploading(true);
    try {
      const path = await uploadPhoto("couple", file);
      const m = await insertMessage(me.id, { kind: "photo", media_path: path });
      upsert(m);
      notifyNewMessage(me.display_name, "photo");
    } catch {
      toast("La photo n'a pas pu partir 😕", "error");
    } finally {
      setUploading(false);
    }
  }

  async function thought() {
    setSheet(null);
    try {
      upsert(await sendThought(me.id, me.display_name));
    } catch {
      toast("Oups, ça n'est pas passé 😕", "error");
    }
  }

  const vote = useCallback(
    async (m: Message) => {
      try {
        const updated = await keepVote(m, me.id, parentCount);
        upsert(updated);
        toast(updated.kept ? "💛 Gardée ! Elle rejoint vos souvenirs." : "💛 C'est noté !", "success");
      } catch {
        toast("Le vote n'est pas passé 😕", "error");
      }
    },
    [me.id, parentCount, upsert, toast],
  );

  const handlers = useMemo<BubbleHandlers>(
    () => ({
      onOpenImage: (path, opts) => setImage({ path, paper: opts?.paper }),
      onOpenEphemeral: (m) => setEphemeralId(m.id),
      onVote: vote,
      onMediaLoad,
    }),
    [vote, onMediaLoad],
  );

  const ephemeral = ephemeralId ? messages.find((m) => m.id === ephemeralId) : undefined;
  const closeEphemeral = useCallback(() => setEphemeralId(null), []);

  if (!isParent) {
    return (
      <>
        <PageHeader title="Messages" back="/" />
        <EmptyState emoji="💌" title="Espace réservé aux parents" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={partner ? `Rien que toi et ${partnerName} 💛` : "En attendant que l'autre parent se connecte…"}
        action={
          partner ? (
            <Link href="/nous-deux" aria-label="Nous deux">
              <Avatar person={personOf(partner.id)} size={40} />
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-2">
          {hasMore && (
            <div className="flex justify-center pb-2">
              <Button variant="ghost" size="sm" loading={loadingMore} onClick={loadOlder}>
                Messages plus anciens
              </Button>
            </div>
          )}
          {!messages.length && (
            <EmptyState
              emoji="💌"
              title="Votre petit coin à deux"
              text={`Écris un premier mot doux à ${partnerName}, envoie une photo éphémère ou une capsule pour le futur.`}
            />
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              meId={me.id}
              myName={me.display_name}
              partnerName={partnerName}
              alive={m.kind === "ephemeral" ? ephemeralAlive(m, now, me.id) : true}
              handlers={handlers}
            />
          ))}
        </div>
      )}

      <div style={{ height: composerH + 8 }} aria-hidden />

      <Composer onSend={sendText} onPlus={() => setSheet("actions")} onPhoto={sendPhoto} onHeight={setComposerH} uploading={uploading} />

      <Sheet open={sheet === "actions"} onClose={() => setSheet(null)} title="Envoyer…">
        <div className="grid grid-cols-2 gap-3">
          <ActionTile emoji="💛" title="Je pense à toi" text="Un petit coucou du cœur" onClick={thought} className="bg-rose-soft" />
          <ActionTile emoji="📸" title="Photo éphémère" text="Vue unique ou 24 h" onClick={() => setSheet("ephemeral")} className="bg-accent-soft" />
          <ActionTile emoji="🔒" title="Capsule temporelle" text="À ouvrir plus tard" onClick={() => setSheet("capsule")} className="bg-sky-soft" />
          <ActionTile emoji="🎨" title="Petit dessin" text="Un croquis rapide" onClick={() => setSheet("sketch")} className="bg-sand-soft" />
        </div>
        <Link href="/dessin" className="mt-3 block rounded-3xl bg-sage-soft p-4 active:scale-[0.99] transition">
          <span className="font-bold">🖌️ Tableau partagé</span>
          <span className="block text-sm text-muted">Dessiner à deux en direct</span>
        </Link>
      </Sheet>

      <EphemeralSheet
        open={sheet === "ephemeral"}
        onClose={() => setSheet(null)}
        meId={me.id}
        myName={me.display_name}
        partnerName={partnerName}
        onSent={upsert}
      />
      <CapsuleSheet
        open={sheet === "capsule"}
        onClose={() => setSheet(null)}
        meId={me.id}
        myName={me.display_name}
        partnerId={partner?.id ?? null}
        partnerName={partnerName}
        onSent={upsert}
      />
      <SketchSheet open={sheet === "sketch"} onClose={() => setSheet(null)} meId={me.id} myName={me.display_name} onSent={upsert} />

      {image && <FullscreenImage path={image.path} paper={image.paper} onClose={() => setImage(null)} />}
      {ephemeral && (
        <EphemeralViewer
          message={ephemeral}
          meId={me.id}
          partnerName={partnerName}
          parentCount={parentCount}
          onClose={closeEphemeral}
          onUpdate={upsert}
        />
      )}
    </>
  );
}

function ActionTile({
  emoji,
  title,
  text,
  onClick,
  className,
}: {
  emoji: string;
  title: string;
  text: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`rounded-3xl p-4 text-left transition active:scale-[0.98] ${className ?? ""}`}>
      <span className="block text-3xl">{emoji}</span>
      <span className="mt-2 block font-bold">{title}</span>
      <span className="block text-sm leading-snug text-muted">{text}</span>
    </button>
  );
}
