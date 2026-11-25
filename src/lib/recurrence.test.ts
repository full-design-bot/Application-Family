import { describe, expect, it } from "vitest";
import type { Holiday } from "./holidays";
import { describeRecurrence, expandEvent, expandEvents, occurrencesOn, weekStartISO, weekdayOf } from "./recurrence";
import type { EventRow } from "./types";

function ev(p: Partial<EventRow> = {}): EventRow {
  return {
    id: p.id ?? "e1",
    space: "family",
    title: "Événement",
    emoji: "📅",
    notes: null,
    location: null,
    start_date: "2026-09-01",
    end_date: null,
    all_day: false,
    start_time: "17:30:00",
    end_time: "18:30:00",
    recurrence: "none",
    recurrence_interval: 1,
    weekdays: [],
    until_date: null,
    exdates: [],
    pause_school_holidays: false,
    person_ids: [],
    driver_id: null,
    pickup_id: null,
    checklist: [],
    remind_minutes_before: [60],
    remind_eve: false,
    countdown: false,
    created_by: null,
    created_at: "2026-08-20T10:00:00Z",
    updated_at: "2026-08-20T10:00:00Z",
    ...p,
  };
}

const HOLIDAYS: Holiday[] = [
  { name: "Vacances de la Toussaint", start: "2026-10-17", end: "2026-11-02" },
  { name: "Vacances de Noël", start: "2026-12-19", end: "2027-01-04" },
];

const dates = (occs: { date: string }[]) => occs.map((o) => o.date);

describe("expandEvent — événement simple", () => {
  it("renvoie l'événement s'il est dans la période", () => {
    const occ = expandEvent(ev({ start_date: "2026-11-25" }), "2026-11-23", "2026-11-29", []);
    expect(dates(occ)).toEqual(["2026-11-25"]);
  });

  it("ignore l'événement hors période", () => {
    expect(expandEvent(ev({ start_date: "2026-11-30" }), "2026-11-23", "2026-11-29", [])).toEqual([]);
    expect(expandEvent(ev({ start_date: "2026-11-22" }), "2026-11-23", "2026-11-29", [])).toEqual([]);
  });

  it("calcule les instants à l'heure de Paris (heure d'été et d'hiver)", () => {
    const [sept] = expandEvent(ev({ start_date: "2026-09-01" }), "2026-09-01", "2026-09-01", []);
    expect(sept.startAt?.toISOString()).toBe("2026-09-01T15:30:00.000Z");
    expect(sept.endAt?.toISOString()).toBe("2026-09-01T16:30:00.000Z");
    const [nov] = expandEvent(ev({ start_date: "2026-11-24" }), "2026-11-24", "2026-11-24", []);
    expect(nov.startAt?.toISOString()).toBe("2026-11-24T16:30:00.000Z");
  });

  it("journée entière : pas d'instant", () => {
    const [o] = expandEvent(ev({ start_date: "2026-11-25", all_day: true }), "2026-11-25", "2026-11-25", []);
    expect(o.startAt).toBeNull();
    expect(o.endAt).toBeNull();
  });

  it("sans heure de début : traité comme une journée", () => {
    const [o] = expandEvent(ev({ start_date: "2026-11-25", start_time: null, end_time: null }), "2026-11-25", "2026-11-25", []);
    expect(o.startAt).toBeNull();
  });

  it("fin avant le début : fin ignorée", () => {
    const [o] = expandEvent(ev({ start_date: "2026-11-25", start_time: "18:00", end_time: "17:00" }), "2026-11-25", "2026-11-25", []);
    expect(o.startAt).not.toBeNull();
    expect(o.endAt).toBeNull();
  });

  it("les vacances ne suspendent pas un événement ponctuel", () => {
    const occ = expandEvent(ev({ start_date: "2026-10-20", pause_school_holidays: true }), "2026-10-01", "2026-10-31", HOLIDAYS);
    expect(dates(occ)).toEqual(["2026-10-20"]);
  });

  it("période inversée : rien", () => {
    expect(expandEvent(ev({ start_date: "2026-11-25" }), "2026-11-30", "2026-11-01", [])).toEqual([]);
  });
});

describe("expandEvent — plusieurs jours", () => {
  const trip = ev({ title: "Ski", start_date: "2027-02-13", end_date: "2027-02-20", all_day: true });

  it("est renvoyé s'il chevauche le début de la période", () => {
    const occ = expandEvent(trip, "2027-02-15", "2027-02-21", []);
    expect(occ).toHaveLength(1);
    expect(occ[0].date).toBe("2027-02-13");
    expect(occ[0].endDate).toBe("2027-02-20");
  });

  it("n'est pas renvoyé s'il se termine avant la période", () => {
    expect(expandEvent(trip, "2027-02-21", "2027-02-28", [])).toEqual([]);
  });

  it("apparaît chaque jour couvert via occurrencesOn", () => {
    const occ = expandEvent(trip, "2027-02-15", "2027-02-21", []);
    expect(occurrencesOn(occ, "2027-02-17")).toHaveLength(1);
    expect(occurrencesOn(occ, "2027-02-21")).toHaveLength(0);
  });

  it("heure de fin sur le dernier jour", () => {
    const [o] = expandEvent(
      ev({ start_date: "2026-11-27", end_date: "2026-11-29", start_time: "18:00", end_time: "16:00" }),
      "2026-11-23",
      "2026-11-29",
      [],
    );
    expect(o.endAt?.toISOString()).toBe("2026-11-29T15:00:00.000Z");
  });

  it("récurrent sur plusieurs jours (week-end tous les mois)", () => {
    const e = ev({ start_date: "2026-11-28", end_date: "2026-11-29", recurrence: "monthly", all_day: true });
    // l'occurrence du 28-29 déc. chevauche le 29
    expect(dates(expandEvent(e, "2026-12-29", "2027-01-31", []))).toEqual(["2026-12-28", "2027-01-28"]);
    expect(dates(expandEvent(e, "2026-12-30", "2027-01-27", []))).toEqual([]);
  });
});

describe("expandEvent — quotidien", () => {
  it("chaque jour avec date de fin incluse", () => {
    const e = ev({ start_date: "2026-11-20", recurrence: "daily", until_date: "2026-11-26" });
    expect(dates(expandEvent(e, "2026-11-23", "2026-11-29", []))).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
    ]);
  });

  it("tous les 3 jours, aligné sur la date de début", () => {
    const e = ev({ start_date: "2026-11-01", recurrence: "daily", recurrence_interval: 3 });
    expect(dates(expandEvent(e, "2026-11-08", "2026-11-16", []))).toEqual(["2026-11-10", "2026-11-13", "2026-11-16"]);
  });

  it("ne commence pas avant start_date", () => {
    const e = ev({ start_date: "2026-11-26", recurrence: "daily" });
    expect(dates(expandEvent(e, "2026-11-23", "2026-11-27", []))).toEqual(["2026-11-26", "2026-11-27"]);
  });
});

describe("expandEvent — la piscine du mardi", () => {
  const piscine = ev({
    title: "Piscine",
    emoji: "🏊",
    start_date: "2026-09-01",
    until_date: "2026-12-15",
    recurrence: "weekly",
    weekdays: [2],
    pause_school_holidays: true,
  });

  it("tous les mardis, sauf pendant les vacances de la Toussaint (17 oct → 2 nov)", () => {
    const occ = expandEvent(piscine, "2026-10-01", "2026-11-30", HOLIDAYS);
    expect(dates(occ)).toEqual(["2026-10-06", "2026-10-13", "2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
  });

  it("reprend dès le mardi de la rentrée et s'arrête à until_date", () => {
    const occ = expandEvent(piscine, "2026-11-01", "2027-01-31", HOLIDAYS);
    expect(dates(occ)).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24", "2026-12-01", "2026-12-08", "2026-12-15"]);
  });

  it("sans suspension, les mardis des vacances sont gardés", () => {
    const occ = expandEvent({ ...piscine, pause_school_holidays: false }, "2026-10-14", "2026-11-04", HOLIDAYS);
    expect(dates(occ)).toEqual(["2026-10-20", "2026-10-27", "2026-11-03"]);
  });

  it("« Pas cette fois » : les exdates sont retirées", () => {
    const occ = expandEvent({ ...piscine, exdates: ["2026-11-10", "2026-11-24"] }, "2026-11-01", "2026-11-30", HOLIDAYS);
    expect(dates(occ)).toEqual(["2026-11-03", "2026-11-17"]);
  });

  it("weekdays vide = jour de start_date", () => {
    const occ = expandEvent({ ...piscine, weekdays: [] }, "2026-11-01", "2026-11-14", HOLIDAYS);
    expect(dates(occ)).toEqual(["2026-11-03", "2026-11-10"]);
  });

  it("start_date un lundi mais weekdays = mardi : premier mardi suivant", () => {
    const occ = expandEvent({ ...piscine, start_date: "2026-11-23" }, "2026-11-01", "2026-11-30", HOLIDAYS);
    expect(dates(occ)).toEqual(["2026-11-24"]);
  });
});

describe("expandEvent — hebdomadaire", () => {
  it("plusieurs jours par semaine", () => {
    const e = ev({ start_date: "2026-11-02", recurrence: "weekly", weekdays: [1, 3, 5] });
    expect(dates(expandEvent(e, "2026-11-23", "2026-11-29", []))).toEqual(["2026-11-23", "2026-11-25", "2026-11-27"]);
  });

  it("une semaine sur deux, comptée depuis la semaine de start_date", () => {
    // Démarre le mercredi 4 nov. 2026 ; semaines paires : 2-8 nov, 16-22 nov, 30 nov-6 déc
    const e = ev({ start_date: "2026-11-04", recurrence: "weekly", recurrence_interval: 2, weekdays: [1, 3] });
    expect(dates(expandEvent(e, "2026-11-01", "2026-12-06", []))).toEqual([
      "2026-11-04",
      "2026-11-16",
      "2026-11-18",
      "2026-11-30",
      "2026-12-02",
    ]);
  });

  it("une semaine sur deux, vacances en plus", () => {
    const e = ev({ start_date: "2026-10-06", recurrence: "weekly", recurrence_interval: 2, pause_school_holidays: true });
    expect(dates(expandEvent(e, "2026-10-01", "2026-11-30", HOLIDAYS))).toEqual(["2026-10-06", "2026-11-03", "2026-11-17"]);
  });
});

describe("expandEvent — mensuel et annuel", () => {
  it("même jour chaque mois", () => {
    const e = ev({ start_date: "2026-09-15", recurrence: "monthly" });
    expect(dates(expandEvent(e, "2026-11-01", "2027-01-31", []))).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);
  });

  it("fin de mois : le 31 devient le dernier jour des mois plus courts", () => {
    const e = ev({ start_date: "2027-01-31", recurrence: "monthly" });
    expect(dates(expandEvent(e, "2027-01-01", "2027-05-31", []))).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
      "2027-05-31",
    ]);
  });

  it("février d'une année bissextile", () => {
    const e = ev({ start_date: "2027-12-30", recurrence: "monthly" });
    expect(dates(expandEvent(e, "2028-02-01", "2028-03-31", []))).toEqual(["2028-02-29", "2028-03-30"]);
  });

  it("tous les 2 mois", () => {
    const e = ev({ start_date: "2026-01-10", recurrence: "monthly", recurrence_interval: 2 });
    expect(dates(expandEvent(e, "2026-10-01", "2027-03-31", []))).toEqual(["2026-11-10", "2027-01-10", "2027-03-10"]);
  });

  it("anniversaire chaque année", () => {
    const e = ev({ title: "Anniv de Jules", start_date: "2020-03-12", recurrence: "yearly", all_day: true });
    expect(dates(expandEvent(e, "2026-01-01", "2028-12-31", []))).toEqual(["2026-03-12", "2027-03-12", "2028-03-12"]);
  });

  it("né un 29 février", () => {
    const e = ev({ start_date: "2024-02-29", recurrence: "yearly", all_day: true });
    expect(dates(expandEvent(e, "2026-01-01", "2028-12-31", []))).toEqual(["2026-02-28", "2027-02-28", "2028-02-29"]);
  });

  it("exdates sur un mensuel", () => {
    const e = ev({ start_date: "2026-09-15", recurrence: "monthly", exdates: ["2026-12-15"] });
    expect(dates(expandEvent(e, "2026-11-01", "2027-01-31", []))).toEqual(["2026-11-15", "2027-01-15"]);
  });
});

describe("expandEvents", () => {
  it("trie par date puis heure, journées entières d'abord", () => {
    const occ = expandEvents(
      [
        ev({ id: "a", title: "Piscine", start_date: "2026-11-24", start_time: "17:30" }),
        ev({ id: "b", title: "École", start_date: "2026-11-24", start_time: "08:30" }),
        ev({ id: "c", title: "Fête", start_date: "2026-11-24", all_day: true }),
        ev({ id: "d", title: "Dentiste", start_date: "2026-11-23", start_time: "16:00" }),
      ],
      "2026-11-23",
      "2026-11-29",
      [],
    );
    expect(occ.map((o) => o.event.id)).toEqual(["d", "c", "b", "a"]);
  });
});

describe("outils", () => {
  it("weekStartISO renvoie le lundi", () => {
    expect(weekStartISO("2026-11-25")).toBe("2026-11-23");
    expect(weekStartISO("2026-11-29")).toBe("2026-11-23");
    expect(weekStartISO("2026-11-23")).toBe("2026-11-23");
  });

  it("weekdayOf", () => {
    expect(weekdayOf("2026-11-24")).toBe(2);
    expect(weekdayOf("2026-11-29")).toBe(7);
  });

  it("describeRecurrence", () => {
    const base = ev({ start_date: "2026-09-01" });
    expect(describeRecurrence(base)).toBe("");
    expect(describeRecurrence({ ...base, recurrence: "weekly", weekdays: [2] })).toBe("tous les mardis");
    expect(describeRecurrence({ ...base, recurrence: "weekly", weekdays: [] })).toBe("tous les mardis");
    expect(describeRecurrence({ ...base, recurrence: "weekly", weekdays: [4, 1] })).toBe("tous les lundis et jeudis");
    expect(describeRecurrence({ ...base, recurrence: "weekly", weekdays: [1, 2, 3, 4, 5] })).toBe("du lundi au vendredi");
    expect(describeRecurrence({ ...base, recurrence: "weekly", recurrence_interval: 2, weekdays: [3] })).toBe(
      "toutes les 2 semaines, le mercredi",
    );
    expect(describeRecurrence({ ...base, recurrence: "daily" })).toBe("tous les jours");
    expect(describeRecurrence({ ...base, recurrence: "monthly" })).toBe("tous les mois, le 1er");
    expect(describeRecurrence({ ...base, start_date: "2026-07-14", recurrence: "yearly" })).toBe("tous les ans, le 14 juillet");
    expect(
      describeRecurrence(
        { ...base, recurrence: "weekly", weekdays: [2], until_date: "2027-06-30", pause_school_holidays: true },
        { details: true },
      ),
    ).toBe("tous les mardis, jusqu'au 30 juin 2027 (sauf vacances scolaires)");
  });
});
