"use client";

import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Avatar, Button, IconButton, PageHeader, Sheet, cn, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { GAME_META, isMyTurn, metaOf, opponentOf, rematchRow, resultFor, statusLine } from "@/lib/jeux/games";
import type { Game } from "@/lib/types";
import { createGame, deleteGame, errorText, gameUrl, notifyGame } from "./data";

/** Habillage commun d'une partie : joueurs, statut, revanche, suppression. */
export function GameFrame({
  game,
  marks,
  children,
}: {
  game: Game;
  /** symbole de chaque joueur (morpion, 4 alignés) */
  marks?: [React.ReactNode, React.ReactNode];
  children: React.ReactNode;
}) {
  const { me, nameOf, personOf } = useFamily();
  const router = useRouter();
  const toast = useToast();
  const meta = metaOf(game.type);
  const other = opponentOf(game, me.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const myTurn = isMyTurn(game, me.id);
  const result = resultFor(game, me.id);
  const label = (id: string | null) => (id === me.id ? "toi" : nameOf(id));

  async function rematch() {
    const row = rematchRow(game, me.id);
    if (!row) return;
    setBusy(true);
    try {
      const g = await createGame(row);
      const m = GAME_META[row.type];
      if ((row.type === "pendu" || row.type === "dessin") && row.state.owner !== me.id) {
        notifyGame(g, `${m.emoji} Revanche au ${m.label.toLowerCase()} !`, `${me.display_name} t'attend : à toi de ${row.type === "dessin" ? "dessiner" : "choisir un mot"} !`);
      } else if (row.type === "bataille") {
        notifyGame(g, "⚓ Revanche à la bataille navale !", `${me.display_name} t'attend : place tes bateaux.`);
      } else if (row.turn !== me.id) {
        notifyGame(g, m.turnTitle, `${me.display_name} veut sa revanche !`);
      }
      router.push(gameUrl(g.id));
    } catch (e) {
      toast(errorText(e), "error");
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteGame(game.id);
      router.push("/jeux");
    } catch (e) {
      toast(errorText(e), "error");
      setBusy(false);
    }
  }

  const seat = (id: string | null, i: 0 | 1) => {
    const active = !!id && game.status !== "finished" && game.turn === id && game.status === "active";
    return (
      <div className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-2 py-1.5 transition", active && "bg-accent-soft")}>
        <Avatar person={personOf(id)} size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{id === me.id ? "Toi" : nameOf(id)}</p>
          {marks && <p className="text-lg leading-none">{marks[i]}</p>}
        </div>
        {game.winner === id && <span className="ml-auto text-lg">🏆</span>}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={`${meta.emoji} ${meta.label}`}
        back="/jeux"
        action={
          <IconButton label="Supprimer la partie" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-5 text-muted" />
          </IconButton>
        }
      />

      <div className="mb-3 flex items-center gap-2 rounded-3xl border border-line bg-card p-2">
        {seat(game.players[0] ?? null, 0)}
        <span className="text-xs font-bold text-muted">VS</span>
        {seat(game.players[1] ?? null, 1)}
      </div>

      <div
        className={cn(
          "mb-4 rounded-2xl px-4 py-3 text-center font-semibold",
          result === "win" ? "bg-sage-soft text-ink" : result ? "bg-card-2" : myTurn ? "animate-pop bg-accent text-accent-ink" : "bg-card-2 text-muted",
        )}
        key={`${game.status}-${game.turn}`}
      >
        {statusLine(game, me.id, label)}
      </div>

      {children}

      {game.status === "finished" && other && (
        <div className="mt-6 flex gap-2">
          <Button className="flex-1" size="lg" onClick={rematch} loading={busy}>
            <RotateCcw className="size-5" /> Revanche !
          </Button>
        </div>
      )}

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer la partie ?">
        <p className="mb-4 text-muted">
          La partie disparaîtra pour vous deux{game.status !== "finished" ? " (elle n'est pas terminée)" : ""}.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
            Annuler
          </Button>
          <Button variant="danger" className="flex-1" onClick={remove} loading={busy}>
            Supprimer
          </Button>
        </div>
      </Sheet>
    </>
  );
}
