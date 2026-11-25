"use client";

import { PageHeader } from "@/components/ui";
import { PairedDeck } from "@/components/jeux/PairedDeck";
import { QuiForm, QuiPrompt, QuiReveal } from "@/components/jeux/paired-games";
import { QUI } from "@/content/jeux/qui";

export default function QuiPage() {
  return (
    <>
      <PageHeader title="👉 Qui de nous deux ?" subtitle="Désigne l'un de vous deux, en toute honnêteté" back="/jeux" />
      <PairedDeck game="qui" label="Qui de nous deux ?" items={QUI} url="/jeux/qui" Prompt={QuiPrompt} Form={QuiForm} Reveal={QuiReveal} />
    </>
  );
}
