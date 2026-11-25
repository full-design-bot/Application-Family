"use client";

import { use } from "react";
import { EmptyState, LinkButton, LoadingBlock, PageHeader } from "@/components/ui";
import { Alignes4Game } from "@/components/jeux/Alignes4Game";
import { BatailleGame } from "@/components/jeux/BatailleGame";
import { DessinGame } from "@/components/jeux/DessinGame";
import { useGame } from "@/components/jeux/hooks";
import { MorpionGame } from "@/components/jeux/MorpionGame";
import { PenduGame } from "@/components/jeux/PenduGame";

export default function PartiePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { game, setGame, loading, missing } = useGame(id);

  if (loading) {
    return (
      <>
        <PageHeader title="Partie" back="/jeux" />
        <LoadingBlock />
      </>
    );
  }

  if (!game || missing) {
    return (
      <>
        <PageHeader title="Partie" back="/jeux" />
        <EmptyState
          emoji="🫥"
          title="Partie introuvable"
          text="Elle a peut-être été supprimée."
          action={<LinkButton href="/jeux">Retour aux jeux</LinkButton>}
        />
      </>
    );
  }

  const props = { game, onChange: setGame };
  switch (game.type) {
    case "morpion":
      return <MorpionGame key={game.id} {...props} />;
    case "alignes4":
      return <Alignes4Game key={game.id} {...props} />;
    case "bataille":
      return <BatailleGame key={game.id} {...props} />;
    case "pendu":
      return <PenduGame key={game.id} {...props} />;
    case "dessin":
      return <DessinGame key={game.id} {...props} />;
    default:
      return (
        <>
          <PageHeader title="Partie" back="/jeux" />
          <EmptyState emoji="🎲" title="Jeu inconnu" />
        </>
      );
  }
}
