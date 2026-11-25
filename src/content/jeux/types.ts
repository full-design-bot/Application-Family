// Types des contenus des jeux. Les clés (`key`) sont STABLES : elles sont
// enregistrées en base (paired_answers.item_key, desire_answers.item_key).
// Ne jamais renuméroter : ajouter de nouvelles clés à la suite.

import type { SpicyLevel } from "../../lib/jeux/niveau";

export type { SpicyLevel };

/** Devine ma réponse : on répond pour soi et on devine la réponse de l'autre. */
export interface DevineQuestion {
  key: string;
  question: string;
  choices: string[];
}

/** Qui de nous deux ? */
export interface QuiItem {
  key: string;
  text: string;
}

/** Tu préfères… (a ou b) */
export interface Dilemme {
  key: string;
  a: string;
  b: string;
}

export interface DilemmeHot extends Dilemme {
  level: SpicyLevel;
}

/** Les 36 questions pour se rapprocher */
export interface Question36 {
  key: string;
  set: 1 | 2 | 3;
  text: string;
}

export interface Envie {
  key: string;
  text: string;
  emoji: string;
  level: SpicyLevel;
}

export interface FaceDe {
  text: string;
  emoji: string;
  level: SpicyLevel;
}

export interface ActionVerite {
  key: string;
  kind: "action" | "verite";
  level: SpicyLevel;
  text: string;
}

export interface CouponModele {
  emoji: string;
  title: string;
  description: string;
  level: SpicyLevel;
}

export interface DefiModele {
  key: string;
  level: SpicyLevel;
  text: string;
}
