"use client";

import Link from "next/link";
import { useFamily } from "@/lib/family";
import { GameRow } from "./GameRow";
import { useMyTurnGames, usePairedPending } from "./hooks";

const DISCOVERY = ["devine", "qui", "tupreferes", "36q"];

/**
 * Carte pour l'accueil : parties où c'est mon tour + questions en attente.
 * Ne rend rien s'il n'y a rien à faire.
 *   <GamesTurnCard />
 */
export function GamesTurnCard({ max = 3 }: { max?: number }) {
  const { isParent } = useFamily();
  const { games } = useMyTurnGames();
  const { total } = usePairedPending(DISCOVERY);
  if (!isParent || (games.length === 0 && total === 0)) return null;
  return (
    <div className="space-y-2">
      {games.slice(0, max).map((g) => (
        <GameRow key={g.id} game={g} compact />
      ))}
      {games.length > max && (
        <Link href="/jeux" className="block px-1 text-sm font-semibold text-accent">
          + {games.length - max} autre{games.length - max > 1 ? "s" : ""} partie{games.length - max > 1 ? "s" : ""}
        </Link>
      )}
      {total > 0 && (
        <Link href="/jeux" className="flex items-center gap-3 rounded-3xl border border-line bg-sand-soft p-3 active:scale-[0.99]">
          <span className="text-2xl">💡</span>
          <span className="flex-1 text-sm">
            <span className="font-semibold">{total} question{total > 1 ? "s" : ""}</span> t&apos;attend{total > 1 ? "ent" : ""} pour mieux vous connaître
          </span>
        </Link>
      )}
    </div>
  );
}
