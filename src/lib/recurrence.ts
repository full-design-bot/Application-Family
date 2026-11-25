// Récurrences de l'agenda — logique pure (aucun accès réseau), testée dans recurrence.test.ts.
//
// Toutes les dates sont des jours calendaires "YYYY-MM-DD" (heure de Paris) ; les heures
// (start_time / end_time) sont converties en instants via parisDateTime().
// Imports relatifs volontaires : vitest n'a pas l'alias "@/".

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { parisDateTime } from "./dates";
import { isSchoolHoliday, type Holiday } from "./holidays";
import type { EventRow } from "./types";

/** Une occurrence concrète d'un événement (éventuellement récurrent). */
export interface Occurrence {
  event: EventRow;
  /** Jour de début de cette occurrence (YYYY-MM-DD) */
  date: string;
  /** Dernier jour (inclus) pour un événement sur plusieurs jours */
  endDate?: string;
  /** Instant de début (null si journée entière ou sans heure) */
  startAt: Date | null;
  /** Instant de fin (null si inconnu) */
  endAt: Date | null;
  /** Les occurrences en vacances sont simplement omises : jamais true. */
  isHolidayPaused?: false;
}

// ------------------------------------------------------------------ jours "numérotés"
const DAY_MS = 86_400_000;
const MAX_ITERATIONS = 5000;

function dayNum(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function isoOf(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** 1 = lundi … 7 = dimanche (le 1er janvier 1970 était un jeudi) */
function weekdayNum(n: number): number {
  return ((((n + 3) % 7) + 7) % 7) + 1;
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Jour n du mois (ramené au dernier jour du mois si besoin : 31 → 30, 29 févr. → 28) */
function clampedDayNum(year: number, month0: number, day: number): number {
  const y = year + Math.floor(month0 / 12);
  const m = ((month0 % 12) + 12) % 12;
  return Math.round(Date.UTC(y, m, Math.min(day, daysInMonth(y, m))) / DAY_MS);
}

function hhmm(time: string): string {
  return time.slice(0, 5);
}

/** Lundi de la semaine d'une date (YYYY-MM-DD) */
export function weekStartISO(dateISO: string): string {
  const n = dayNum(dateISO);
  return isoOf(n - (weekdayNum(n) - 1));
}

/** Jour de la semaine ISO (1 = lundi … 7 = dimanche), indépendant du fuseau. */
export function weekdayOf(dateISO: string): number {
  return weekdayNum(dayNum(dateISO));
}

// ------------------------------------------------------------------ expansion
function makeOccurrence(event: EventRow, n: number, span: number): Occurrence {
  const date = isoOf(n);
  const endDate = span > 0 ? isoOf(n + span) : undefined;
  const timed = !event.all_day && !!event.start_time;
  const startAt = timed ? parisDateTime(date, hhmm(event.start_time!)) : null;
  let endAt = !event.all_day && event.end_time ? parisDateTime(endDate ?? date, hhmm(event.end_time)) : null;
  if (endAt && startAt && endAt.getTime() <= startAt.getTime()) endAt = null;
  return endDate ? { event, date, endDate, startAt, endAt } : { event, date, startAt, endAt };
}

/**
 * Développe un événement en occurrences sur la période [fromISO, toISO] (bornes incluses).
 *
 * - `none` : une seule occurrence (start_date → end_date éventuel)
 * - `daily` : tous les `recurrence_interval` jours
 * - `weekly` : jours `weekdays` (1 = lundi … 7 ; vide = jour de start_date),
 *   toutes les `recurrence_interval` semaines (semaines comptées depuis celle de start_date)
 * - `monthly` : même jour du mois (31 → dernier jour des mois plus courts)
 * - `yearly` : même jour chaque année (29 févr. → 28 févr. les années non bissextiles)
 *
 * `until_date` est inclus ; les `exdates` sont retirées ; si `pause_school_holidays`,
 * les occurrences d'un événement récurrent qui tombent pendant les vacances sont sautées.
 * Un événement sur plusieurs jours (end_date) est renvoyé s'il chevauche la période ;
 * `date` reste alors son jour de début.
 */
export function expandEvent(event: EventRow, fromISO: string, toISO: string, holidays: Holiday[] = []): Occurrence[] {
  const from = dayNum(fromISO);
  const to = dayNum(toISO);
  if (to < from) return [];

  const start = dayNum(event.start_date);
  const span = event.end_date ? Math.max(0, dayNum(event.end_date) - start) : 0;
  const recurring = event.recurrence !== "none";
  const until = recurring && event.until_date ? dayNum(event.until_date) : Infinity;
  const first = Math.max(start, from - span);
  const last = Math.min(to, until);
  if (last < first) return [];

  const interval = Math.max(1, Math.floor(event.recurrence_interval || 1));
  const exdates = new Set((event.exdates ?? []).map((d) => d.slice(0, 10)));
  const pause = recurring && event.pause_school_holidays;
  const out: Occurrence[] = [];

  const consider = (n: number) => {
    if (n < first || n > last) return;
    const date = isoOf(n);
    if (exdates.has(date)) return;
    if (pause && isSchoolHoliday(date, holidays)) return;
    out.push(makeOccurrence(event, n, span));
  };

  switch (event.recurrence) {
    case "none":
      consider(start);
      break;

    case "daily": {
      const k0 = Math.max(0, Math.ceil((first - start) / interval));
      for (let n = start + k0 * interval, i = 0; n <= last && i < MAX_ITERATIONS; n += interval, i++) consider(n);
      break;
    }

    case "weekly": {
      const valid = (event.weekdays ?? []).filter((d) => d >= 1 && d <= 7);
      const days = new Set(valid.length ? valid : [weekdayNum(start)]);
      const week0 = start - (weekdayNum(start) - 1);
      for (let n = first, i = 0; n <= last && i < MAX_ITERATIONS; n++, i++) {
        if (!days.has(weekdayNum(n))) continue;
        if (Math.floor((n - week0) / 7) % interval !== 0) continue;
        consider(n);
      }
      break;
    }

    case "monthly":
    case "yearly": {
      const [sy, sm, sd] = event.start_date.slice(0, 10).split("-").map(Number);
      const [fy, fm] = isoOf(first).split("-").map(Number);
      const stepMonths = event.recurrence === "monthly" ? interval : interval * 12;
      const diff = (fy - sy) * 12 + (fm - sm) - 1;
      let k = Math.max(0, Math.floor(diff / stepMonths) * stepMonths);
      for (let i = 0; i < MAX_ITERATIONS; i++, k += stepMonths) {
        const n = clampedDayNum(sy, sm - 1 + k, sd);
        if (n > last) break;
        consider(n);
      }
      break;
    }
  }
  return out;
}

/** Ordre d'affichage : par jour, journées entières d'abord, puis par heure, puis par titre. */
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ta = a.startAt ? a.startAt.getTime() : -Infinity;
  const tb = b.startAt ? b.startAt.getTime() : -Infinity;
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.event.title.localeCompare(b.event.title, "fr");
}

/** Développe plusieurs événements, triés par date puis heure. */
export function expandEvents(events: EventRow[], fromISO: string, toISO: string, holidays: Holiday[] = []): Occurrence[] {
  return events.flatMap((e) => expandEvent(e, fromISO, toISO, holidays)).sort(compareOccurrences);
}

/** L'occurrence couvre-t-elle ce jour ? (utile pour les événements sur plusieurs jours) */
export function occursOn(occ: Occurrence, dateISO: string): boolean {
  return occ.date <= dateISO && dateISO <= (occ.endDate ?? occ.date);
}

/** Occurrences visibles un jour donné (déjà triées si l'entrée l'est). */
export function occurrencesOn(occs: Occurrence[], dateISO: string): Occurrence[] {
  return occs.filter((o) => occursOn(o, dateISO));
}

// ------------------------------------------------------------------ libellés
const WEEKDAY_PLURAL = ["lundis", "mardis", "mercredis", "jeudis", "vendredis", "samedis", "dimanches"];
const WEEKDAY_SINGULAR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function joinFr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

type RecurrenceFields = Pick<
  EventRow,
  "recurrence" | "recurrence_interval" | "weekdays" | "start_date" | "until_date" | "pause_school_holidays"
>;

/**
 * Phrase courte décrivant la récurrence : « tous les mardis », « toutes les 2 semaines, le lundi et le jeudi »,
 * « tous les mois, le 15 », « tous les ans, le 14 juillet ». Chaîne vide si pas de récurrence.
 * Avec `details`, ajoute « jusqu'au … » et « (sauf vacances scolaires) ».
 */
export function describeRecurrence(e: RecurrenceFields, opts: { details?: boolean } = {}): string {
  const n = Math.max(1, e.recurrence_interval || 1);
  let s = "";
  switch (e.recurrence) {
    case "none":
      return "";
    case "daily":
      s = n === 1 ? "tous les jours" : `tous les ${n} jours`;
      break;
    case "weekly": {
      const valid = (e.weekdays ?? []).filter((d) => d >= 1 && d <= 7);
      const days = [...new Set(valid.length ? valid : [weekdayOf(e.start_date)])].sort();
      if (n === 1) {
        if (days.length === 7) s = "tous les jours";
        else if (days.join() === "1,2,3,4,5") s = "du lundi au vendredi";
        else s = `tous les ${joinFr(days.map((d) => WEEKDAY_PLURAL[d - 1]))}`;
      } else {
        s = `toutes les ${n} semaines, ${joinFr(days.map((d) => `le ${WEEKDAY_SINGULAR[d - 1]}`))}`;
      }
      break;
    }
    case "monthly": {
      const day = Number(e.start_date.slice(8, 10));
      const label = day === 1 ? "1er" : String(day);
      s = `${n === 1 ? "tous les mois" : `tous les ${n} mois`}, le ${label}`;
      break;
    }
    case "yearly": {
      const label = format(parseISO(e.start_date), "d MMMM", { locale: fr }).replace(/^1 /, "1er ");
      s = `${n === 1 ? "tous les ans" : `tous les ${n} ans`}, le ${label}`;
      break;
    }
  }
  if (opts.details) {
    if (e.until_date) s += `, jusqu'au ${format(parseISO(e.until_date), "d MMMM yyyy", { locale: fr })}`;
    if (e.pause_school_holidays) s += " (sauf vacances scolaires)";
  }
  return s;
}
