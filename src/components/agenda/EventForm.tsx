"use client";

// Formulaire partagé de création / modification d'un événement de l'agenda.

import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { Avatar, Button, Card, Chip, Field, Input, SectionTitle, Segmented, Textarea, Toggle, cn, useToast } from "@/components/ui";
import { todayISO, WEEKDAYS_FR } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { describeRecurrence, weekdayOf } from "@/lib/recurrence";
import type { EventRow, Person, Recurrence } from "@/lib/types";
import { CHECKLIST_SUGGESTIONS, EVENT_EMOJIS, REMINDER_OPTIONS } from "./shared";

/** Champs modifiables d'un événement */
export type EventDraft = Omit<EventRow, "id" | "created_by" | "created_at" | "updated_at">;

/** Brouillon vide (avec valeurs de départ éventuelles) */
export function emptyDraft(p: Partial<EventDraft> = {}): EventDraft {
  return {
    space: "family",
    title: "",
    emoji: "📅",
    notes: null,
    location: null,
    start_date: todayISO(),
    end_date: null,
    all_day: false,
    start_time: null,
    end_time: null,
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
    ...p,
  };
}

/** Extrait le brouillon d'une ligne existante */
export function draftFromEvent(e: EventRow): EventDraft {
  const { id, created_by, created_at, updated_at, ...rest } = e;
  void id;
  void created_by;
  void created_at;
  void updated_at;
  return { ...rest, start_time: rest.start_time?.slice(0, 5) ?? null, end_time: rest.end_time?.slice(0, 5) ?? null };
}

const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Une fois" },
  { value: "daily", label: "Chaque jour" },
  { value: "weekly", label: "Chaque semaine" },
  { value: "monthly", label: "Chaque mois" },
  { value: "yearly", label: "Chaque année" },
];

const UNIT: Record<Recurrence, [string, string]> = {
  none: ["", ""],
  daily: ["jour", "jours"],
  weekly: ["semaine", "semaines"],
  monthly: ["mois", "mois"],
  yearly: ["an", "ans"],
};

/** Normalise le brouillon avant enregistrement. Renvoie un message d'erreur ou le brouillon prêt. */
function finalize(d: EventDraft): { error: string } | { draft: EventDraft } {
  const title = d.title.trim();
  if (!title) return { error: "Donne un petit nom à l'événement ✏️" };
  if (!d.start_date) return { error: "Choisis une date 📅" };
  const out: EventDraft = {
    ...d,
    title,
    emoji: d.emoji.trim() || "📅",
    notes: d.notes?.trim() || null,
    location: d.location?.trim() || null,
    checklist: d.checklist.map((c) => c.trim()).filter(Boolean),
    remind_minutes_before: [...new Set(d.remind_minutes_before)].sort((a, b) => a - b),
  };
  if (out.end_date && out.end_date <= out.start_date) out.end_date = null;
  if (out.all_day) {
    out.start_time = null;
    out.end_time = null;
  } else {
    if (!out.start_time) return { error: "Choisis une heure, ou coche « Journée entière » 🕐" };
    if (!out.end_time) out.end_time = null;
    if (!out.end_date && out.end_time && out.end_time <= out.start_time) return { error: "L'heure de fin est avant le début 🤔" };
  }
  if (out.recurrence === "none") {
    out.recurrence_interval = 1;
    out.weekdays = [];
    out.until_date = null;
    out.pause_school_holidays = false;
  } else {
    out.recurrence_interval = Math.max(1, Math.min(52, Math.round(out.recurrence_interval || 1)));
    if (out.recurrence !== "weekly") out.weekdays = [];
    else if (!out.weekdays.length) out.weekdays = [weekdayOf(out.start_date)];
    if (out.until_date && out.until_date < out.start_date) return { error: "La date de fin de la répétition est avant le début" };
  }
  return { draft: out };
}

export function EventForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: EventDraft;
  submitLabel: string;
  onSubmit: (draft: EventDraft) => Promise<void>;
}) {
  const { people, isParent } = useFamily();
  const toast = useToast();
  const [d, setD] = useState<EventDraft>(initial);
  const [multiDay, setMultiDay] = useState(!!initial.end_date);
  const [checkInput, setCheckInput] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<EventDraft>) => setD((prev) => ({ ...prev, ...patch }));

  const parents = people.filter((p) => p.kind === "parent");
  const sortedPeople = [...people].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "child" ? -1 : 1));
  const suggestions = (CHECKLIST_SUGGESTIONS[d.emoji] ?? []).filter((s) => !d.checklist.includes(s));
  const noReminder = d.remind_minutes_before.length === 0 && !d.remind_eve;

  function togglePerson(id: string) {
    set({ person_ids: d.person_ids.includes(id) ? d.person_ids.filter((x) => x !== id) : [...d.person_ids, id] });
  }

  function setRecurrence(r: Recurrence) {
    set({ recurrence: r, weekdays: r === "weekly" && !d.weekdays.length ? [weekdayOf(d.start_date)] : d.weekdays });
  }

  function toggleWeekday(n: number) {
    const next = d.weekdays.includes(n) ? d.weekdays.filter((x) => x !== n) : [...d.weekdays, n].sort();
    set({ weekdays: next });
  }

  function addCheck(text: string) {
    const t = text.trim();
    if (!t || d.checklist.includes(t)) return;
    set({ checklist: [...d.checklist, t] });
    setCheckInput("");
  }

  function toggleReminder(min: number) {
    const has = d.remind_minutes_before.includes(min);
    set({ remind_minutes_before: has ? d.remind_minutes_before.filter((m) => m !== min) : [...d.remind_minutes_before, min] });
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const res = finalize({ ...d, end_date: multiDay ? d.end_date : null });
    if ("error" in res) return toast(res.error, "error");
    setBusy(true);
    try {
      await onSubmit(res.draft);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Oups, l'enregistrement a échoué", "error");
    } finally {
      setBusy(false);
    }
  }

  const unit = UNIT[d.recurrence][d.recurrence_interval > 1 ? 1 : 0];
  const recurrenceSummary = describeRecurrence(finalizeForPreview(d), { details: true });

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* ------------------------------------------------ Quoi */}
      <Card className="space-y-3">
        <div className="flex gap-2">
          <Input
            aria-label="Emoji"
            value={d.emoji}
            onChange={(e) => set({ emoji: e.target.value })}
            className="w-16 shrink-0 px-0 text-center text-2xl"
            maxLength={8}
          />
          <Input
            placeholder="Piscine, dentiste, anniversaire de Léa…"
            value={d.title}
            onChange={(e) => set({ title: e.target.value })}
            aria-label="Titre"
            autoFocus={!initial.title}
          />
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {EVENT_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => set({ emoji: em })}
              className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl text-xl transition", d.emoji === em ? "bg-accent-soft ring-2 ring-accent" : "bg-card-2")}
            >
              {em}
            </button>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------ Qui */}
      <SectionTitle>Qui est concerné ?</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {sortedPeople.map((p) => (
          <Chip key={p.id} active={d.person_ids.includes(p.id)} color={p.color} onClick={() => togglePerson(p.id)} className="h-11 pl-1.5 pr-4">
            <Avatar person={p} size={30} /> {p.name}
          </Chip>
        ))}
      </div>

      {/* ------------------------------------------------ Quand */}
      <SectionTitle>Quand ?</SectionTitle>
      <Card className="space-y-3">
        <Field label={multiDay ? "Du" : "Date"}>
          <Input type="date" value={d.start_date} onChange={(e) => set({ start_date: e.target.value })} required />
        </Field>
        <Toggle checked={multiDay} onChange={setMultiDay} label="Sur plusieurs jours" description="Week-end, vacances, stage…" />
        {multiDay && (
          <Field label="Jusqu'au (inclus)">
            <Input type="date" value={d.end_date ?? ""} min={d.start_date} onChange={(e) => set({ end_date: e.target.value || null })} />
          </Field>
        )}
        <Toggle checked={d.all_day} onChange={(v) => set({ all_day: v })} label="Journée entière" />
        {!d.all_day && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Début">
              <Input type="time" value={d.start_time ?? ""} onChange={(e) => set({ start_time: e.target.value || null })} />
            </Field>
            <Field label="Fin">
              <Input type="time" value={d.end_time ?? ""} onChange={(e) => set({ end_time: e.target.value || null })} />
            </Field>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------ Répétition */}
      <SectionTitle>Ça se répète ?</SectionTitle>
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {RECURRENCES.map((r) => (
            <Chip key={r.value} active={d.recurrence === r.value} onClick={() => setRecurrence(r.value)}>
              {r.label}
            </Chip>
          ))}
        </div>

        {d.recurrence !== "none" && (
          <>
            {d.recurrence === "weekly" && (
              <div className="flex justify-between gap-1">
                {WEEKDAYS_FR.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={name}
                    aria-pressed={d.weekdays.includes(i + 1)}
                    onClick={() => toggleWeekday(i + 1)}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-full text-sm font-bold uppercase transition",
                      d.weekdays.includes(i + 1) ? "bg-accent text-accent-ink" : "bg-card-2 text-muted",
                    )}
                  >
                    {name[0]}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 px-1">
              <span className="font-medium">
                Tous les {d.recurrence_interval > 1 ? `${d.recurrence_interval} ` : ""}
                {unit}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Moins"
                  onClick={() => set({ recurrence_interval: Math.max(1, d.recurrence_interval - 1) })}
                  className="flex size-10 items-center justify-center rounded-full bg-card-2"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center font-bold">{d.recurrence_interval}</span>
                <button
                  type="button"
                  aria-label="Plus"
                  onClick={() => set({ recurrence_interval: Math.min(52, d.recurrence_interval + 1) })}
                  className="flex size-10 items-center justify-center rounded-full bg-card-2"
                >
                  <Plus className="size-4" />
                </button>
              </span>
            </div>

            <Field label="Jusqu'au (facultatif)" hint="Par exemple la fin de l'année scolaire">
              <div className="flex gap-2">
                <Input type="date" value={d.until_date ?? ""} min={d.start_date} onChange={(e) => set({ until_date: e.target.value || null })} />
                {d.until_date && (
                  <button type="button" aria-label="Effacer" onClick={() => set({ until_date: null })} className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card-2">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </Field>

            <Toggle
              checked={d.pause_school_holidays}
              onChange={(v) => set({ pause_school_holidays: v })}
              label="Suspendre pendant les vacances scolaires 🏖️"
              description="Zone A — Bordeaux"
            />
            {recurrenceSummary && <p className="rounded-2xl bg-card-2 px-3 py-2 text-sm">🔁 {recurrenceSummary}</p>}
          </>
        )}
      </Card>

      {/* ------------------------------------------------ Où & trajets */}
      <SectionTitle>Où et qui conduit ?</SectionTitle>
      <Card className="space-y-3">
        <Field label="Lieu">
          <Input placeholder="Piscine Judaïque, école…" value={d.location ?? ""} onChange={(e) => set({ location: e.target.value })} />
        </Field>
        {parents.length > 0 && (
          <>
            <RidePicker label="🚗 Qui emmène ?" value={d.driver_id} onChange={(v) => set({ driver_id: v })} parents={parents} />
            <RidePicker label="🏁 Qui récupère ?" value={d.pickup_id} onChange={(v) => set({ pickup_id: v })} parents={parents} />
          </>
        )}
      </Card>

      {/* ------------------------------------------------ À ne pas oublier */}
      <SectionTitle>À ne pas oublier 🎒</SectionTitle>
      <Card className="space-y-3">
        {d.checklist.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.checklist.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-sand-soft py-1 pl-3 pr-1 text-sm font-medium">
                {c}
                <button type="button" aria-label={`Retirer ${c}`} onClick={() => set({ checklist: d.checklist.filter((x) => x !== c) })} className="flex size-7 items-center justify-center rounded-full active:bg-card-2">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="Maillot, bonnet…"
            value={checkInput}
            onChange={(e) => setCheckInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCheck(checkInput);
              }
            }}
          />
          <Button type="button" variant="soft" onClick={() => addCheck(checkInput)} className="h-12 shrink-0" aria-label="Ajouter">
            <Plus className="size-5" />
          </Button>
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <Chip key={s} onClick={() => addCheck(s)} className="text-muted">
                + {s}
              </Chip>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------ Rappels */}
      <SectionTitle>Rappels 🔔</SectionTitle>
      <Card className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Chip active={noReminder} onClick={() => set({ remind_minutes_before: [], remind_eve: false })}>
            Aucun
          </Chip>
          {REMINDER_OPTIONS.map((o) => (
            <Chip key={o.minutes} active={d.remind_minutes_before.includes(o.minutes)} onClick={() => toggleReminder(o.minutes)}>
              {o.label} avant
            </Chip>
          ))}
          <Chip active={d.remind_eve} onClick={() => set({ remind_eve: !d.remind_eve })}>
            La veille au soir
          </Chip>
        </div>
        <p className="px-1 text-xs text-muted">
          {d.driver_id ? "Envoyé à celui ou celle qui emmène." : "Envoyé aux deux parents."}
          {d.all_day && d.remind_minutes_before.length > 0 && " Pour une journée entière, seul le rappel de la veille s'applique."}
          {d.checklist.length > 0 && !d.remind_eve && " La liste « à ne pas oublier » est aussi rappelée la veille à 19 h."}
        </p>
      </Card>

      {/* ------------------------------------------------ Options */}
      <SectionTitle>Options</SectionTitle>
      <Card className="space-y-3">
        <Toggle checked={d.countdown} onChange={(v) => set({ countdown: v })} label="Compte à rebours sur l'accueil ⏳" description="« Plus que 12 dodos ! »" />
        {isParent && (
          <Segmented
            value={d.space}
            onChange={(v) => set({ space: v })}
            options={[
              { value: "family", label: "👨‍👩‍👧‍👦 Famille" },
              { value: "couple", label: "💑 Rien que nous deux" },
            ]}
          />
        )}
        <Field label="Notes">
          <Textarea placeholder="Code du portail, numéro du coach…" value={d.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </Card>

      <Button type="submit" size="lg" className="mt-2 w-full" loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}

function RidePicker({
  label,
  value,
  onChange,
  parents,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  parents: Person[];
}) {
  return (
    <div>
      <p className="mb-1 px-1 text-sm font-medium text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        <Chip active={!value} onClick={() => onChange(null)}>
          Personne
        </Chip>
        {parents.map((p) => (
          <Chip key={p.id} active={value === p.id} color={p.color} onClick={() => onChange(value === p.id ? null : p.id)} className="pl-1">
            <Avatar person={p} size={24} /> {p.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** Aperçu de la récurrence pendant la saisie (sans validation) */
function finalizeForPreview(d: EventDraft): EventDraft {
  return { ...d, weekdays: d.recurrence === "weekly" && !d.weekdays.length ? [weekdayOf(d.start_date)] : d.weekdays };
}
