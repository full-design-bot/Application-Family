"use client";

import { useMemo } from "react";
import { CoquinsPage, LevelPill, useSpicyLevel } from "@/components/jeux/coquins/shell";
import { PairedDeck } from "@/components/jeux/PairedDeck";
import { DilemmeForm, DilemmeReveal } from "@/components/jeux/paired-games";
import { TU_PREFERES_HOT } from "@/content/jeux/tu-preferes-hot";
import type { DilemmeHot } from "@/content/jeux/types";
import { withinLevel } from "@/lib/jeux/niveau";

function HotPrompt({ item }: { item: DilemmeHot }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xl font-bold">Tu préfères…</p>
      <LevelPill level={item.level} />
    </div>
  );
}

function Deck() {
  const { level } = useSpicyLevel();
  const items = useMemo(() => withinLevel(TU_PREFERES_HOT, level), [level]);
  return (
    <PairedDeck
      key={level}
      game="tupreferes_hot"
      label="Tu préfères… hot"
      items={items}
      url="/jeux/coquins/tu-preferes"
      discreet
      Prompt={HotPrompt}
      Form={DilemmeForm}
      Reveal={DilemmeReveal}
    />
  );
}

export default function TuPreferesHotPage() {
  return (
    <CoquinsPage title="⚖️ Tu préfères… hot" subtitle="Vos réponses se dévoilent quand vous avez répondu tous les deux">
      <Deck />
    </CoquinsPage>
  );
}
