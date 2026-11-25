"use client";

// Agenda — chargement des événements côté navigateur (RLS de l'utilisateur connecté).
//
// Fonctions prêtes à l'emploi pour la page d'accueil :
//
//   const today = await loadUpcoming();            // 7 prochains jours (à partir de maintenant)
//   const next  = await nextCountdownEvent();      // { ...occurrence, daysLeft } | null
//   const week  = await loadOccurrences("2026-11-23", "2026-11-29");
//
//   useEffect(() => subscribeEvents(() => reload()), []);   // temps réel sur la table events
//
// Libellés utiles : describeRecurrence(event), formatOccurrenceTime(occ).

import { formatTime, todayISO, addDaysISO, daysBetween } from "./dates";
import { loadHolidays } from "./family";
import { expandEvents, type Occurrence } from "./recurrence";
import { supabase } from "./supabase/client";
import type { EventRow } from "./types";

export type { Occurrence } from "./recurrence";
export { describeRecurrence, occurrencesOn, occursOn, weekStartISO } from "./recurrence";

/** Récupère les lignes `events` susceptibles d'avoir une occurrence dans [fromISO, toISO]. */
export async function fetchEventsBetween(fromISO: string, toISO: string): Promise<EventRow[]> {
  const { data, error } = await supabase()
    .from("events")
    .select("*")
    .lte("start_date", toISO)
    .or(`recurrence.neq.none,start_date.gte.${fromISO},end_date.gte.${fromISO}`)
    .order("start_date");
  if (error) throw error;
  return ((data ?? []) as EventRow[]).filter((e) => e.recurrence === "none" || !e.until_date || e.until_date >= fromISO);
}

/**
 * Toutes les occurrences entre deux dates (YYYY-MM-DD, incluses), récurrences développées,
 * vacances scolaires prises en compte, triées par date puis heure.
 */
export async function loadOccurrences(fromISO: string, toISO: string): Promise<Occurrence[]> {
  const [events, holidays] = await Promise.all([fetchEventsBetween(fromISO, toISO), loadHolidays()]);
  return expandEvents(events, fromISO, toISO, holidays);
}

/** Une occurrence est-elle terminée à l'instant `now` ? (journée entière : terminée le lendemain) */
export function isOccurrencePast(occ: Occurrence, now: Date = new Date()): boolean {
  const today = todayISO(now);
  const lastDay = occ.endDate ?? occ.date;
  if (lastDay < today) return true;
  if (lastDay > today) return false;
  if (occ.endAt) return occ.endAt.getTime() < now.getTime();
  if (occ.startAt && !occ.endDate) return occ.startAt.getTime() + 60 * 60 * 1000 < now.getTime();
  return false;
}

/**
 * Occurrences à venir sur `days` jours (aujourd'hui compris, jusqu'à aujourd'hui + days - 1).
 * Les occurrences d'aujourd'hui déjà terminées sont retirées.
 */
export async function loadUpcoming(days = 7): Promise<Occurrence[]> {
  const now = new Date();
  const from = todayISO(now);
  const occs = await loadOccurrences(from, addDaysISO(from, Math.max(1, days) - 1));
  return occs.filter((o) => !isOccurrencePast(o, now));
}

export type CountdownOccurrence = Occurrence & {
  /** Nombre de jours avant l'événement (0 = aujourd'hui) */
  daysLeft: number;
};

/** Prochain événement marqué « compte à rebours » (dans les 400 jours), ou null. */
export async function nextCountdownEvent(): Promise<CountdownOccurrence | null> {
  const today = todayISO();
  const to = addDaysISO(today, 400);
  const { data, error } = await supabase()
    .from("events")
    .select("*")
    .eq("countdown", true)
    .lte("start_date", to)
    .or(`recurrence.neq.none,start_date.gte.${today},end_date.gte.${today}`);
  if (error || !data?.length) return null;
  const holidays = await loadHolidays();
  const now = new Date();
  const next = expandEvents(data as EventRow[], today, to, holidays).find((o) => o.date >= today && !isOccurrencePast(o, now));
  return next ? { ...next, daysLeft: daysBetween(today, next.date) } : null;
}

/**
 * S'abonne aux changements de la table `events` (création, modification, suppression).
 * Renvoie la fonction de désabonnement — à retourner directement depuis un useEffect :
 *   useEffect(() => subscribeEvents(() => load(), "accueil"), [load]);
 */
export function subscribeEvents(onChange: () => void, channelPrefix = "agenda-events"): () => void {
  const sb = supabase();
  // Suffixe aléatoire : un réabonnement rapide ne réutilise jamais un canal en cours de fermeture.
  const ch = sb
    .channel(`${channelPrefix}-${Math.random().toString(36).slice(2, 10)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => onChange())
    .subscribe();
  return () => {
    sb.removeChannel(ch);
  };
}

/** « 17 h 30 – 18 h 30 », « 17 h 30 », « Journée » ou « Plusieurs jours » selon l'occurrence. */
export function formatOccurrenceTime(occ: Occurrence): string {
  const e = occ.event;
  if (e.all_day || !e.start_time) return occ.endDate ? "Plusieurs jours" : "Journée";
  const start = formatTime(e.start_time);
  return e.end_time && occ.endAt ? `${start} – ${formatTime(e.end_time)}` : start;
}
