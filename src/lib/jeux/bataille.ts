// Bataille navale : grille 10 × 10, cases numérotées 0..99 (ligne * 10 + colonne).

import type { Rng } from "./random";

export const SIZE = 10;

export interface ShipModel {
  id: string;
  name: string;
  size: number;
}

export const FLEET: readonly ShipModel[] = [
  { id: "porte-avions", name: "Porte-avions", size: 5 },
  { id: "croiseur", name: "Croiseur", size: 4 },
  { id: "contre-torpilleur", name: "Contre-torpilleur", size: 3 },
  { id: "sous-marin", name: "Sous-marin", size: 3 },
  { id: "torpilleur", name: "Torpilleur", size: 2 },
];

export interface PlacedShip {
  id: string;
  size: number;
  cells: number[];
}

/** Un tir tel que stocké par la fonction battleship_fire dans games.state.shots[membre]. */
export interface Shot {
  cell: number;
  hit: boolean;
  sunk?: boolean;
}

export const LETTERS = "ABCDEFGHIJ";
export const cellName = (cell: number) => `${LETTERS[Math.floor(cell / SIZE)]}${(cell % SIZE) + 1}`;

/** Cases d'un bateau posé à partir de `start`, ou null s'il sort de la grille. */
export function shipCells(start: number, size: number, horizontal: boolean): number[] | null {
  if (start < 0 || start >= SIZE * SIZE) return null;
  const row = Math.floor(start / SIZE);
  const col = start % SIZE;
  if (horizontal ? col + size > SIZE : row + size > SIZE) return null;
  return Array.from({ length: size }, (_, i) => (horizontal ? start + i : start + i * SIZE));
}

/** Les cases sont libres (on ignore éventuellement un bateau qu'on déplace). */
export function canPlace(ships: PlacedShip[], cells: number[] | null, ignoreId?: string): cells is number[] {
  if (!cells) return false;
  const taken = new Set(ships.filter((s) => s.id !== ignoreId).flatMap((s) => s.cells));
  return cells.every((c) => !taken.has(c));
}

export function placeShip(ships: PlacedShip[], model: ShipModel, start: number, horizontal: boolean): PlacedShip[] | null {
  const cells = shipCells(start, model.size, horizontal);
  if (!canPlace(ships, cells, model.id)) return null;
  return [...ships.filter((s) => s.id !== model.id), { id: model.id, size: model.size, cells }];
}

export function randomFleet(rng: Rng = Math.random): PlacedShip[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    let ships: PlacedShip[] = [];
    let ok = true;
    for (const model of FLEET) {
      let placed: PlacedShip[] | null = null;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        placed = placeShip(ships, model, Math.floor(rng() * SIZE * SIZE), rng() < 0.5);
      }
      if (!placed) {
        ok = false;
        break;
      }
      ships = placed;
    }
    if (ok) return ships;
  }
  throw new Error("Placement impossible");
}

/** La flotte est complète, sans chevauchement et dans la grille. */
export function isFleetValid(ships: PlacedShip[]): boolean {
  if (ships.length !== FLEET.length) return false;
  const seen = new Set<number>();
  for (const model of FLEET) {
    const s = ships.find((x) => x.id === model.id);
    if (!s || s.cells.length !== model.size) return false;
    const sorted = [...s.cells].sort((a, b) => a - b);
    const step = sorted[1] - sorted[0];
    if (step !== 1 && step !== SIZE) return false;
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      if (c < 0 || c >= SIZE * SIZE || seen.has(c)) return false;
      if (i > 0 && c - sorted[i - 1] !== step) return false;
      seen.add(c);
    }
    if (step === 1 && Math.floor(sorted[0] / SIZE) !== Math.floor(sorted[sorted.length - 1] / SIZE)) return false;
  }
  return true;
}

export function normalizeShots(value: unknown): Shot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Shot => !!s && typeof (s as Shot).cell === "number")
    .map((s) => ({ cell: s.cell, hit: !!s.hit, sunk: !!s.sunk }));
}

export function shotsOf(state: Record<string, unknown>, memberId: string): Shot[] {
  const shots = (state.shots ?? {}) as Record<string, unknown>;
  return normalizeShots(shots[memberId]);
}

export function sunkCount(shots: Shot[]): number {
  return shots.filter((s) => s.sunk).length;
}

export function hitCount(shots: Shot[]): number {
  return shots.filter((s) => s.hit).length;
}

export const TOTAL_CELLS = FLEET.reduce((n, s) => n + s.size, 0);

/** Statut de mes bateaux face aux tirs de l'adversaire. */
export function fleetStatus(ships: PlacedShip[], enemyShots: Shot[]) {
  const hits = new Set(enemyShots.filter((s) => s.hit).map((s) => s.cell));
  return ships.map((s) => ({ ...s, hitCells: s.cells.filter((c) => hits.has(c)).length, sunk: s.cells.every((c) => hits.has(c)) }));
}
