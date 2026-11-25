// Le dé coquin : un dé « action », un dé « endroit du corps » et, en option, un dé « lieu ».
// Les actions se terminent de façon à pouvoir être suivies d'une partie du corps.

import type { FaceDe, SpicyLevel } from "./types";

const f = (level: SpicyLevel, emoji: string, text: string): FaceDe => ({ level, emoji, text });

export const DE_ACTIONS: readonly FaceDe[] = [
  f(1, "💋", "Embrasse"),
  f(1, "✋", "Caresse"),
  f(1, "💆", "Masse"),
  f(1, "🌬️", "Souffle doucement sur"),
  f(1, "🦋", "Fais des bisous papillon sur"),
  f(1, "🤫", "Murmure un compliment près de"),
  f(2, "😬", "Mordille tendrement"),
  f(2, "🪶", "Effleure du bout des doigts"),
  f(2, "🧊", "Passe un glaçon sur"),
  f(2, "💞", "Couvre de baisers"),
  f(2, "🫒", "Masse à l'huile"),
  f(3, "👅", "Goûte lentement"),
  f(3, "🔥", "Agace du bout des lèvres"),
  f(3, "👗", "Déshabille puis embrasse"),
  f(3, "⏳", "Taquine longuement"),
  f(3, "🙈", "Les yeux bandés, explore"),
];

export const DE_CORPS: readonly FaceDe[] = [
  f(1, "🦒", "le cou"),
  f(1, "🤲", "les mains"),
  f(1, "😊", "les joues"),
  f(1, "💪", "les épaules"),
  f(1, "👂", "l'oreille"),
  f(1, "🔙", "le dos"),
  f(2, "🌙", "la nuque"),
  f(2, "✨", "le creux des reins"),
  f(2, "🎀", "la clavicule"),
  f(2, "🍑", "les hanches"),
  f(2, "🌸", "le ventre"),
  f(2, "🦵", "les cuisses"),
  f(3, "🔥", "l'intérieur des cuisses"),
  f(3, "💗", "la poitrine"),
  f(3, "😏", "l'endroit de ton choix"),
  f(3, "🌶️", "chaque centimètre de peau"),
];

export const DE_LIEUX: readonly FaceDe[] = [
  f(1, "🛋️", "sur le canapé"),
  f(1, "🛏️", "sous la couette"),
  f(1, "🍳", "dans la cuisine"),
  f(1, "🕯️", "à la lueur des bougies"),
  f(2, "🚿", "sous la douche"),
  f(2, "🪞", "devant le miroir"),
  f(2, "🧱", "contre un mur"),
  f(2, "🛁", "dans la baignoire"),
  f(3, "🍽️", "sur la table"),
  f(3, "🚗", "dans la voiture (garée à l'abri !)"),
  f(3, "🌙", "dehors, à l'abri des regards"),
  f(3, "🪑", "sur une chaise"),
];
