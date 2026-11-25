// Morpion (3 × 3). Les cases contiennent l'indice du joueur (0 ou 1) ou null.

export type Mark = 0 | 1;
export type Board = (Mark | null)[];

export const MORPION_LINES: readonly number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export type Outcome =
  | { status: "playing" }
  | { status: "won"; winner: Mark; line: number[] }
  | { status: "draw" };

export function emptyMorpion(): Board {
  return Array<Mark | null>(9).fill(null);
}

export function normalizeMorpion(board: unknown): Board {
  const b = Array.isArray(board) ? board : [];
  return Array.from({ length: 9 }, (_, i) => (b[i] === 0 || b[i] === 1 ? (b[i] as Mark) : null));
}

export function morpionWinner(board: Board): { winner: Mark; line: number[] } | null {
  for (const line of MORPION_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v !== null && v === board[b] && v === board[c]) return { winner: v, line };
  }
  return null;
}

export function morpionOutcome(board: Board): Outcome {
  const w = morpionWinner(board);
  if (w) return { status: "won", ...w };
  if (board.every((c) => c !== null)) return { status: "draw" };
  return { status: "playing" };
}

/** Joue un coup ; renvoie null si le coup est impossible. */
export function morpionPlay(board: Board, index: number, mark: Mark): Board | null {
  if (index < 0 || index > 8 || board[index] !== null) return null;
  if (morpionOutcome(board).status !== "playing") return null;
  const next = [...board];
  next[index] = mark;
  return next;
}
