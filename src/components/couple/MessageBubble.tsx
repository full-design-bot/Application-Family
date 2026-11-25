"use client";

import { Spinner, cn } from "@/components/ui";
import { formatMessageTime } from "@/lib/dates";
import { useSignedUrl } from "@/lib/media";
import type { Message } from "@/lib/types";
import { CapsuleCard } from "./Capsule";
import { EphemeralBubble } from "./Ephemeral";

function MediaThumb({
  path,
  mine,
  paper,
  badge,
  onOpen,
  onLoad,
}: {
  path: string;
  mine: boolean;
  paper?: boolean;
  badge?: string;
  onOpen: () => void;
  onLoad?: () => void;
}) {
  const url = useSignedUrl(path);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "relative block overflow-hidden rounded-3xl border border-line",
        mine ? "rounded-br-lg" : "rounded-bl-lg",
        paper ? "bg-[#fffdf8]" : "bg-card-2",
      )}
    >
      {url ? (
        <img src={url} alt="" onLoad={onLoad} className="block max-h-72 w-auto max-w-60 object-cover" />
      ) : (
        <div className="flex h-48 w-48 items-center justify-center">
          <Spinner />
        </div>
      )}
      {badge && (
        <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-xs font-semibold text-ink">{badge}</span>
      )}
    </button>
  );
}

export interface BubbleHandlers {
  onOpenImage: (path: string, opts?: { paper?: boolean }) => void;
  onOpenEphemeral: (m: Message) => void;
  onVote: (m: Message) => void;
  onMediaLoad?: () => void;
}

export function MessageBubble({
  m,
  meId,
  myName,
  partnerName,
  alive,
  handlers,
}: {
  m: Message;
  meId: string;
  myName: string;
  partnerName: string;
  /** photo éphémère encore visible */
  alive: boolean;
  handlers: BubbleHandlers;
}) {
  const mine = m.sender_id === meId;
  const time = formatMessageTime(m.created_at);

  if (m.kind === "system") {
    return <p className="my-3 text-center text-xs text-muted">{m.body}</p>;
  }

  let content: React.ReactNode;
  switch (m.kind) {
    case "thought":
      content = (
        <div className="animate-pop rounded-full bg-rose-soft px-4 py-2 text-sm font-semibold text-rose">
          💛 {mine ? `Tu as pensé à ${partnerName}` : `${partnerName} pense à toi`}
        </div>
      );
      break;
    case "photo":
    case "drawing":
      content = m.media_path ? (
        <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
          <MediaThumb
            path={m.media_path}
            mine={mine}
            paper={m.kind === "drawing"}
            badge={m.kind === "drawing" ? "🎨" : undefined}
            onOpen={() => handlers.onOpenImage(m.media_path!, { paper: m.kind === "drawing" })}
            onLoad={handlers.onMediaLoad}
          />
          {m.body && <TextBubble text={m.body} mine={mine} />}
        </div>
      ) : (
        <TextBubble text={m.kind === "drawing" ? "🎨 Dessin supprimé" : "📷 Photo supprimée"} mine={mine} muted />
      );
      break;
    case "ephemeral":
      content =
        m.kept && m.media_path ? (
          <MediaThumb
            path={m.media_path}
            mine={mine}
            badge="💛 Gardée"
            onOpen={() => handlers.onOpenImage(m.media_path!)}
            onLoad={handlers.onMediaLoad}
          />
        ) : (
          <EphemeralBubble
            m={m}
            mine={mine}
            meId={meId}
            partnerName={partnerName}
            alive={alive}
            onOpen={() => handlers.onOpenEphemeral(m)}
            onVote={() => handlers.onVote(m)}
          />
        );
      break;
    case "capsule":
      content = (
        <CapsuleCard
          m={m}
          mine={mine}
          partnerName={partnerName}
          onPhoto={(p) => handlers.onOpenImage(p)}
          className={mine ? "rounded-br-lg" : "rounded-bl-lg"}
        />
      );
      break;
    default:
      content = <TextBubble text={m.body ?? ""} mine={mine} />;
  }

  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div className="max-w-[82%]">{content}</div>
      <span className="mt-0.5 px-2 text-[11px] text-muted" title={mine ? myName : partnerName}>
        {time}
      </span>
    </div>
  );
}

function TextBubble({ text, mine, muted }: { text: string; mine: boolean; muted?: boolean }) {
  const onlyEmoji = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\s){1,8}$/u.test(text) && !/\d/.test(text);
  if (onlyEmoji && !muted) return <p className="px-1 text-5xl leading-tight">{text}</p>;
  return (
    <div
      className={cn(
        "whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 leading-snug",
        muted
          ? "border border-line bg-card-2 text-muted"
          : mine
            ? "rounded-br-lg bg-accent text-accent-ink"
            : "rounded-bl-lg border border-line bg-card text-ink",
      )}
    >
      {text}
    </div>
  );
}
