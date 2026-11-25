"use client";

import { Dices, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button, Card, Input, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { cleanWord, validateWord } from "@/lib/jeux/mots";
import { pickDifferent } from "@/lib/jeux/random";
import { supabase } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";
import { errorText, fetchGame, notifyGame, setSecret } from "./data";

/** Le propriétaire du mot le choisit (ou le tire au sort), puis la partie démarre. */
export function WordSetup({
  game,
  words,
  allowCustom,
  intro,
  startLabel,
  notifyTitle,
  notifyBody,
  onChange,
}: {
  game: Game;
  words: readonly string[];
  allowCustom: boolean;
  intro: string;
  startLabel: string;
  notifyTitle: string;
  notifyBody: string;
  onChange: (g: Game) => void;
}) {
  const { me } = useFamily();
  const toast = useToast();
  const [word, setWord] = useState(() => (allowCustom ? "" : pickDifferent(words, null)));
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const error = word ? validateWord(word) : null;

  async function start() {
    const err = validateWord(word);
    if (err) {
      toast(err, "error");
      return;
    }
    setBusy(true);
    try {
      await setSecret(game.id, me.id, { word: cleanWord(word) });
      const { error: e } = await supabase().rpc("word_init", { p_game: game.id });
      if (e) throw e;
      const g = await fetchGame(game.id);
      if (g) onChange(g);
      notifyGame(game, notifyTitle, notifyBody);
    } catch (e) {
      toast(errorText(e), "error");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <p className="text-center text-muted">{intro}</p>
      {allowCustom ? (
        <div className="relative">
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Ton mot secret"
            type={hidden ? "password" : "text"}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={24}
            className="pr-12 text-center text-xl font-bold tracking-widest uppercase"
          />
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted"
            aria-label={hidden ? "Afficher le mot" : "Masquer le mot"}
          >
            {hidden ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-accent-soft py-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ton mot à dessiner</p>
          <p className="mt-1 text-3xl font-bold uppercase text-accent">{word}</p>
        </div>
      )}
      {error && <p className="text-center text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setWord((w) => pickDifferent(words, w))}>
          <Dices className="size-4" /> {allowCustom ? "Au hasard" : "Un autre"}
        </Button>
        <Button className="flex-1" onClick={start} loading={busy} disabled={!word || !!error}>
          {startLabel}
        </Button>
      </div>
    </Card>
  );
}
