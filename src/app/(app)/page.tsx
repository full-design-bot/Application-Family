"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OccurrenceCard } from "@/components/agenda/OccurrenceCard";
import { DailyQuestionCard, MoodSummary, ThinkOfYouButton } from "@/components/couple";
import { Button, Card, EmptyState, SectionTitle, useToast } from "@/components/ui";
import { loadUpcoming, nextCountdownEvent, subscribeEvents, type CountdownOccurrence, type Occurrence } from "@/lib/agenda";
import { addDaysISO, formatDateFull, formatDayLong, toParisISODate, toParisTime, todayISO } from "@/lib/dates";
import { useFamily, useHolidays } from "@/lib/family";
import { holidayOn, nextHoliday } from "@/lib/holidays";
import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import type { Reminder } from "@/lib/types";

function greeting() {
  const h = Number(toParisTime(new Date()).slice(0, 2));
  if (h < 5) return "Bonne nuit";
  if (h < 18) return "Bonjour";
  return "Bonsoir";
}

export default function HomePage() {
  const { me, isParent, nameOf } = useFamily();
  const toast = useToast();
  const holidays = useHolidays();
  const today = todayISO();

  const [occurrences, setOccurrences] = useState<Occurrence[] | null>(null);
  const [countdown, setCountdown] = useState<CountdownOccurrence | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);

  const loadAgenda = useCallback(async () => {
    const [occ, cd] = await Promise.all([loadUpcoming(3), nextCountdownEvent()]);
    setOccurrences(occ);
    setCountdown(cd);
  }, []);

  const loadReminders = useCallback(async () => {
    const endOfToday = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { data } = await supabase()
      .from("reminders")
      .select("*")
      .is("done_at", null)
      .lte("due_at", endOfToday)
      .or(`assigned_to.is.null,assigned_to.eq.${me.id}`)
      .order("due_at");
    setReminders((data ?? []) as Reminder[]);
    setLoadedAt(Date.now());
  }, [me.id]);

  useEffect(() => {
    loadAgenda();
    loadReminders();
    const unsub = subscribeEvents(loadAgenda, "accueil");
    const sb = supabase();
    const ch = sb
      .channel("accueil-rappels")
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders" }, () => loadReminders())
      .subscribe();
    return () => {
      unsub();
      sb.removeChannel(ch);
    };
  }, [loadAgenda, loadReminders]);

  async function done(r: Reminder) {
    const { error } = await supabase().rpc("complete_reminder", { p_id: r.id });
    if (error) return toast("Impossible de valider", "error");
    toast("Bravo ✅", "success");
    if (r.created_by && r.created_by !== me.id) {
      notify({ to: [r.created_by], title: `✅ ${me.display_name} a fait : ${r.title}`, url: "/rappels" });
    }
    loadReminders();
  }

  const holidayNow = holidayOn(today, holidays);
  const upcomingHoliday = !holidayNow ? nextHoliday(today, holidays) : null;
  const daysToHoliday = upcomingHoliday
    ? Math.round((new Date(upcomingHoliday.start).getTime() - new Date(today).getTime()) / 86400000)
    : null;

  const groups: { label: string; items: Occurrence[] }[] = [
    { label: "Aujourd'hui", items: (occurrences ?? []).filter((o) => o.date <= today && (o.endDate ?? o.date) >= today) },
    { label: "Demain", items: (occurrences ?? []).filter((o) => o.date === addDaysISO(today, 1)) },
    { label: formatDayLong(addDaysISO(today, 2)), items: (occurrences ?? []).filter((o) => o.date === addDaysISO(today, 2)) },
  ];

  return (
    <>
      <header className="pb-2 pt-4">
        <p className="text-sm font-medium capitalize text-muted">{formatDayLong(today)}</p>
        <h1 className="text-[32px] font-bold leading-tight">
          {greeting()} {me.display_name} 👋
        </h1>
      </header>

      {holidayNow ? (
        <div className="mt-2 rounded-3xl bg-sand-soft px-4 py-3 text-sm">
          🏖️ <strong>{holidayNow.name}</strong> jusqu&apos;au {formatDateFull(addDaysISO(holidayNow.end, -1))}
        </div>
      ) : upcomingHoliday && daysToHoliday !== null && daysToHoliday <= 14 ? (
        <div className="mt-2 rounded-3xl bg-sand-soft px-4 py-3 text-sm">
          🏖️ {upcomingHoliday.name} dans <strong>{daysToHoliday} jour{daysToHoliday > 1 ? "s" : ""}</strong>
        </div>
      ) : null}

      {isParent && (
        <div className="mt-4 grid grid-cols-[auto_1fr] items-stretch gap-3">
          <ThinkOfYouButton />
          <MoodSummary />
        </div>
      )}

      {countdown && (
        <Link href={`/agenda/${countdown.event.id}`} className="mt-3 block rounded-3xl bg-accent p-4 text-accent-ink active:scale-[0.99] transition">
          <p className="text-sm font-medium opacity-90">Compte à rebours</p>
          <p className="mt-1 text-xl font-bold">
            {countdown.daysLeft === 0
              ? `C'est aujourd'hui : ${countdown.event.emoji} ${countdown.event.title} !`
              : `Plus que ${countdown.daysLeft} jour${countdown.daysLeft > 1 ? "s" : ""} avant ${countdown.event.emoji} ${countdown.event.title}`}
          </p>
        </Link>
      )}

      {reminders.length > 0 && (
        <>
          <SectionTitle action={<Link href="/rappels" className="text-sm font-semibold text-accent">Tout voir</Link>}>
            ⏰ Rappels
          </SectionTitle>
          <div className="space-y-2">
            {reminders.map((r) => {
              const late = new Date(r.due_at).getTime() < loadedAt;
              return (
                <Card key={r.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.title}</p>
                    <p className={`text-sm ${late ? "text-danger" : "text-muted"}`}>
                      {toParisISODate(r.due_at) === today ? `à ${toParisTime(r.due_at)}` : `${formatDayLong(toParisISODate(r.due_at))} ${toParisTime(r.due_at)}`}
                      {r.created_by && r.created_by !== me.id ? ` · de ${nameOf(r.created_by)}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="soft" onClick={() => done(r)}>
                    C&apos;est fait
                  </Button>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle action={<Link href="/agenda" className="text-sm font-semibold text-accent">Agenda</Link>}>
        📅 La famille
      </SectionTitle>
      {occurrences === null ? (
        <Card className="h-24 animate-pulse" />
      ) : occurrences.length === 0 ? (
        <Card>
          <EmptyState emoji="🌤️" title="Rien de prévu ces 3 jours" text="Profitez-en ! Ou ajoutez une activité." action={<Link href="/agenda/nouveau" className="font-semibold text-accent">＋ Ajouter</Link>} />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 px-1 text-sm font-semibold capitalize">{g.label}</p>
                <div className="space-y-2">
                  {g.items.map((o) => (
                    <OccurrenceCard key={`${o.event.id}-${o.date}`} occ={o} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {isParent && (
        <>
          <SectionTitle>💬 Nous deux</SectionTitle>
          <DailyQuestionCard />
        </>
      )}

      <SectionTitle>✨ Raccourcis</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {[
          { href: "/sorties", emoji: "📍", label: "Sorties", bg: "bg-sand-soft" },
          { href: "/listes", emoji: "📝", label: "Listes", bg: "bg-sage-soft" },
          { href: "/enfants", emoji: "👦👧", label: "Enfants", bg: "bg-sky-soft" },
          { href: "/dessin", emoji: "🎨", label: "Dessin", bg: "bg-rose-soft" },
          { href: "/rappels", emoji: "⏰", label: "Rappels", bg: "bg-accent-soft" },
          { href: "/souvenirs", emoji: "📸", label: "Souvenirs", bg: "bg-card-2" },
        ].map((t) => (
          <Link key={t.href} href={t.href} className={`flex flex-col items-center rounded-3xl py-4 ${t.bg} active:scale-[0.97] transition`}>
            <span className="text-2xl">{t.emoji}</span>
            <span className="mt-1 text-sm font-semibold">{t.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
