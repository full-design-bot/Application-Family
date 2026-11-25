import { describe, expect, it } from "vitest";
import { MOTS_DESSIN, MOTS_PENDU } from "../../content/jeux/mots";
import { DEVINE } from "../../content/jeux/devine";
import { QUI } from "../../content/jeux/qui";
import { TU_PREFERES } from "../../content/jeux/tu-preferes";
import { QUESTIONS_36 } from "../../content/jeux/questions36";
import { ENVIES } from "../../content/jeux/envies";
import { DE_ACTIONS, DE_CORPS, DE_LIEUX } from "../../content/jeux/de-coquin";
import { ACTION_VERITE } from "../../content/jeux/action-verite";
import { DEFIS } from "../../content/jeux/defis";
import { BONS } from "../../content/jeux/bons";
import { TU_PREFERES_HOT } from "../../content/jeux/tu-preferes-hot";
import { normalizeWord, validateWord } from "./mots";

const unique = (xs: readonly string[]) => new Set(xs).size === xs.length;

describe("contenus des jeux", () => {
  it("mots du pendu et du dessin", () => {
    expect(MOTS_PENDU.length).toBeGreaterThanOrEqual(200);
    expect(MOTS_DESSIN.length).toBeGreaterThanOrEqual(150);
    expect(unique(MOTS_PENDU.map(normalizeWord))).toBe(true);
    expect(unique(MOTS_DESSIN.map(normalizeWord))).toBe(true);
    for (const w of [...MOTS_PENDU, ...MOTS_DESSIN]) expect(validateWord(w), w).toBeNull();
  });

  it("jeux découverte : quantités et clés uniques", () => {
    expect(DEVINE.length).toBeGreaterThanOrEqual(80);
    expect(QUI.length).toBeGreaterThanOrEqual(60);
    expect(TU_PREFERES.length).toBeGreaterThanOrEqual(80);
    expect(QUESTIONS_36).toHaveLength(36);
    for (const set of [1, 2, 3]) expect(QUESTIONS_36.filter((q) => q.set === set)).toHaveLength(12);
    for (const list of [DEVINE, QUI, TU_PREFERES, QUESTIONS_36]) expect(unique(list.map((x) => x.key))).toBe(true);
    for (const q of DEVINE) {
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(unique(q.choices)).toBe(true);
    }
  });

  it("coquins : quantités par niveau et clés uniques", () => {
    expect(ENVIES.length).toBeGreaterThanOrEqual(60);
    expect(unique(ENVIES.map((e) => e.key))).toBe(true);
    for (const level of [1, 2, 3] as const) {
      expect(ACTION_VERITE.filter((x) => x.level === level && x.kind === "action").length).toBeGreaterThanOrEqual(40);
      expect(ACTION_VERITE.filter((x) => x.level === level && x.kind === "verite").length).toBeGreaterThanOrEqual(40);
      expect(DEFIS.filter((x) => x.level === level).length).toBeGreaterThanOrEqual(30);
      expect(ENVIES.some((x) => x.level === level)).toBe(true);
      expect(BONS.some((x) => x.level === level)).toBe(true);
      expect(DE_ACTIONS.some((x) => x.level === level)).toBe(true);
      expect(DE_CORPS.some((x) => x.level === level)).toBe(true);
      expect(DE_LIEUX.some((x) => x.level === level)).toBe(true);
    }
    expect(TU_PREFERES_HOT.length).toBeGreaterThanOrEqual(40);
    expect(unique(TU_PREFERES_HOT.map((x) => x.key))).toBe(true);
    expect(unique(ACTION_VERITE.map((x) => x.key))).toBe(true);
    expect(unique(ACTION_VERITE.map((x) => x.text))).toBe(true);
    expect(unique(DEFIS.map((x) => x.key))).toBe(true);
    expect(unique(DEFIS.map((x) => x.text))).toBe(true);
  });
});
