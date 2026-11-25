"use client";

import { Card, PageHeader } from "@/components/ui";
import { PairedDeck } from "@/components/jeux/PairedDeck";
import { Q36Form, Q36Prompt, Q36Reveal } from "@/components/jeux/paired-games";
import { QUESTIONS_36 } from "@/content/jeux/questions36";

export default function Questions36Page() {
  return (
    <>
      <PageHeader title="💬 Les 36 questions" subtitle="Pour se rapprocher, encore et encore" back="/jeux" />
      <Card className="mb-4 bg-rose-soft text-sm">
        Inspirées d&apos;une célèbre étude du psychologue Arthur Aron : trois séries de douze questions, de plus en plus
        intimes. Répondez à votre rythme, par écrit : la réponse de l&apos;autre se dévoile une fois la tienne envoyée.
        Votre progression est sauvegardée.
      </Card>
      <PairedDeck
        game="36q"
        label="Les 36 questions"
        items={QUESTIONS_36}
        ordered
        url="/jeux/36-questions"
        Prompt={Q36Prompt}
        Form={Q36Form}
        Reveal={Q36Reveal}
      />
    </>
  );
}
