// 4 alignés : grille de 7 colonnes × 6 lignes, les jetons tombent.
// Indice d'une case = ligne * 7 + colonne, la ligne 0 est en HAUT.

import type { Mark, Outcome } from "./morpion";

export const COLS = 7;
export const ROWS = 6;
export type Grid = (Mark | null)[];

export function emptyGrid(): Grid {
  return Array<Mark | null>(COLS * ROWS).fill(null);
}

export function normalizeGrid(grid: unknown): Grid {
  const g = Array.isArray(grid) ? grid : [];
  return Array.from({ length: COLS * ROWS }, (_, i) => (g[i] === 0 || g[i] === 1 ? (g[i] as Mark) : null));
}

export const idx = (row: number, col: number) => row * COLS + col;

/** Ligne où tomberait un jeton dans cette colonne (-1 si colonne pleine). */
export function dropRow(grid: Grid, col: number): number {
  if (col < 0 || col >= COLS) return -1;
  for (let row = ROWS - 1; row >= 0; row--) {
    if (grid[idx(row, col)] === null) return row;
  }
  return -1;
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function alignes4Winner(grid: Grid): { winner: Mark; line: number[] } | null {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const v = grid[idx(row, col)];
      if (v === null) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const line = [idx(row, col)];
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[idx(r, c)] === v) {
          line.push(idx(r, c));
          r += dr;
          c += dc;
        }
        if (line.length >= 4) return { winner: v, line };
      }
    }
  }
  return null;
}

export function alignes4Outcome(grid: Grid): Outcome {
  const w = alignes4Winner(grid);
  if (w) return { status: "won", ...w };
  if (grid.every((c) => c !== null)) return { status: "draw" };
  return { status: "playing" };
}

/** Lâche un jeton ; renvoie la nouvelle grille et la case occupée, ou null. */
export function alignes4Play(grid: Grid, col: number, mark: Mark): { grid: Grid; index: number; row: number } | null {
  if (alignes4Outcome(grid).status !== "playing") return null;
  const row = dropRow(grid, col);
  if (row < 0) return null;
  const next = [...grid];
  const index = idx(row, col);
  next[index] = mark;
  return { grid: next, index, row };
}
