"use client";

import { useState } from "react";
import { cn, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { alignes4Outcome, alignes4Play, alignes4Winner, COLS, dropRow, idx, normalizeGrid, ROWS } from "@/lib/jeux/alignes4";
import { GAME_META, isMyTurn, markOf, opponentOf } from "@/lib/jeux/games";
import type { Game } from "@/lib/types";
import { errorText, notifyGame, updateGame } from "./data";
import { GameFrame } from "./GameFrame";

const PIECE = ["bg-accent", "bg-sand"];

export function Alignes4Game({ game, onChange }: { game: Game; onChange: (g: Game) => void }) {
  const { me } = useFamily();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const grid = normalizeGrid(game.state.grid);
  const win = alignes4Winner(grid);
  const myTurn = isMyTurn(game, me.id);
  const last = typeof game.state.last === "number" ? game.state.last : -1;
  const myMark = markOf(game, me.id);

  async function play(col: number) {
    if (!myTurn || busy || dropRow(grid, col) < 0) return;
    setBusy(true);
    try {
      const updated = await updateGame(game.id, (g) => {
        if (g.turn !== me.id || g.status !== "active") return null;
        const r = alignes4Play(normalizeGrid(g.state.grid), col, markOf(g, me.id));
        if (!r) return null;
        const out = alignes4Outcome(r.grid);
        return {
          state: { ...g.state, grid: r.grid, last: r.index },
          turn: out.status === "playing" ? opponentOf(g, me.id) : null,
          status: out.status === "playing" ? "active" : "finished",
          winner: out.status === "won" ? me.id : null,
        };
      });
      if (updated) {
        onChange(updated);
        if (updated.status === "finished") {
          notifyGame(updated, updated.winner ? `🏆 ${me.display_name} a gagné à 4 alignés` : "🤝 Égalité à 4 alignés !", "Une revanche ?");
        } else {
          notifyGame(updated, GAME_META.alignes4.turnTitle, `${me.display_name} a lâché un jeton.`);
        }
      }
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GameFrame
      game={game}
      marks={[<span key="a" className={cn("inline-block size-4 rounded-full", PIECE[0])} />, <span key="b" className={cn("inline-block size-4 rounded-full", PIECE[1])} />]}
    >
      <style>{`@keyframes jeux-drop { 0% { transform: translateY(var(--drop)); } 70% { transform: translateY(0); } 85% { transform: translateY(-8%); } 100% { transform: translateY(0); } }`}</style>
      {myTurn && (
        <p className="mb-2 text-center text-sm text-muted">
          Touche une colonne pour lâcher ton jeton <span className={cn("inline-block size-3 rounded-full align-middle", PIECE[myMark])} />
        </p>
      )}
      <div className="mx-auto flex w-full max-w-md gap-1 rounded-3xl bg-sky p-2 shadow-inner">
        {Array.from({ length: COLS }, (_, col) => {
          const full = dropRow(grid, col) < 0;
          return (
            <button
              key={col}
              type="button"
              onClick={() => play(col)}
              disabled={!myTurn || busy || full}
              aria-label={`Colonne ${col + 1}`}
              className={cn("flex flex-1 flex-col gap-1 rounded-2xl p-0.5 transition", myTurn && !full && "active:bg-white/15")}
            >
              {Array.from({ length: ROWS }, (_, row) => {
                const i = idx(row, col);
                const v = grid[i];
                return (
                  <span key={row} className="relative block aspect-square w-full rounded-full bg-bg">
                    {v !== null && (
                      <span
                        className={cn(
                          "absolute inset-[6%] rounded-full shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)]",
                          PIECE[v],
                          i === last && "z-10",
                          win?.line.includes(i) && "ring-4 ring-white/80",
                        )}
                        style={
                          i === last
                            ? ({ "--drop": `-${(row + 1) * 120}%`, animation: "jeux-drop 0.55s cubic-bezier(.3,.1,.5,1) both" } as React.CSSProperties)
                            : undefined
                        }
                      />
                    )}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
    </GameFrame>
  );
}
