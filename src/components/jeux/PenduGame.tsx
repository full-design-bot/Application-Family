"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, cn, useToast } from "@/components/ui";
import { MOTS_PENDU } from "@/content/jeux/mots";
import { useFamily } from "@/lib/family";
import { GAME_META, isMyTurn, ownerOf } from "@/lib/jeux/games";
import { AZERTY, letterStatus, MAX_WRONG } from "@/lib/jeux/mots";
import { supabase } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";
import { errorText, fetchGame, getMySecret, notifyGame } from "./data";
import { GameFrame } from "./GameFrame";
import { WordSetup } from "./WordSetup";

/** Dessin progressif du pendu (7 étapes). */
export function PenduDrawing({ wrong, max = MAX_WRONG, lost }: { wrong: number; max?: number; lost?: boolean }) {
  const step = Math.round((Math.min(wrong, max) / max) * 7);
  const show = (n: number) => step >= n;
  const line = "stroke-ink";
  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-44 w-44" fill="none" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" aria-label={`${wrong} erreur(s) sur ${max}`}>
      <path d="M30 185 H120" className="stroke-line" />
      {show(1) && <path d="M30 185 H120 M60 185 V20" className={cn(line, "animate-pop")} />}
      {show(2) && <path d="M60 20 H140 M60 55 L95 20 M140 20 V45" className={line} />}
      {show(3) && <circle cx="140" cy="62" r="17" className={line} />}
      {show(4) && <path d="M140 79 V130" className={line} />}
      {show(5) && <path d="M140 92 L115 115 M140 92 L165 115" className={line} />}
      {show(6) && <path d="M140 130 L120 165 M140 130 L160 165" className={line} />}
      {show(7) && (
        <path d={lost ? "M132 56 l6 6 m0 -6 l-6 6 M144 56 l6 6 m0 -6 l-6 6" : "M133 59 h1 M147 59 h1 M134 70 q6 -4 12 0"} className={line} strokeWidth={3} />
      )}
    </svg>
  );
}

function Revealed({ text }: { text: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {[...text].map((ch, i) =>
        ch === " " ? (
          <span key={i} className="w-3" />
        ) : (
          <span
            key={i}
            className={cn(
              "flex h-11 w-8 items-end justify-center border-b-4 pb-1 text-2xl font-bold",
              ch === "_" ? "border-line text-transparent" : "border-accent text-ink",
            )}
          >
            {ch === "_" ? "·" : ch}
          </span>
        ),
      )}
    </div>
  );
}

export function PenduGame({ game, onChange }: { game: Game; onChange: (g: Game) => void }) {
  const { me, nameOf } = useFamily();
  const toast = useToast();
  const owner = ownerOf(game);
  const iOwn = owner === me.id;
  const [myWord, setMyWord] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState("");

  const letters = Array.isArray(game.state.letters) ? (game.state.letters as string[]) : [];
  const wrong = Number(game.state.wrong ?? 0);
  const maxWrong = Number(game.state.max_wrong ?? MAX_WRONG);
  const revealed = typeof game.state.revealed === "string" ? game.state.revealed : "";
  const finalWord = typeof game.state.word === "string" ? game.state.word : null;
  const canGuess = isMyTurn(game, me.id) && game.status === "active" && !iOwn;

  useEffect(() => {
    if (iOwn && game.status !== "setup") getMySecret<{ word?: string }>(game.id, me.id).then((s) => setMyWord(s?.word ?? null));
  }, [iOwn, game.id, game.status, me.id]);

  async function guess(value: string) {
    if (!canGuess || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase().rpc("word_guess", { p_game: game.id, p_guess: value });
      if (error) throw error;
      const g = await fetchGame(game.id);
      if (g) {
        onChange(g);
        if (g.status === "finished") {
          if (g.winner === me.id) {
            toast("🎉 Bravo, tu as trouvé !", "success");
            notifyGame(g, `🔤 ${me.display_name} a trouvé ton mot !`, `C'était « ${g.state.word ?? ""} ». Revanche ?`);
          } else {
            notifyGame(g, `🔤 ${me.display_name} n'a pas trouvé ton mot 😈`, "Une revanche ?");
          }
        } else if (value.length > 1) {
          toast("Ce n'est pas ça… 🙈", "error");
        }
      }
      setFull("");
      return data;
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  if (game.status === "setup") {
    return (
      <GameFrame game={game}>
        {iOwn ? (
          <WordSetup
            game={game}
            words={MOTS_PENDU}
            allowCustom
            intro={`Choisis un mot secret que ${nameOf(game.players.find((p) => p !== me.id))} devra deviner (ou tire-le au sort).`}
            startLabel="C'est parti !"
            notifyTitle={GAME_META.pendu.turnTitle}
            notifyBody={`${me.display_name} a choisi un mot. Sept erreurs permises !`}
            onChange={onChange}
          />
        ) : (
          <Card className="py-8 text-center">
            <p className="text-4xl">🤫</p>
            <p className="mt-2 font-semibold">{nameOf(owner)} choisit un mot secret…</p>
            <p className="text-sm text-muted">Tu recevras une notification quand ce sera à toi.</p>
          </Card>
        )}
      </GameFrame>
    );
  }

  return (
    <GameFrame game={game}>
      <Card className="space-y-4">
        <PenduDrawing wrong={wrong} max={maxWrong} lost={game.status === "finished" && game.winner === owner} />
        <p className="text-center text-sm text-muted">
          Erreurs : <span className="font-bold text-ink">{wrong}</span> / {maxWrong}
        </p>
        <Revealed text={game.status === "finished" && finalWord ? finalWord : revealed} />
        {iOwn && myWord && game.status !== "finished" && (
          <p className="text-center text-sm text-muted">
            Ton mot : <span className="font-bold text-ink">{myWord}</span>
          </p>
        )}
      </Card>

      <div className="mt-4 space-y-1.5">
        {AZERTY.map((row, r) => (
          <div key={r} className="flex justify-center gap-1">
            {row.map((L) => {
              const st = letterStatus(L, revealed, letters);
              return (
                <button
                  key={L}
                  type="button"
                  onClick={() => guess(L)}
                  disabled={!canGuess || busy || st !== "untried"}
                  className={cn(
                    "h-12 w-[9%] min-w-8 rounded-xl text-lg font-bold transition",
                    st === "untried" && "bg-card text-ink shadow-sm active:scale-90 active:bg-accent-soft",
                    st === "hit" && "bg-sage text-white",
                    st === "miss" && "bg-card-2 text-muted line-through",
                    !canGuess && st === "untried" && "opacity-60",
                  )}
                >
                  {L}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {canGuess && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (full.trim().length > 1) guess(full.trim());
          }}
        >
          <Input value={full} onChange={(e) => setFull(e.target.value)} placeholder="Tu as trouvé ? Tape le mot" autoComplete="off" autoCorrect="off" />
          <Button type="submit" disabled={full.trim().length < 2} loading={busy}>
            Proposer
          </Button>
        </form>
      )}
      {canGuess && <p className="mt-2 text-center text-xs text-muted">Attention, un mauvais mot compte comme une erreur.</p>}
    </GameFrame>
  );
}
