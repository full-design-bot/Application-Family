// Parties à deux (table games) : métadonnées et règles communes, sans accès réseau.

import { emptyMorpion } from "./morpion";
import { emptyGrid } from "./alignes4";

export type GameType = "morpion" | "alignes4" | "bataille" | "pendu" | "dessin";
export type GameStatus = "setup" | "active" | "finished";

/** Sous-ensemble d'une ligne de la table games. */
export interface GameLike {
  id: string;
  type: string;
  state: Record<string, unknown>;
  players: string[];
  turn: string | null;
  status: GameStatus;
  winner: string | null;
  created_by?: string | null;
  updated_at?: string;
}

export interface GameMeta {
  type: GameType;
  label: string;
  emoji: string;
  description: string;
  /** titre de la notification « c'est ton tour » */
  turnTitle: string;
  /** couleur de fond pastel (classes du thème) */
  color: string;
}

export const GAME_META: Record<GameType, GameMeta> = {
  morpion: {
    type: "morpion",
    label: "Morpion",
    emoji: "❌",
    description: "Trois symboles alignés et c'est gagné",
    turnTitle: "🎲 À toi de jouer au morpion !",
    color: "bg-accent-soft",
  },
  alignes4: {
    type: "alignes4",
    label: "4 alignés",
    emoji: "🔴",
    description: "Fais tomber tes jetons, aligne-en quatre",
    turnTitle: "🎲 À toi de jouer à 4 alignés !",
    color: "bg-sand-soft",
  },
  bataille: {
    type: "bataille",
    label: "Bataille navale",
    emoji: "⚓",
    description: "Cache ta flotte, coule la sienne",
    turnTitle: "🎯 À toi de tirer à la bataille navale !",
    color: "bg-sky-soft",
  },
  pendu: {
    type: "pendu",
    label: "Pendu",
    emoji: "🔤",
    description: "Un mot secret, sept erreurs permises",
    turnTitle: "🔤 À toi de deviner le mot du pendu !",
    color: "bg-sage-soft",
  },
  dessin: {
    type: "dessin",
    label: "Dessine, je devine",
    emoji: "🎨",
    description: "L'un dessine en direct, l'autre devine",
    turnTitle: "🎨 Un dessin t'attend, à toi de deviner !",
    color: "bg-rose-soft",
  },
};

export const GAME_TYPES = Object.keys(GAME_META) as GameType[];

export function isGameType(t: string): t is GameType {
  return (GAME_TYPES as string[]).includes(t);
}

export function metaOf(type: string): GameMeta {
  return isGameType(type) ? GAME_META[type] : { ...GAME_META.morpion, type: "morpion", label: type, emoji: "🎲" };
}

export function opponentOf(game: Pick<GameLike, "players">, me: string): string | null {
  return game.players.find((p) => p !== me) ?? null;
}

export function readyList(game: Pick<GameLike, "state">): string[] {
  const r = game.state?.ready;
  return Array.isArray(r) ? r.filter((x): x is string => typeof x === "string") : [];
}

export function ownerOf(game: Pick<GameLike, "state">): string | null {
  const o = game.state?.owner;
  return typeof o === "string" ? o : null;
}

/** Indice (0 ou 1) d'un joueur : symbole au morpion, couleur à 4 alignés. */
export function markOf(game: Pick<GameLike, "players">, member: string): 0 | 1 {
  return game.players[0] === member ? 0 : 1;
}

/** C'est à moi d'agir dans cette partie ? */
export function isMyTurn(game: GameLike, me: string): boolean {
  if (!game.players.includes(me) || game.status === "finished") return false;
  if (game.status === "setup") {
    if (game.type === "bataille") return !readyList(game).includes(me);
    if (game.type === "pendu" || game.type === "dessin") return ownerOf(game) === me;
    return false;
  }
  return game.turn === me;
}

export type GameResult = "win" | "loss" | "draw" | null;

export function resultFor(game: GameLike, me: string): GameResult {
  if (game.status !== "finished") return null;
  if (!game.winner) return "draw";
  return game.winner === me ? "win" : "loss";
}

/** Phrase de statut courte pour une liste de parties. */
export function statusLine(game: GameLike, me: string, nameOf: (id: string | null) => string): string {
  const other = opponentOf(game, me);
  const otherName = nameOf(other);
  const res = resultFor(game, me);
  if (res === "win") return "Tu as gagné 🏆";
  if (res === "loss") return `${otherName} a gagné`;
  if (res === "draw") return "Égalité 🤝";
  if (isMyTurn(game, me)) {
    if (game.status === "setup" && game.type === "bataille") return "Place tes bateaux !";
    if (game.status === "setup") return "Choisis ton mot !";
    return "À toi de jouer !";
  }
  if (game.status === "setup") {
    if (game.type === "bataille") return `${otherName} place ses bateaux…`;
    return `${otherName} choisit un mot…`;
  }
  if (game.type === "dessin" && ownerOf(game) === me) return `${otherName} devine ton dessin…`;
  return `Au tour de ${otherName}`;
}

export interface NewGameRow {
  type: GameType;
  players: string[];
  turn: string | null;
  status: GameStatus;
  state: Record<string, unknown>;
  created_by: string;
}

/**
 * Nouvelle partie. Morpion / 4 alignés / bataille : `first` commence.
 * Pendu / dessin : `owner` choisit (ou dessine) le mot, l'autre devine.
 */
export function newGameRow(
  type: GameType,
  me: string,
  partner: string,
  opts: { first?: string; owner?: string } = {},
): NewGameRow {
  const players = [me, partner];
  const first = opts.first ?? me;
  const owner = opts.owner ?? me;
  const guesser = owner === me ? partner : me;
  switch (type) {
    case "morpion":
      return { type, players, created_by: me, turn: first, status: "active", state: { board: emptyMorpion(), first } };
    case "alignes4":
      return { type, players, created_by: me, turn: first, status: "active", state: { grid: emptyGrid(), first } };
    case "bataille":
      return { type, players, created_by: me, turn: first, status: "setup", state: { ready: [], shots: {}, first } };
    case "pendu":
      return { type, players, created_by: me, turn: guesser, status: "setup", state: { owner } };
    case "dessin":
      return { type, players, created_by: me, turn: guesser, status: "setup", state: { owner, strokes: [] } };
  }
}

/** Revanche : on alterne qui commence (ou qui fait deviner). */
export function rematchRow(game: GameLike, me: string): NewGameRow | null {
  const partner = opponentOf(game, me);
  if (!partner || !isGameType(game.type)) return null;
  if (game.type === "pendu" || game.type === "dessin") {
    const prevOwner = ownerOf(game) ?? game.players[0];
    const owner = prevOwner === me ? partner : me;
    return newGameRow(game.type, me, partner, { owner });
  }
  const prevFirst = typeof game.state.first === "string" ? game.state.first : game.players[0];
  const first = prevFirst === me ? partner : me;
  return newGameRow(game.type, me, partner, { first });
}

/** Victoires de chacun, toutes parties confondues et par type. */
export function victories(games: GameLike[], ids: string[]) {
  const total: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const byType: Record<string, Record<string, number>> = {};
  let draws = 0;
  for (const g of games) {
    if (g.status !== "finished") continue;
    if (!g.winner) {
      draws++;
      continue;
    }
    total[g.winner] = (total[g.winner] ?? 0) + 1;
    byType[g.type] ??= {};
    byType[g.type][g.winner] = (byType[g.type][g.winner] ?? 0) + 1;
  }
  return { total, byType, draws };
}
