// Score de complicité : concordance des réponses aux jeux « Pour mieux se connaître ».
// - devine     : je devine sa réponse (2 comparaisons par question : chacun devine l'autre)
// - qui        : on désigne la même personne
// - tupreferes : on fait le même choix

export interface PairedRowLite {
  game: string;
  item_key: string;
  member_id: string;
  answer: unknown;
  guess: unknown;
  created_at: string;
}

export const COMPLICITY_GAMES = ["devine", "qui", "tupreferes"] as const;
export type ComplicityGame = (typeof COMPLICITY_GAMES)[number];

export interface Tally {
  matches: number;
  total: number;
  /** pourcentage arrondi, null s'il n'y a encore rien à comparer */
  pct: number | null;
}

export interface ComplicityResult {
  global: Tally;
  byGame: Record<ComplicityGame, Tally>;
  /** points de chacun à « Devine ma réponse » (bonnes devinettes) */
  devinePoints: Record<string, number>;
  /** questions répondues par les deux */
  pairs: number;
  /** par mois (AAAA-MM), du plus ancien au plus récent */
  timeline: { month: string; pct: number; total: number; cumulativePct: number }[];
}

export function sameAnswer(a: unknown, b: unknown): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

const tally = (matches: number, total: number): Tally => ({
  matches,
  total,
  pct: total > 0 ? Math.round((matches / total) * 100) : null,
});

export function computeComplicity(rows: PairedRowLite[], me: string, partner: string | null | undefined): ComplicityResult {
  const counts: Record<ComplicityGame, { m: number; t: number }> = {
    devine: { m: 0, t: 0 },
    qui: { m: 0, t: 0 },
    tupreferes: { m: 0, t: 0 },
  };
  const devinePoints: Record<string, number> = { [me]: 0 };
  if (partner) devinePoints[partner] = 0;
  const months = new Map<string, { m: number; t: number }>();
  let pairs = 0;

  if (partner) {
    const byKey = new Map<string, { mine?: PairedRowLite; theirs?: PairedRowLite }>();
    for (const r of rows) {
      if (!(COMPLICITY_GAMES as readonly string[]).includes(r.game)) continue;
      const k = `${r.game}::${r.item_key}`;
      const entry = byKey.get(k) ?? {};
      if (r.member_id === me) entry.mine = r;
      else if (r.member_id === partner) entry.theirs = r;
      byKey.set(k, entry);
    }
    for (const { mine, theirs } of byKey.values()) {
      if (!mine || !theirs) continue;
      pairs++;
      const game = mine.game as ComplicityGame;
      let m = 0;
      let t = 0;
      if (game === "devine") {
        const iGuessed = sameAnswer(mine.guess, theirs.answer);
        const theyGuessed = sameAnswer(theirs.guess, mine.answer);
        if (iGuessed) devinePoints[me]++;
        if (theyGuessed) devinePoints[partner]++;
        m = Number(iGuessed) + Number(theyGuessed);
        t = 2;
      } else {
        m = Number(sameAnswer(mine.answer, theirs.answer));
        t = 1;
      }
      counts[game].m += m;
      counts[game].t += t;
      const last = mine.created_at > theirs.created_at ? mine.created_at : theirs.created_at;
      const month = last.slice(0, 7);
      const mo = months.get(month) ?? { m: 0, t: 0 };
      mo.m += m;
      mo.t += t;
      months.set(month, mo);
    }
  }

  let cm = 0;
  let ct = 0;
  const timeline = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { m, t }]) => {
      cm += m;
      ct += t;
      return { month, pct: Math.round((m / t) * 100), total: t, cumulativePct: Math.round((cm / ct) * 100) };
    });

  const gm = COMPLICITY_GAMES.reduce((n, g) => n + counts[g].m, 0);
  const gt = COMPLICITY_GAMES.reduce((n, g) => n + counts[g].t, 0);
  return {
    global: tally(gm, gt),
    byGame: {
      devine: tally(counts.devine.m, counts.devine.t),
      qui: tally(counts.qui.m, counts.qui.t),
      tupreferes: tally(counts.tupreferes.m, counts.tupreferes.t),
    },
    devinePoints,
    pairs,
    timeline,
  };
}

/** Petit mot doux selon le score. */
export function complicityMessage(pct: number | null): string {
  if (pct === null) return "Répondez à quelques questions pour découvrir votre score 💞";
  if (pct >= 85) return "Âmes sœurs certifiées 💘";
  if (pct >= 70) return "Vous vous connaissez par cœur 💞";
  if (pct >= 50) return "Belle complicité, et encore plein de choses à découvrir ✨";
  if (pct >= 30) return "Des surprises à chaque question, c'est ça qui est bon 😄";
  return "Tout un monde à explorer ensemble 🌱";
}
