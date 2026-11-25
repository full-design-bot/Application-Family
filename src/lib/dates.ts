// Outils de dates — tout est exprimé à l'heure de Paris.
import { TZDate } from "@date-fns/tz";
import { addDays, format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export const TZ = "Europe/Paris";

/** Date du jour à Paris, au format YYYY-MM-DD */
export function todayISO(now: Date = new Date()): string {
  return format(new TZDate(now, TZ), "yyyy-MM-dd");
}

/** Convertit un instant en date de Paris YYYY-MM-DD */
export function toParisISODate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return format(new TZDate(date, TZ), "yyyy-MM-dd");
}

/** Heure de Paris "HH:mm" d'un instant */
export function toParisTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return format(new TZDate(date, TZ), "HH:mm");
}

/** Instant correspondant à une date + heure de Paris ("2026-11-25", "17:30") */
export function parisDateTime(dateISO: string, time = "00:00"): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh || 0, mm || 0, TZ).getTime());
}

/** Ajoute n jours à une date YYYY-MM-DD */
export function addDaysISO(dateISO: string, n: number): string {
  return format(addDays(parseISO(dateISO), n), "yyyy-MM-dd");
}

/** Jour de la semaine ISO (1 = lundi … 7 = dimanche) d'une date YYYY-MM-DD */
export function isoWeekday(dateISO: string): number {
  const day = parseISO(dateISO).getDay();
  return day === 0 ? 7 : day;
}

/** "mardi 25 novembre" */
export function formatDayLong(dateISO: string): string {
  return format(parseISO(dateISO), "EEEE d MMMM", { locale: fr });
}

/** "mar. 25 nov." */
export function formatDayShort(dateISO: string): string {
  return format(parseISO(dateISO), "EEE d MMM", { locale: fr });
}

/** "25 novembre 2026" */
export function formatDateFull(dateISO: string): string {
  return format(parseISO(dateISO), "d MMMM yyyy", { locale: fr });
}

/** "17 h 30" à partir de "17:30" ou "17:30:00" */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

/** "il y a 5 minutes" / "dans 3 jours" */
export function fromNow(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const s = formatDistanceToNowStrict(date, { locale: fr, addSuffix: true });
  return s;
}

/** Heure ou date courte d'un message : "14:02", "hier", "lun. 3 nov." */
export function formatMessageTime(d: string): string {
  const date = new Date(d);
  const day = toParisISODate(date);
  const today = todayISO();
  if (day === today) return toParisTime(date);
  if (day === addDaysISO(today, -1)) return `hier ${toParisTime(date)}`;
  return `${formatDayShort(day)} ${toParisTime(date)}`;
}

/** Nombre de jours entre deux dates YYYY-MM-DD (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

/** Âge en années à partir d'une date de naissance */
export function ageFrom(birthdate: string | null, at: string = todayISO()): number | null {
  if (!birthdate) return null;
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const [y, m, d] = at.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

export const WEEKDAYS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
export const WEEKDAYS_SHORT_FR = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
