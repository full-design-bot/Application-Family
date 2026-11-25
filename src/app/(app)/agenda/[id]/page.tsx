"use client";

// Détail d'un événement : consultation, modification, « Pas cette fois », suppression.
// /agenda/<id>?date=YYYY-MM-DD  (date = occurrence concernée pour un événement récurrent)

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { EventForm, draftFromEvent, type EventDraft } from "@/components/agenda/EventForm";
import { useRideLabel } from "@/components/agenda/OccurrenceCard";
import { REMINDER_OPTIONS } from "@/components/agenda/shared";
import { Avatar, Button, Card, EmptyState, LinkButton, LoadingBlock, PageHeader, SectionTitle, Sheet, useToast } from "@/components/ui";
import { formatOccurrenceTime, subscribeEvents } from "@/lib/agenda";
import { addDaysISO, daysBetween, formatDateFull, formatDayLong, formatDayShort, todayISO } from "@/lib/dates";
import { useFamily, useHolidays } from "@/lib/family";
import { notify } from "@/lib/push/client";
import { describeRecurrence, expandEvent } from "@/lib/recurrence";
import { supabase } from "@/lib/supabase/client";
import type { EventRow } from "@/lib/types";

export default function EventPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <EventDetail />
    </Suspense>
  );
}

function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const holidays = useHolidays();
  const { me, personById } = useFamily();
  const ride = useRideLabel();

  const [event, setEvent] = useState<EventRow | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase().from("events").select("*").eq("id", id).maybeSingle();
    setEvent((data as EventRow | null) ?? null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => subscribeEvents(() => load(), `agenda-event-${id}`), [id, load]);

  const today = todayISO();
  const paramDate = sp.get("date");

  // Occurrence affichée : celle de l'URL, sinon la prochaine.
  const occ = useMemo(() => {
    if (!event) return null;
    const target = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : null;
    if (target) return expandEvent(event, target, target, holidays).find((o) => o.date === target) ?? null;
    const next = expandEvent(event, today, addDaysISO(today, 400), holidays).find((o) => (o.endDate ?? o.date) >= today);
    return next ?? expandEvent(event, event.start_date, event.start_date, [])[0] ?? null;
  }, [event, paramDate, today, holidays]);

  if (event === undefined) return <LoadingBlock />;
  if (event === null) {
    return (
      <>
        <PageHeader title="Agenda" back="/agenda" />
        <EmptyState emoji="🫥" title="Cet événement n'existe plus" text="Il a peut-être été supprimé." action={<LinkButton href="/agenda">Retour à l&apos;agenda</LinkButton>} />
      </>
    );
  }

  const e = event;
  const recurring = e.recurrence !== "none";
  const occDate = occ?.date ?? paramDate ?? e.start_date;

  async function save(d: EventDraft) {
    const { error } = await supabase()
      .from("events")
      .update({ ...d, updated_at: new Date().toISOString() })
      .eq("id", e.id);
    if (error) throw new Error("Impossible d'enregistrer 😕");
    notify({ title: `✏️ Modifié : ${d.emoji} ${d.title}`, body: `${me.display_name} a mis à jour l'agenda`, url: `/agenda/${e.id}`, tag: `event-edit-${e.id}` });
    toast("Modifications enregistrées ✅", "success");
    setEditing(false);
    load();
  }

  async function skipThisOne() {
    setBusy(true);
    const exdates = [...new Set([...(e.exdates ?? []), occDate])].sort();
    const { error } = await supabase().from("events").update({ exdates, updated_at: new Date().toISOString() }).eq("id", e.id);
    setBusy(false);
    if (error) return toast("Oups, ça n'a pas marché", "error");
    notify({ title: `🙅 Pas de ${e.title} ${formatDayLong(occDate)}`, body: `${me.display_name} l'a retiré de l'agenda`, url: "/agenda", tag: `event-skip-${e.id}` });
    toast(`Pas de ${e.title} le ${formatDayShort(occDate)} 👍`, "success");
    router.push(`/agenda?date=${occDate}`);
  }

  async function stopFromHere() {
    setBusy(true);
    const until = addDaysISO(occDate, -1);
    const res =
      until < e.start_date
        ? await supabase().from("events").delete().eq("id", e.id)
        : await supabase().from("events").update({ until_date: until, updated_at: new Date().toISOString() }).eq("id", e.id);
    setBusy(false);
    if (res.error) return toast("Oups, ça n'a pas marché", "error");
    notify({ title: `🛑 Fini : ${e.emoji} ${e.title}`, body: `Plus rien à partir du ${formatDayShort(occDate)}`, url: "/agenda", tag: `event-stop-${e.id}` });
    toast("C'est arrêté à partir de cette date", "success");
    router.push(`/agenda?date=${occDate}`);
  }

  async function removeAll() {
    setBusy(true);
    const { error } = await supabase().from("events").delete().eq("id", e.id);
    setBusy(false);
    if (error) return toast("Oups, ça n'a pas marché", "error");
    notify({ title: `🗑️ Supprimé : ${e.emoji} ${e.title}`, body: `${me.display_name} l'a retiré de l'agenda`, url: "/agenda", tag: `event-del-${e.id}` });
    toast("Supprimé de l'agenda", "success");
    router.push("/agenda");
  }

  if (editing) {
    return (
      <>
        <PageHeader title="Modifier" back={`/agenda/${e.id}?date=${occDate}`} action={<Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Annuler</Button>} />
        <EventForm initial={draftFromEvent(e)} submitLabel="Enregistrer" onSubmit={save} />
      </>
    );
  }

  const persons = e.person_ids.map((pid) => personById(pid)).filter((p) => !!p);
  const rideLine = ride(e.driver_id, e.pickup_id);
  const reminders = [
    ...REMINDER_OPTIONS.filter((o) => e.remind_minutes_before.includes(o.minutes)).map((o) => `${o.label} avant`),
    ...e.remind_minutes_before.filter((m) => !REMINDER_OPTIONS.some((o) => o.minutes === m)).map((m) => `${m} min avant`),
    ...(e.remind_eve ? ["la veille au soir"] : []),
  ];
  const daysLeft = occ ? daysBetween(today, occ.date) : null;

  return (
    <>
      <PageHeader title="" back={`/agenda?date=${occDate}`} action={<Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil className="size-4" /> Modifier</Button>} />

      <Card className={e.space === "couple" ? "border-rose/40 bg-rose-soft" : undefined}>
        <div className="flex items-start gap-3">
          <span className="text-5xl leading-none">{e.emoji}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight">{e.title}</h1>
            {e.space === "couple" && <p className="text-sm font-medium text-rose">💑 Rien que nous deux</p>}
            {recurring && <p className="mt-0.5 text-muted">🔁 {describeRecurrence(e, { details: true })}</p>}
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <p className="font-semibold capitalize">
            {occ ? formatDayLong(occ.date) : formatDayLong(occDate)}
            {occ?.endDate && <> → {formatDayLong(occ.endDate)}</>}
          </p>
          {occ && <p className="text-muted">🕐 {formatOccurrenceTime(occ)}</p>}
          {!occ && recurring && <p className="text-sm text-muted">Aucune occurrence ce jour-là (vacances, ou « pas cette fois »).</p>}
          {e.countdown && daysLeft !== null && daysLeft > 0 && (
            <p className="font-medium text-accent">⏳ Plus que {daysLeft} dodo{daysLeft > 1 ? "s" : ""} !</p>
          )}
          {e.location && (
            <a href={`https://maps.apple.com/?q=${encodeURIComponent(e.location)}`} className="flex items-center gap-1.5 text-sky underline-offset-2 active:underline">
              <MapPin className="size-4" /> {e.location}
            </a>
          )}
        </div>
      </Card>

      {persons.length > 0 && (
        <>
          <SectionTitle>Qui</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {persons.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3 font-medium">
                <Avatar person={p} size={28} /> {p.name}
              </span>
            ))}
          </div>
        </>
      )}

      {rideLine && (
        <>
          <SectionTitle>Trajets</SectionTitle>
          <Card className="py-3">{rideLine}</Card>
        </>
      )}

      {e.checklist.length > 0 && (
        <>
          <SectionTitle>À ne pas oublier 🎒</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {e.checklist.map((c) => (
              <span key={c} className="rounded-full bg-sand-soft px-3 py-1.5 font-medium">{c}</span>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Rappels</SectionTitle>
      <Card className="py-3 text-sm">
        {reminders.length ? `🔔 ${reminders.join(", ")}` : "🔕 Pas de rappel"}
        {e.checklist.length > 0 && !e.remind_eve && <span className="block text-muted">🎒 La liste est rappelée la veille à 19 h.</span>}
      </Card>

      {e.notes && (
        <>
          <SectionTitle>Notes</SectionTitle>
          <Card className="whitespace-pre-wrap">{e.notes}</Card>
        </>
      )}

      {recurring && (e.exdates?.length ?? 0) > 0 && (
        <p className="mt-3 px-1 text-xs text-muted">Sauf : {e.exdates.map((d) => formatDateFull(d)).join(", ")}</p>
      )}

      <div className="mt-6 space-y-2">
        {recurring && occ && (
          <Button variant="soft" className="w-full" onClick={skipThisOne} loading={busy}>
            🙅 Pas cette fois ({formatDayShort(occ.date)})
          </Button>
        )}
        <Button variant="secondary" className="w-full text-danger" onClick={() => setAskDelete(true)}>
          <Trash2 className="size-4" /> Supprimer
        </Button>
      </div>

      <Sheet open={askDelete} onClose={() => setAskDelete(false)} title="Supprimer ?">
        <div className="space-y-2">
          {recurring ? (
            <>
              {occ && (
                <Button variant="secondary" className="w-full" onClick={skipThisOne} loading={busy}>
                  Seulement le {formatDayShort(occ.date)}
                </Button>
              )}
              {occ && occ.date > e.start_date && (
                <Button variant="secondary" className="w-full" onClick={stopFromHere} loading={busy}>
                  À partir du {formatDayShort(occ.date)}
                </Button>
              )}
              <Button variant="danger" className="w-full" onClick={removeAll} loading={busy}>
                Toute la série
              </Button>
            </>
          ) : (
            <Button variant="danger" className="w-full" onClick={removeAll} loading={busy}>
              Oui, supprimer « {e.title} »
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => setAskDelete(false)}>
            Annuler
          </Button>
        </div>
      </Sheet>
    </>
  );
}
