"use client";

import { PageHeader } from "@/components/ui";
import { PairedDeck } from "@/components/jeux/PairedDeck";
import { DevineForm, DevinePrompt, DevineReveal } from "@/components/jeux/paired-games";
import { DEVINE } from "@/content/jeux/devine";

export default function DevinePage() {
  return (
    <>
      <PageHeader title="🔮 Devine ma réponse" subtitle="Réponds pour toi, puis devine sa réponse" back="/jeux" />
      <PairedDeck
        game="devine"
        label="Devine ma réponse"
        items={DEVINE}
        url="/jeux/devine"
        Prompt={DevinePrompt}
        Form={DevineForm}
        Reveal={DevineReveal}
      />
    </>
  );
}
