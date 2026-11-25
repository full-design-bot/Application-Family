"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar, cn } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { isMyTurn, metaOf, opponentOf, statusLine } from "@/lib/jeux/games";
import { fromNow } from "@/lib/dates";
import type { Game } from "@/lib/types";
import { gameUrl } from "./data";

/** Une ligne « partie » (liste du hub, carte de l'accueil). */
export function GameRow({ game, compact }: { game: Game; compact?: boolean }) {
  const { me, nameOf, personOf } = useFamily();
  const meta = metaOf(game.type);
  const mine = isMyTurn(game, me.id);
  const other = opponentOf(game, me.id);
  return (
    <Link
      href={gameUrl(game.id)}
      className={cn(
        "flex items-center gap-3 rounded-3xl border p-3 transition active:scale-[0.99]",
        mine ? "border-transparent bg-accent text-accent-ink shadow-sm" : "border-line bg-card",
      )}
    >
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl text-2xl", mine ? "bg-white/20" : meta.color)}>
        {meta.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {meta.label}
          {!compact && <span className={cn("font-normal", mine ? "opacity-80" : "text-muted")}> · avec {nameOf(other)}</span>}
        </span>
        <span className={cn("block truncate text-sm", mine ? "font-semibold" : "text-muted")}>
          {statusLine(game, me.id, nameOf)}
          {!mine && !compact && <> · {fromNow(game.updated_at)}</>}
        </span>
      </span>
      {!compact && <Avatar person={personOf(other)} size={28} />}
      <ChevronRight className={cn("size-5 shrink-0", mine ? "opacity-80" : "text-muted")} />
    </Link>
  );
}
