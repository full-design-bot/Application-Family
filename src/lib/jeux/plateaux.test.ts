import { describe, expect, it } from "vitest";
import { emptyMorpion, morpionOutcome, morpionPlay, morpionWinner, normalizeMorpion, type Board } from "./morpion";
import { alignes4Outcome, alignes4Play, alignes4Winner, COLS, dropRow, emptyGrid, idx, ROWS, type Grid } from "./alignes4";

describe("morpion", () => {
  it("détecte une ligne, une colonne et une diagonale", () => {
    const row: Board = [0, 0, 0, null, 1, 1, null, null, null];
    expect(morpionWinner(row)).toEqual({ winner: 0, line: [0, 1, 2] });
    const col: Board = [1, 0, null, 1, 0, null, 1, null, null];
    expect(morpionWinner(col)?.winner).toBe(1);
    const diag: Board = [0, 1, null, 1, 0, null, null, null, 0];
    expect(morpionWinner(diag)?.line).toEqual([0, 4, 8]);
    const anti: Board = [0, 0, 1, null, 1, null, 1, null, 0];
    expect(morpionWinner(anti)?.line).toEqual([2, 4, 6]);
  });

  it("reconnaît l'égalité", () => {
    const b: Board = [0, 1, 0, 0, 1, 1, 1, 0, 0];
    expect(morpionOutcome(b)).toEqual({ status: "draw" });
  });

  it("une victoire sur la dernière case n'est pas une égalité", () => {
    const b: Board = [0, 1, 0, 1, 0, 1, 1, 0, 0];
    expect(morpionOutcome(b).status).toBe("won");
  });

  it("refuse une case occupée ou une partie terminée", () => {
    const b = morpionPlay(emptyMorpion(), 4, 0)!;
    expect(b[4]).toBe(0);
    expect(morpionPlay(b, 4, 1)).toBeNull();
    expect(morpionPlay([0, 0, 0, null, null, null, null, null, null], 5, 1)).toBeNull();
    expect(morpionPlay(b, 9, 1)).toBeNull();
  });

  it("normalise un état abîmé", () => {
    expect(normalizeMorpion(undefined)).toHaveLength(9);
    expect(normalizeMorpion([0, "x", 1])).toEqual([0, null, 1, null, null, null, null, null, null]);
  });
});

describe("4 alignés", () => {
  const play = (grid: Grid, cols: number[]) => {
    let g = grid;
    cols.forEach((c, i) => {
      g = alignes4Play(g, c, (i % 2) as 0 | 1)!.grid;
    });
    return g;
  };

  it("les jetons tombent en bas puis s'empilent", () => {
    const g = emptyGrid();
    expect(dropRow(g, 3)).toBe(ROWS - 1);
    const r = alignes4Play(g, 3, 0)!;
    expect(r.row).toBe(ROWS - 1);
    expect(r.index).toBe(idx(ROWS - 1, 3));
    expect(dropRow(r.grid, 3)).toBe(ROWS - 2);
  });

  it("refuse une colonne pleine ou hors grille", () => {
    let g = emptyGrid();
    for (let i = 0; i < ROWS; i++) g = alignes4Play(g, 0, (i % 2) as 0 | 1)!.grid;
    expect(dropRow(g, 0)).toBe(-1);
    expect(alignes4Play(g, 0, 0)).toBeNull();
    expect(alignes4Play(g, COLS, 0)).toBeNull();
  });

  it("victoire horizontale", () => {
    const g = play(emptyGrid(), [0, 0, 1, 1, 2, 2, 3]);
    expect(alignes4Winner(g)?.winner).toBe(0);
  });

  it("victoire verticale", () => {
    const g = play(emptyGrid(), [0, 1, 0, 1, 0, 1, 0]);
    expect(alignes4Winner(g)?.winner).toBe(0);
    expect(alignes4Winner(g)?.line).toHaveLength(4);
  });

  it("victoires en diagonale (dans les deux sens)", () => {
    const g = emptyGrid();
    // diagonale montante vers la droite pour le joueur 1
    const cells: [number, number][] = [
      [5, 0],
      [4, 1],
      [3, 2],
      [2, 3],
    ];
    cells.forEach(([r, c]) => (g[idx(r, c)] = 1));
    expect(alignes4Winner(g)?.winner).toBe(1);
    const h = emptyGrid();
    [
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ].forEach(([r, c]) => (h[idx(r, c)] = 0));
    expect(alignes4Winner(h)?.winner).toBe(0);
  });

  it("pas de victoire avec trois jetons", () => {
    const g = play(emptyGrid(), [0, 0, 1, 1, 2, 2]);
    expect(alignes4Outcome(g).status).toBe("playing");
  });

  it("égalité quand la grille est pleine sans alignement", () => {
    const rows = ["0011001", "1100110", "0011001", "1100110", "0011001", "1100110"];
    const g: Grid = rows.flatMap((r) => [...r].map((ch) => Number(ch) as 0 | 1));
    expect(alignes4Winner(g)).toBeNull();
    expect(alignes4Outcome(g)).toEqual({ status: "draw" });
  });
});
