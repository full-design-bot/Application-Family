"use client";

import { Send, SkipForward } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, Chip, cn, useToast } from "@/components/ui";
import { CoquinsPage, LevelPill, notifyCoquin, useSpicyLevel } from "@/components/jeux/coquins/shell";
import { errorText } from "@/components/jeux/data";
import { ACTION_VERITE } from "@/content/jeux/action-verite";
import type { ActionVerite } from "@/content/jeux/types";
import { useFamily } from "@/lib/family";
import { LEVELS, levelsUpTo, type SpicyLevel } from "@/lib/jeux/niveau";
import { pick } from "@/lib/jeux/random";
import { supabase } from "@/lib/supabase/client";

function Jeu() {
  const { me, partner } = useFamily();
  const { level } = useSpicyLevel();
  const toast = useToast();
  const [chosen, setChosen] = useState<SpicyLevel | null>(null);
  const current = chosen && chosen <= level ? chosen : level;
  const [card, setCard] = useState<ActionVerite | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [turn, setTurn] = useState<"me" | "partner">("me");
  const [sending, setSending] = useState(false);

  const pool = useMemo(() => ACTION_VERITE.filter((x) => x.level === current), [current]);

  function draw(kind: ActionVerite["kind"]) {
    const options = pool.filter((x) => x.kind === kind);
    let fresh = options.filter((x) => !seen.includes(x.key) && x.key !== card?.key);
    if (fresh.length === 0) {
      fresh = options.filter((x) => x.key !== card?.key);
      setSeen([]);
    }
    const next = pick(fresh);
    setSeen((s) => [...s, next.key]);
    setCard(next);
  }

  function done() {
    setCard(null);
    setTurn((t) => (t === "me" ? "partner" : "me"));
  }

  async function send() {
    if (!card || !partner) return;
    setSending(true);
    try {
      const text = card.kind === "verite" ? `💬 Vérité : ${card.text}` : card.text;
      const { error } = await supabase().from("challenges").insert({ from_id: me.id, to_id: partner.id, text, level: card.level });
      if (error) throw error;
      notifyCoquin("defis");
      toast(`Envoyé à ${partner.display_name} 😏`, "success");
      done();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setSending(false);
    }
  }

  const who = turn === "me" ? "Toi" : partner?.display_name ?? "L'autre";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {levelsUpTo(level).map((l) => (
          <Chip key={l} active={current === l} onClick={() => setChosen(l)}>
            {LEVELS[l].emoji} {LEVELS[l].label}
          </Chip>
        ))}
      </div>

      <p className="text-center text-muted">
        C&apos;est au tour de <span className="font-bold text-ink">{who}</span> !
      </p>

      {card ? (
        <Card key={card.key} className={cn("animate-pop space-y-4 py-8 text-center", card.kind === "action" ? "bg-accent-soft" : "bg-sky-soft")}>
          <p className="text-sm font-bold uppercase tracking-widest text-muted">{card.kind === "action" ? "🔥 Action" : "💬 Vérité"}</p>
          <p className="px-2 text-2xl font-bold leading-snug">{card.text}</p>
          <LevelPill level={card.level} className="bg-card" />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => draw("action")} className="rounded-3xl bg-accent-soft py-10 text-center transition active:scale-95">
            <span className="block text-5xl">🔥</span>
            <span className="mt-2 block text-lg font-bold">Action</span>
          </button>
          <button type="button" onClick={() => draw("verite")} className="rounded-3xl bg-sky-soft py-10 text-center transition active:scale-95">
            <span className="block text-5xl">💬</span>
            <span className="mt-2 block text-lg font-bold">Vérité</span>
          </button>
        </div>
      )}

      {card && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => draw(card.kind)}>
              <SkipForward className="size-4" /> Passer
            </Button>
            <Button onClick={done}>C&apos;est fait ✅</Button>
          </div>
          {partner && (
            <Button variant="ghost" className="w-full" onClick={send} loading={sending}>
              <Send className="size-4" /> L&apos;envoyer à {partner.display_name} pour plus tard
            </Button>
          )}
        </div>
      )}

      <p className="text-center text-xs text-muted">« Passer » est toujours permis, sans avoir à se justifier 💛</p>
    </div>
  );
}

export default function ActionVeritePage() {
  return (
    <CoquinsPage title="🔥 Action ou vérité" subtitle="Côte à côte… ou en visio">
      <Jeu />
    </CoquinsPage>
  );
}
