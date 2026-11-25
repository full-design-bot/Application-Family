"use client";

import { PageHeader } from "@/components/ui";
import { PairedDeck } from "@/components/jeux/PairedDeck";
import { DilemmeForm, DilemmePrompt, DilemmeReveal } from "@/components/jeux/paired-games";
import { TU_PREFERES } from "@/content/jeux/tu-preferes";

export default function TuPreferesPage() {
  return (
    <>
      <PageHeader title="⚖️ Tu préfères…" subtitle="Faites-vous les mêmes choix ?" back="/jeux" />
      <PairedDeck
        game="tupreferes"
        label="Tu préfères…"
        items={TU_PREFERES}
        url="/jeux/tu-preferes"
        Prompt={DilemmePrompt}
        Form={DilemmeForm}
        Reveal={DilemmeReveal}
      />
    </>
  );
}
