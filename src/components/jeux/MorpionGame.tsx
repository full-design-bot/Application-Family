"use client";

import { useState } from "react";
import { cn, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { GAME_META, isMyTurn, markOf, opponentOf } from "@/lib/jeux/games";
import { morpionOutcome, morpionPlay, morpionWinner, normalizeMorpion } from "@/lib/jeux/morpion";
import type { Game } from "@/lib/types";
import { errorText, notifyGame, updateGame } from "./data";
import { GameFrame } from "./GameFrame";

export const MORPION_MARKS: [string, string] = ["❌", "⭕"];

export function MorpionGame({ game, onChange }: { game: Game; onChange: (g: Game) => void }) {
  const { me } = useFamily();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const board = normalizeMorpion(game.state.board);
  const win = morpionWinner(board);
  const myTurn = isMyTurn(game, me.id);
  const last = typeof game.state.last === "number" ? game.state.last : -1;

  async function play(index: number) {
    if (!myTurn || busy || board[index] !== null) return;
    setBusy(true);
    try {
      const updated = await updateGame(game.id, (g) => {
        if (g.turn !== me.id || g.status !== "active") return null;
        const b = morpionPlay(normalizeMorpion(g.state.board), index, markOf(g, me.id));
        if (!b) return null;
        const out = morpionOutcome(b);
        const other = opponentOf(g, me.id);
        return {
          state: { ...g.state, board: b, last: index },
          turn: out.status === "playing" ? other : null,
          status: out.status === "playing" ? "active" : "finished",
          winner: out.status === "won" ? me.id : null,
        };
      });
      if (updated) {
        onChange(updated);
        if (updated.status === "finished") {
          notifyGame(updated, updated.winner ? `🏆 ${me.display_name} a gagné au morpion` : "🤝 Égalité au morpion !", "Une revanche ?");
        } else {
          notifyGame(updated, GAME_META.morpion.turnTitle, `${me.display_name} a joué.`);
        }
      }
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GameFrame game={game} marks={MORPION_MARKS}>
      <div className="mx-auto grid aspect-square w-full max-w-sm grid-cols-3 gap-2 rounded-3xl bg-card-2 p-2">
        {board.map((cell, i) => {
          const inLine = win?.line.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => play(i)}
              disabled={!myTurn || cell !== null || busy}
              aria-label={`Case ${i + 1}`}
              className={cn(
                "flex items-center justify-center rounded-2xl bg-card text-5xl transition",
                myTurn && cell === null && "active:scale-95 active:bg-accent-soft",
                inLine && "bg-sage-soft ring-2 ring-sage",
              )}
            >
              {cell !== null && <span className={cn(i === last && "animate-pop")}>{MORPION_MARKS[cell]}</span>}
            </button>
          );
        })}
      </div>
    </GameFrame>
  );
}
