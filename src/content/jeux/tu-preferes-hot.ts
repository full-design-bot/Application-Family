// « Tu préfères… » version hot (paired_answers, jeu 'tupreferes_hot').

import type { DilemmeHot, SpicyLevel } from "./types";

const build = (level: SpicyLevel, start: number, pairs: [string, string][]): DilemmeHot[] =>
  pairs.map(([a, b], i) => ({ key: `tph-${String(start + i).padStart(3, "0")}`, level, a, b }));

export const TU_PREFERES_HOT: readonly DilemmeHot[] = [
  ...build(1, 1, [
    ["Un baiser sous la pluie", "Un baiser au coucher du soleil"],
    ["Un massage du dos", "Un massage des pieds"],
    ["Une heure de câlins sans parler", "Une heure de mots doux sans se toucher"],
    ["Être réveillé·e par des bisous", "S'endormir sous les caresses"],
    ["Un slow en public", "Un slow dans la cuisine"],
    ["Recevoir une lettre d'amour", "Recevoir un message vocal d'amour"],
    ["Un bain moussant à deux", "Une douche bien chaude à deux"],
    ["Un bisou dans le cou", "Un bisou sur le front"],
    ["Dormir enlacés", "Dormir main dans la main"],
    ["Un dîner aux chandelles", "Un pique-nique au lit"],
    ["Que je te murmure des mots doux", "Que je te les écrive"],
    ["Une nuit à l'hôtel", "Une nuit sous la tente"],
    ["Se tenir la main au cinéma", "Se câliner devant une série"],
    ["Un week-end au spa", "Un week-end au bord de la mer, rien que nous"],
    ["Une sérénade improvisée", "Une danse improvisée"],
  ]),
  ...build(2, 16, [
    ["Lumière tamisée", "Des bougies partout"],
    ["Que je te déshabille lentement", "Que je me déshabille devant toi"],
    ["Un massage à l'huile", "Des frissons au glaçon"],
    ["Les yeux bandés", "Interdiction d'utiliser les mains"],
    ["Des messages coquins toute la journée", "Une surprise coquine le soir"],
    ["Un câlin coquin le matin", "Un câlin coquin le soir"],
    ["Une nuit d'hôtel coquine", "Un après-midi coquin à la maison"],
    ["Que je prenne l'initiative", "La prendre toi"],
    ["La dentelle", "Rien du tout"],
    ["Un bain de minuit", "Une douche torride"],
    ["Des baisers dans le cou", "Des baisers le long du dos"],
    ["Un effeuillage", "Une danse collé-serré"],
    ["Une plume", "Un foulard de soie"],
    ["Le canapé", "La baignoire"],
    ["Chuchoter", "Ne rien dire du tout"],
  ]),
  ...build(3, 31, [
    ["Mener la danse", "Te laisser guider"],
    ["Un jeu de rôle", "Un jeu les yeux bandés"],
    ["Dans la voiture", "Dehors, à l'abri des regards"],
    ["Lent et intense", "Rapide et passionné"],
    ["Une nuit entière", "Plusieurs fois dans la journée"],
    ["Un accessoire surprise", "Une tenue surprise"],
    ["Être attaché·e", "Attacher"],
    ["Le frisson d'être presque surpris·es", "Le confort d'une porte fermée à clé"],
    ["Une huile chauffante", "Un gel rafraîchissant"],
    ["Que je te dise ce que je veux", "Que je te le montre"],
    ["Sur la table", "Contre un mur"],
    ["Faire durer des heures", "Un moment fou de cinq minutes"],
    ["Regarder", "Être regardé·e"],
    ["Une séance photo osée", "Un effeuillage en musique"],
    ["Au réveil", "Au milieu de la nuit"],
  ]),
];
