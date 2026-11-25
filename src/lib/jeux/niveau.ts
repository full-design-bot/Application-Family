// Niveaux des jeux coquins : on ne montre jamais rien au-dessus du niveau
// accepté par CHACUN des deux (min des deux réglages).

export type SpicyLevel = 1 | 2 | 3;

export const LEVELS: Record<SpicyLevel, { emoji: string; label: string; text: string }> = {
  1: { emoji: "😊", label: "Tendre", text: "Câlins, complicité et petits frissons" },
  2: { emoji: "😏", label: "Audacieux", text: "Un peu plus de piment" },
  3: { emoji: "🔥", label: "Très coquin", text: "Pour les soirées brûlantes" },
};

export function toLevel(value: unknown): SpicyLevel {
  const n = Number(value);
  return n >= 3 ? 3 : n >= 2 ? 2 : 1;
}

export function levelOfSettings(settings: { spicy_max_level?: unknown } | null | undefined): SpicyLevel {
  return toLevel(settings?.spicy_max_level ?? 1);
}

/** Niveau effectif du couple : le plus prudent des deux (1 si l'autre n'a pas de compte). */
export function effectiveLevel(mine: unknown, partner: unknown): SpicyLevel {
  return Math.min(toLevel(mine), partner === undefined || partner === null ? 1 : toLevel(partner)) as SpicyLevel;
}

export function withinLevel<T extends { level: SpicyLevel }>(items: readonly T[], level: SpicyLevel): T[] {
  return items.filter((i) => i.level <= level);
}

export function levelsUpTo(level: SpicyLevel): SpicyLevel[] {
  return ([1, 2, 3] as SpicyLevel[]).filter((l) => l <= level);
}

/** Assemble les faces des dés en une phrase (« près de le cou » → « près du cou »). */
export function combineDice(action: string, zone: string, lieu?: string | null): string {
  let s = `${action} ${zone}`
    .replace(/\bde les\b/g, "des")
    .replace(/\bde le\b/g, "du");
  if (lieu) s += `, ${lieu}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
