"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { OccurrenceCard } from "@/components/agenda/OccurrenceCard";
import { holidayLabel } from "@/components/agenda/shared";
import { Avatar, Chip, EmptyState, IconButton, LoadingBlock, PageHeader, Segmented, cn, useToast } from "@/components/ui";
import { isOccurrencePast, loadOccurrences, subscribeEvents } from "@/lib/agenda";
import { addDaysISO, daysBetween, formatDayLong, todayISO } from "@/lib/dates";
import { useFamily, useHolidays } from "@/lib/family";
import { holidayOn, nextHoliday, type Holiday } from "@/lib/holidays";
import { occurrencesOn, weekStartISO, type Occurrence } from "@/lib/recurrence";

type View = "semaine" | "liste";
const LIST_DAYS = 60;
const isISODate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default function AgendaPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Agenda />
    </Suspense>
  );
}

function matchesPerson(occ: Occurrence, personId: string | null) {
  if (!personId) return true;
  const e = occ.event;
  return e.person_ids.includes(personId) || e.driver_id === personId || e.pickup_id === personId;
}

function Agenda() {
  const sp = useSearchParams();
  const param = sp.get("date");
  const toast = useToast();
  const { people } = useFamily();
  const holidays = useHolidays();
  const today = todayISO();

  const [view, setView] = useState<View>(sp.get("vue") === "liste" ? "liste" : "semaine");
  const [weekStart, setWeekStart] = useState(() => weekStartISO(isISODate(param) ? param : today));
  const [filter, setFilter] = useState<string | null>(null);
  const [occs, setOccs] = useState<Occurrence[] | null>(null);
  const reqId = useRef(0);

  const from = view === "semaine" ? weekStart : today;
  const to = view === "semaine" ? addDaysISO(weekStart, 6) : addDaysISO(today, LIST_DAYS - 1);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const list = await loadOccurrences(from, to);
      if (id === reqId.current) setOccs(list);
    } catch {
      if (id === reqId.current) {
        setOccs([]);
        toast("Impossible de charger l'agenda 😕", "error");
      }
    }
  }, [from, to, toast]);

  useEffect(() => {
    setOccs(null);
    load();
  }, [load]);

  useEffect(() => subscribeEvents(() => load(), "agenda-page-events"), [load]);

  const filtered = useMemo(() => (occs ?? []).filter((o) => matchesPerson(o, filter)), [occs, filter]);
  const thisWeek = weekStartISO(today);
  const newHref = `/agenda/nouveau?date=${view === "semaine" && weekStart !== thisWeek ? weekStart : today}`;

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={view === "semaine" ? "La semaine de la famille" : "Ce qui arrive bientôt"}
        action={
          <Link href={newHref} aria-label="Nouvel événement" className="inline-flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm active:brightness-95">
            <Plus className="size-6" />
          </Link>
        }
      />

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "semaine", label: "📅 Semaine" },
          { value: "liste", label: "📋 À venir" },
        ]}
      />

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        <Chip active={!filter} onClick={() => setFilter(null)}>
          Tout le monde
        </Chip>
        {people.map((p) => (
          <Chip key={p.id} active={filter === p.id} color={p.color} onClick={() => setFilter(filter === p.id ? null : p.id)} className="pl-1">
            <Avatar person={p} size={24} /> {p.name}
          </Chip>
        ))}
      </div>

      <div className="mt-2 flex gap-2 text-sm">
        <Link href="/rappels" className="rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent">⏰ Rappels</Link>
        <Link href="/listes" className="rounded-full bg-sage-soft px-3 py-1.5 font-medium">📝 Listes</Link>
      </div>

      {view === "semaine" ? (
        <WeekView
          weekStart={weekStart}
          today={today}
          occs={occs === null ? null : filtered}
          holidays={holidays}
          onPrev={() => setWeekStart(addDaysISO(weekStart, -7))}
          onNext={() => setWeekStart(addDaysISO(weekStart, 7))}
          onToday={() => setWeekStart(thisWeek)}
        />
      ) : (
        <ListView today={today} to={to} occs={occs === null ? null : filtered} holidays={holidays} filtered={!!filter} />
      )}
    </>
  );
}

// -------------------------------------------------------------------- vue semaine
function weekTitle(start: string) {
  const end = addDaysISO(start, 6);
  const s = parseISO(start);
  const e = parseISO(end);
  if (s.getMonth() === e.getMonth()) return `Du ${format(s, "d")} au ${format(e, "d MMMM", { locale: fr })}`;
  return `Du ${format(s, "d MMM", { locale: fr })} au ${format(e, "d MMM", { locale: fr })}`;
}

function HolidayBanner({ h }: { h: Holiday }) {
  return <div className="rounded-2xl bg-sand-soft px-4 py-3 font-medium">🏖️ {holidayLabel(h)}</div>;
}

function WeekView({
  weekStart,
  today,
  occs,
  holidays,
  onPrev,
  onNext,
  onToday,
}: {
  weekStart: string;
  today: string;
  occs: Occurrence[] | null;
  holidays: Holiday[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const weekEnd = days[6];
  const inWeek = holidays.filter((h) => h.start <= weekEnd && h.end > weekStart);
  const upcoming = !inWeek.length && weekEnd >= today ? nextHoliday(weekStart, holidays) : null;
  const isThisWeek = weekStart === weekStartISO(today);

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-1">
        <IconButton label="Semaine précédente" onClick={onPrev} className="bg-card border border-line">
          <ChevronLeft className="size-5" />
        </IconButton>
        <button type="button" onClick={onToday} className="flex-1 text-center">
          <span className="block font-bold">{weekTitle(weekStart)}</span>
          <span className={cn("block text-xs", isThisWeek ? "text-accent font-semibold" : "text-muted")}>
            {isThisWeek ? "Cette semaine" : "Revenir à aujourd'hui"}
          </span>
        </button>
        <IconButton label="Semaine suivante" onClick={onNext} className="bg-card border border-line">
          <ChevronRight className="size-5" />
        </IconButton>
      </div>

      <div className="space-y-2">
        {inWeek.map((h) => (
          <HolidayBanner key={h.start} h={h} />
        ))}
        {upcoming && daysBetween(today, upcoming.start) <= 45 && (
          <p className="px-1 text-sm text-muted">
            🏖️ Prochaines vacances dans {daysBetween(today, upcoming.start)} jours — {holidayLabel(upcoming)}
          </p>
        )}
      </div>

      {occs === null ? (
        <LoadingBlock />
      ) : (
        <div className="mt-3 space-y-3">
          {days.map((day) => {
            const list = occurrencesOn(occs, day);
            const isToday = day === today;
            const holiday = holidayOn(day, holidays);
            return (
              <section
                key={day}
                className={cn("rounded-3xl p-2", isToday ? "bg-accent-soft ring-2 ring-accent/50" : day < today ? "opacity-70" : "")}
              >
                <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
                  <span className={cn("text-sm font-bold capitalize", isToday ? "text-accent" : "text-ink")}>{formatDayLong(day)}</span>
                  {isToday && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">Aujourd&apos;hui</span>}
                  {holiday && <span title={holiday.name}>🏖️</span>}
                  <Link href={`/agenda/nouveau?date=${day}`} aria-label={`Ajouter le ${formatDayLong(day)}`} className="ml-auto inline-flex size-8 items-center justify-center rounded-full text-muted active:bg-card-2">
                    <Plus className="size-4" />
                  </Link>
                </div>
                {list.length ? (
                  <div className="space-y-2">
                    {list.map((o) => (
                      <OccurrenceCard key={`${o.event.id}-${o.date}`} occ={o} />
                    ))}
                  </div>
                ) : (
                  <p className="px-2 pb-1 text-sm text-muted">{holiday ? "Vacances, rien de prévu 😎" : "Rien de prévu"}</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------- vue liste
function dayHeading(day: string, today: string) {
  if (day === today) return "Aujourd'hui";
  if (day === addDaysISO(today, 1)) return "Demain";
  return formatDayLong(day);
}

function ListView({
  today,
  to,
  occs,
  holidays,
  filtered,
}: {
  today: string;
  to: string;
  occs: Occurrence[] | null;
  holidays: Holiday[];
  filtered: boolean;
}) {
  if (occs === null) return <LoadingBlock />;
  const upcoming = occs.filter((o) => !isOccurrencePast(o));

  // Regroupe par jour de début ; les vacances s'intercalent à leur date de début.
  type Row = { kind: "day"; day: string; items: Occurrence[] } | { kind: "holiday"; day: string; h: Holiday };
  const rows: Row[] = [];
  for (const o of upcoming) {
    const day = o.date < today ? today : o.date;
    const last = rows[rows.length - 1];
    if (last?.kind === "day" && last.day === day) last.items.push(o);
    else rows.push({ kind: "day", day, items: [o] });
  }
  for (const h of holidays.filter((x) => x.start <= to && x.end > today)) {
    rows.push({ kind: "holiday", day: h.start < today ? today : h.start, h });
  }
  rows.sort((a, b) => (a.day === b.day ? (a.kind === "holiday" ? -1 : 1) : a.day < b.day ? -1 : 1));

  if (!upcoming.length) {
    return (
      <>
        <div className="mt-4 space-y-2">
          {rows.map((r) => r.kind === "holiday" && <HolidayBanner key={r.h.start} h={r.h} />)}
        </div>
        <EmptyState
          emoji="🌤️"
          title={filtered ? "Rien de prévu pour cette personne" : "Rien de prévu pour l'instant"}
          text="Ajoute la piscine, le dentiste ou le prochain anniversaire."
        />
      </>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {rows.map((r) =>
        r.kind === "holiday" ? (
          <HolidayBanner key={`h-${r.h.start}`} h={r.h} />
        ) : (
          <section key={r.day}>
            <h3 className={cn("mb-1.5 mt-3 px-1 text-sm font-bold capitalize", r.day === today ? "text-accent" : "text-muted")}>
              {dayHeading(r.day, today)}
            </h3>
            <div className="space-y-2">
              {r.items.map((o) => (
                <OccurrenceCard key={`${o.event.id}-${o.date}`} occ={o} showDate={false} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
