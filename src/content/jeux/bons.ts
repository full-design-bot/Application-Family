// Modèles de « Bons pour… » (on peut aussi écrire le sien).

import type { CouponModele, SpicyLevel } from "./types";

const c = (level: SpicyLevel, emoji: string, title: string, description: string): CouponModele => ({ level, emoji, title, description });

export const BONS: readonly CouponModele[] = [
  c(1, "💆", "Un massage de 20 minutes", "Épaules, dos, nuque : c'est toi qui choisis."),
  c(1, "🥐", "Un petit-déjeuner au lit", "Viennoiseries, jus pressé et câlin inclus."),
  c(1, "🍿", "Le choix du film ce soir", "Sans négociation ni soupir."),
  c(1, "😴", "Une grasse matinée", "Je m'occupe des enfants, tu dors."),
  c(1, "🍝", "Un dîner cuisiné par moi", "Menu de ton choix, vaisselle comprise."),
  c(1, "🤗", "Un câlin à la demande", "Valable n'importe quand, n'importe où."),
  c(1, "🧹", "Une corvée de ton choix", "Je la fais à ta place, avec le sourire."),
  c(1, "🌹", "Un rendez-vous surprise", "J'organise tout, tu te laisses porter."),
  c(1, "🛁", "Un bain préparé avec amour", "Mousse, bougies et serviette chaude."),
  c(1, "🦶", "Un massage des pieds", "Quinze minutes de pur bonheur."),
  c(1, "💃", "Un slow quand tu veux", "Même au milieu de la cuisine."),
  c(1, "🎁", "Un « oui » à une envie", "Une envie raisonnable… ou presque."),
  c(2, "🫒", "Un massage à l'huile intégral", "De la tête aux pieds, sans se presser."),
  c(2, "🎀", "Un effeuillage rien que pour toi", "Musique au choix, fous rires autorisés."),
  c(2, "🍷", "Une soirée en tête-à-tête", "Téléphones éteints, rien que nous."),
  c(2, "🛎️", "Une nuit d'hôtel", "Pancarte « ne pas déranger » de rigueur."),
  c(2, "🙈", "Une séance les yeux bandés", "Laisse-toi guider."),
  c(2, "📱", "Une journée de messages coquins", "De quoi t'occuper l'esprit jusqu'au soir."),
  c(2, "🚿", "Une douche à deux", "Et on prend notre temps."),
  c(2, "👑", "Une soirée où tu décides de tout", "Je suis à ton service."),
  c(3, "🔥", "Un fantasme réalisé", "Dans les limites qu'on s'est fixées."),
  c(3, "⏳", "Une nuit sans montre", "Pas d'heure, pas de limite."),
  c(3, "🎲", "Une soirée dé coquin", "On lance les dés, on obéit."),
  c(3, "🎭", "Un jeu de rôle de ton choix", "Costume en option."),
  c(3, "✅", "Une heure « oui à tout »", "Avec notre mot de sécurité, toujours."),
  c(3, "🗝️", "Trente minutes à tes ordres", "Tu commandes, j'exécute."),
];

export const BON_EMOJIS = ["🎟️", "💆", "🥐", "🍿", "🍝", "🤗", "🌹", "🛁", "💃", "🍷", "🎀", "🔥", "💋", "🗝️", "👑", "🎁", "😴", "✨"];
