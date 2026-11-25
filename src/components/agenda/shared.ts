// Constantes et petits utilitaires d'affichage partagés par les pages Agenda / Enfants / Rappels.

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { addDaysISO, ageFrom, daysBetween, todayISO } from "@/lib/dates";
import type { Holiday } from "@/lib/holidays";

export const EVENT_EMOJIS = [
  "📅", "🏊", "⚽", "🩰", "🎨", "🎹", "🥋", "🎾", "🏀", "🎭", "🏫", "📚",
  "🍽️", "🩺", "🦷", "💇", "🎂", "🎉", "✈️", "🚗", "🏕️", "🎬", "🛒", "💑",
];

/** Suggestions « à ne pas oublier » selon l'emoji choisi */
export const CHECKLIST_SUGGESTIONS: Record<string, string[]> = {
  "🏊": ["maillot", "bonnet", "serviette", "lunettes", "gel douche"],
  "⚽": ["crampons", "protège-tibias", "gourde", "short"],
  "🩰": ["justaucorps", "chaussons", "chignon"],
  "🥋": ["kimono", "ceinture", "gourde"],
  "🎾": ["raquette", "balles", "gourde"],
  "🏀": ["baskets", "gourde"],
  "🎨": ["tablier", "vieux t-shirt"],
  "🎹": ["partitions", "cahier"],
  "🩺": ["carte Vitale", "carnet de santé", "ordonnance"],
  "🦷": ["carte Vitale", "carnet de santé"],
  "🏫": ["cartable", "goûter", "doudou"],
  "🎂": ["cadeau", "carte"],
  "✈️": ["passeports", "billets", "chargeurs", "doudou"],
  "🏕️": ["duvet", "lampe frontale", "crème solaire"],
};

/** « Vacances de Noël du 19 décembre au 3 janvier » (la date de fin officielle est le jour de reprise) */
export function holidayLabel(h: Holiday): string {
  const last = addDaysISO(h.end, -1);
  const f = (d: string) => format(parseISO(d), "d MMMM", { locale: fr }).replace(/^1 /, "1er ");
  return last === h.start ? `${h.name} le ${f(h.start)}` : `${h.name} du ${f(h.start)} au ${f(last)}`;
}

/** Liste française : « Jules et Pia », « Jules, Pia et Sam » */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

export const REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 h" },
  { minutes: 120, label: "2 h" },
];

/** « 6 ans », « 18 mois », « 3 semaines » */
export function ageLabel(birthdate: string | null): string | null {
  if (!birthdate) return null;
  const today = todayISO();
  const years = ageFrom(birthdate, today) ?? 0;
  if (years >= 2) return `${years} ans`;
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const [y, m, d] = today.split("-").map(Number);
  const months = (y - by) * 12 + (m - bm) - (d < bd ? 1 : 0);
  if (months >= 1) return `${months} mois`;
  const weeks = Math.floor(daysBetween(birthdate, today) / 7);
  return weeks >= 1 ? `${weeks} semaine${weeks > 1 ? "s" : ""}` : "nouveau-né 🍼";
}
