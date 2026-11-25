// Vacances scolaires (calendrier officiel de l'Éducation nationale).
// Source : data.education.gouv.fr, jeu de données "fr-en-calendrier-scolaire".

import { addDaysISO, toParisISODate } from "./dates";

export interface Holiday {
  name: string;
  /** Premier jour de vacances (YYYY-MM-DD, heure de Paris) */
  start: string;
  /** Jour de reprise des cours (exclu) */
  end: string;
}

interface ApiRecord {
  description: string;
  population: string;
  start_date: string;
  end_date: string;
  location: string;
  zones: string;
}

/** Transforme les enregistrements de l'API en périodes [start, end[ */
export function parseHolidayRecords(records: ApiRecord[]): Holiday[] {
  const out: Holiday[] = [];
  for (const r of records) {
    if (r.population === "Enseignants") continue;
    const start = toParisISODate(r.start_date);
    let end = toParisISODate(r.end_date);
    const name = r.description.replace(/^Début des /, "");
    if (r.description.startsWith("Début des Vacances d'Été")) {
      end = addDaysISO(start, 60); // date de rentrée pas encore publiée
    } else if (end <= start) {
      end = addDaysISO(start, 1); // pont d'une seule journée
    }
    out.push({ name, start, end });
  }
  // dédoublonne
  const seen = new Set<string>();
  return out
    .filter((h) => {
      const k = `${h.name}|${h.start}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Copie de secours (Bordeaux, zone A) si le service officiel est injoignable. */
export const FALLBACK_HOLIDAYS_ZONE_A: Holiday[] = [
  { name: "Vacances d'Été", start: "2026-07-04", end: "2026-09-01" },
  { name: "Vacances de la Toussaint", start: "2026-10-17", end: "2026-11-02" },
  { name: "Vacances de Noël", start: "2026-12-19", end: "2027-01-04" },
  { name: "Vacances d'Hiver", start: "2027-02-13", end: "2027-03-01" },
  { name: "Vacances de Printemps", start: "2027-04-10", end: "2027-04-26" },
  { name: "Pont de l'Ascension", start: "2027-05-07", end: "2027-05-08" },
  { name: "Vacances d'Été", start: "2027-07-03", end: "2027-09-02" },
  { name: "Vacances de la Toussaint", start: "2027-10-23", end: "2027-11-08" },
  { name: "Vacances de Noël", start: "2027-12-18", end: "2028-01-03" },
  { name: "Vacances d'Hiver", start: "2028-02-19", end: "2028-03-06" },
  { name: "Vacances de Printemps", start: "2028-04-22", end: "2028-05-09" },
  { name: "Pont de l'Ascension", start: "2028-05-25", end: "2028-05-29" },
  { name: "Vacances d'Été", start: "2028-07-04", end: "2028-09-02" },
];

/** Renvoie la période de vacances contenant cette date, ou null */
export function holidayOn(dateISO: string, holidays: Holiday[]): Holiday | null {
  return holidays.find((h) => dateISO >= h.start && dateISO < h.end) ?? null;
}

export function isSchoolHoliday(dateISO: string, holidays: Holiday[]): boolean {
  return holidayOn(dateISO, holidays) !== null;
}

/** Prochaines vacances (en cours ou à venir) */
export function nextHoliday(dateISO: string, holidays: Holiday[]): Holiday | null {
  return holidays.find((h) => h.end > dateISO) ?? null;
}

/** Récupère les vacances côté serveur (mis en cache 24 h). */
export async function fetchHolidays(location = process.env.SCHOOL_LOCATION ?? "Bordeaux"): Promise<Holiday[]> {
  const since = `${new Date().getFullYear() - 1}-06-01`;
  const url =
    "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records" +
    `?limit=100&refine=location:${encodeURIComponent(location)}` +
    `&where=${encodeURIComponent(`start_date>="${since}"`)}&order_by=start_date`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { results: ApiRecord[] };
    const list = parseHolidayRecords(json.results ?? []);
    return list.length ? list : FALLBACK_HOLIDAYS_ZONE_A;
  } catch {
    return FALLBACK_HOLIDAYS_ZONE_A;
  }
}
