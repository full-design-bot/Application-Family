"use client";

import { Dices, Eraser, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, LoadingBlock, SectionTitle, cn, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import {
  cellName,
  FLEET,
  fleetStatus,
  isFleetValid,
  placeShip,
  randomFleet,
  shotsOf,
  SIZE,
  sunkCount,
  type PlacedShip,
  type Shot,
} from "@/lib/jeux/bataille";
import { GAME_META, isMyTurn, opponentOf, readyList } from "@/lib/jeux/games";
import { supabase } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";
import { errorText, getMySecret, notifyGame, setSecret, updateGame } from "./data";
import { GameFrame } from "./GameFrame";

type CellLook = "water" | "ship" | "hit" | "miss" | "sunk" | "preview";

function Grid({
  looks,
  onCell,
  disabled,
  small,
  highlight,
}: {
  looks: (c: number) => CellLook;
  onCell?: (c: number) => void;
  disabled?: boolean;
  small?: boolean;
  highlight?: number | null;
}) {
  return (
    <div className={cn("mx-auto grid w-full grid-cols-10 gap-[3px] rounded-2xl bg-sky/30 p-1.5", small ? "max-w-[260px]" : "max-w-md")}>
      {Array.from({ length: SIZE * SIZE }, (_, c) => {
        const look = looks(c);
        return (
          <button
            key={c}
            type="button"
            aria-label={cellName(c)}
            disabled={disabled || !onCell}
            onClick={() => onCell?.(c)}
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-[6px] text-[11px] leading-none transition",
              look === "water" && "bg-sky-soft",
              look === "ship" && "bg-sky",
              look === "preview" && "bg-accent/60",
              look === "miss" && "bg-sky-soft",
              look === "hit" && "bg-accent",
              look === "sunk" && "bg-danger",
              !disabled && onCell && "active:scale-90",
              highlight === c && "ring-2 ring-ink",
            )}
          >
            {look === "miss" && <span className="size-1.5 rounded-full bg-sky" />}
            {look === "hit" && <span className={cn(small ? "text-[9px]" : "text-sm")}>💥</span>}
            {look === "sunk" && <span className={cn(small ? "text-[9px]" : "text-sm")}>🔥</span>}
          </button>
        );
      })}
    </div>
  );
}

export function BatailleGame({ game, onChange }: { game: Game; onChange: (g: Game) => void }) {
  const { me, nameOf } = useFamily();
  const toast = useToast();
  const other = opponentOf(game, me.id);
  const ready = readyList(game);
  const iAmReady = ready.includes(me.id);
  const [ships, setShips] = useState<PlacedShip[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadSecret = useCallback(async () => {
    const s = await getMySecret<{ ships?: PlacedShip[] }>(game.id, me.id);
    setShips(s?.ships ?? null);
    setLoaded(true);
  }, [game.id, me.id]);

  useEffect(() => {
    loadSecret();
  }, [loadSecret]);

  if (!loaded) return <GameFrame game={game}><LoadingBlock /></GameFrame>;

  if (game.status === "setup" && (!iAmReady || !ships)) {
    return (
      <GameFrame game={game}>
        <Placement
          initial={ships}
          busy={busy}
          onReady={async (fleet) => {
            setBusy(true);
            try {
              await setSecret(game.id, me.id, { ships: fleet });
              setShips(fleet);
              const updated = await updateGame(game.id, (g) => {
                const r = Array.from(new Set([...readyList(g), me.id]));
                const both = g.players.every((p) => r.includes(p));
                return { state: { ...g.state, ready: r }, status: both && g.status === "setup" ? "active" : g.status };
              });
              if (updated) {
                onChange(updated);
                if (updated.status === "active") {
                  if (updated.turn !== me.id) notifyGame(updated, GAME_META.bataille.turnTitle, "Les deux flottes sont prêtes, ouvre le feu !");
                } else {
                  notifyGame(updated, "⚓ Bataille navale", `${me.display_name} a placé ses bateaux, à ton tour de placer les tiens !`);
                }
              }
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        />
      </GameFrame>
    );
  }

  return (
    <GameFrame game={game}>
      <Battle game={game} ships={ships ?? []} other={other} otherName={nameOf(other)} onChange={onChange} />
    </GameFrame>
  );
}

function Placement({ initial, onReady, busy }: { initial: PlacedShip[] | null; onReady: (ships: PlacedShip[]) => void; busy: boolean }) {
  const [ships, setShips] = useState<PlacedShip[]>(initial ?? []);
  const [selected, setSelected] = useState<string | null>(FLEET.find((m) => !(initial ?? []).some((s) => s.id === m.id))?.id ?? null);
  const [horizontal, setHorizontal] = useState(true);
  const toast = useToast();

  const owner = useMemo(() => {
    const map = new Map<number, string>();
    ships.forEach((s) => s.cells.forEach((c) => map.set(c, s.id)));
    return map;
  }, [ships]);

  function nextUnplaced(list: PlacedShip[], after?: string) {
    const free = FLEET.filter((m) => !list.some((s) => s.id === m.id));
    return free.find((m) => m.id !== after)?.id ?? null;
  }

  function tap(cell: number) {
    const hitShip = owner.get(cell);
    if (hitShip && hitShip !== selected) {
      // reprendre ce bateau pour le replacer
      const s = ships.find((x) => x.id === hitShip)!;
      setHorizontal(s.cells.length < 2 || s.cells[1] - s.cells[0] === 1);
      setShips(ships.filter((x) => x.id !== hitShip));
      setSelected(hitShip);
      return;
    }
    if (!selected) return;
    const model = FLEET.find((m) => m.id === selected)!;
    const placed = placeShip(ships, model, cell, horizontal);
    if (!placed) {
      toast("Pas la place ici 🙈 Essaie ailleurs ou tourne le bateau.", "error");
      return;
    }
    setShips(placed);
    setSelected(nextUnplaced(placed, model.id));
  }

  const complete = isFleetValid(ships);

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted">
        Choisis un bateau, puis touche la case de départ. Touche un bateau posé pour le déplacer.
      </p>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {FLEET.map((m) => {
          const placed = ships.some((s) => s.id === m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (placed) setShips(ships.filter((s) => s.id !== m.id));
                setSelected(m.id);
              }}
              className={cn(
                "shrink-0 rounded-2xl border px-3 py-2 text-left text-sm transition",
                selected === m.id ? "border-accent bg-accent-soft" : "border-line bg-card",
                placed && selected !== m.id && "opacity-50",
              )}
            >
              <span className="block font-semibold">{m.name}</span>
              <span className="mt-1 flex gap-0.5">
                {Array.from({ length: m.size }, (_, i) => (
                  <span key={i} className={cn("size-2.5 rounded-sm", placed ? "bg-sage" : "bg-sky")} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <Grid looks={(c) => (owner.has(c) ? "ship" : "water")} onCell={tap} />

      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={() => setHorizontal((h) => !h)}>
          <RotateCw className="size-4" /> {horizontal ? "Horizontal" : "Vertical"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const f = randomFleet();
            setShips(f);
            setSelected(null);
          }}
        >
          <Dices className="size-4" /> Hasard
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setShips([]);
            setSelected(FLEET[0].id);
          }}
        >
          <Eraser className="size-4" /> Effacer
        </Button>
      </div>

      <Button size="lg" className="w-full" disabled={!complete} loading={busy} onClick={() => onReady(ships)}>
        {complete ? "Ma flotte est prête ⚓" : `Encore ${FLEET.length - ships.length} bateau${FLEET.length - ships.length > 1 ? "x" : ""} à placer`}
      </Button>
    </div>
  );
}

function Battle({
  game,
  ships,
  other,
  otherName,
  onChange,
}: {
  game: Game;
  ships: PlacedShip[];
  other: string | null;
  otherName: string;
  onChange: (g: Game) => void;
}) {
  const { me } = useFamily();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const myShots = shotsOf(game.state, me.id);
  const enemyShots = other ? shotsOf(game.state, other) : [];
  const myTurn = isMyTurn(game, me.id);
  const waiting = game.status === "setup";

  const shotMap = new Map<number, Shot>(myShots.map((s) => [s.cell, s]));
  const enemyHits = new Map<number, Shot>(enemyShots.map((s) => [s.cell, s]));
  const myCells = new Set(ships.flatMap((s) => s.cells));
  const status = fleetStatus(ships, enemyShots);
  const sunkCells = new Set(status.filter((s) => s.sunk).flatMap((s) => s.cells));
  const lastEnemy = enemyShots.length ? enemyShots[enemyShots.length - 1].cell : null;
  const lastMine = myShots.length ? myShots[myShots.length - 1].cell : null;

  async function fire(cell: number) {
    if (!myTurn || busy || shotMap.has(cell)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase().rpc("battleship_fire", { p_game: game.id, p_cell: cell });
      if (error) throw error;
      const r = data as { hit: boolean; sunk: boolean; won: boolean };
      const text = r.won ? "🏆 Toute sa flotte est coulée, bravo !" : r.sunk ? "🔥 Coulé ! Rejoue !" : r.hit ? "💥 Touché ! Rejoue !" : "💧 Plouf… raté.";
      setLastResult(`${cellName(cell)} : ${text}`);
      toast(text, r.hit ? "success" : "info");
      const { data: g } = await supabase().from("games").select("*").eq("id", game.id).single();
      if (g) onChange(g as Game);
      if (r.won) notifyGame(game, `🏆 ${me.display_name} a gagné la bataille navale`, "Une revanche ?");
      else if (!r.hit) notifyGame(game, GAME_META.bataille.turnTitle, `${me.display_name} a tiré en ${cellName(cell)}… et raté !`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {waiting ? (
        <Card className="text-center">
          <p className="font-semibold">Ta flotte est prête ⚓</p>
          <p className="text-sm text-muted">On attend que {otherName} place ses bateaux…</p>
        </Card>
      ) : (
        <>
          <SectionTitle action={<span className="text-xs text-muted">Coulés : {sunkCount(myShots)}/{FLEET.length}</span>}>
            🎯 La flotte de {otherName}
          </SectionTitle>
          <Grid
            looks={(c) => {
              const s = shotMap.get(c);
              if (!s) return "water";
              return s.sunk ? "sunk" : s.hit ? "hit" : "miss";
            }}
            onCell={fire}
            disabled={!myTurn || busy || game.status !== "active"}
            highlight={lastMine}
          />
          {lastResult && <p className="text-center text-sm text-muted">{lastResult}</p>}
        </>
      )}

      <SectionTitle action={<span className="text-xs text-muted">Perdus : {status.filter((s) => s.sunk).length}/{FLEET.length}</span>}>
        🚢 Ma flotte
      </SectionTitle>
      <Grid
        small
        looks={(c) => {
          const s = enemyHits.get(c);
          if (s) return sunkCells.has(c) ? "sunk" : s.hit ? "hit" : "miss";
          return myCells.has(c) ? "ship" : "water";
        }}
        highlight={lastEnemy}
      />
      {lastEnemy !== null && !waiting && (
        <p className="text-center text-xs text-muted">
          Dernier tir de {otherName} : {cellName(lastEnemy)}
        </p>
      )}
    </div>
  );
}
