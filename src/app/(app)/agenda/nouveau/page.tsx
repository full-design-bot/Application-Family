"use client";

// Nouvel événement.
// Préremplissage possible par l'URL (utilisé par d'autres modules, ex. Sorties « On y va samedi ») :
//   /agenda/nouveau?titre=Resto%20Le%20Petit%20Commerce&date=2026-11-28&heure=20:00&lieu=Bordeaux&emoji=🍽️&space=couple
//   (&personne=<id people> pour cocher un enfant d'office)

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { EventForm, emptyDraft, type EventDraft } from "@/components/agenda/EventForm";
import { joinNames } from "@/components/agenda/shared";
import { LoadingBlock, PageHeader, useToast } from "@/components/ui";
import { describeRecurrence } from "@/lib/recurrence";
import { formatDayLong, formatTime } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";

export default function NewEventPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <NewEvent />
    </Suspense>
  );
}

function NewEvent() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { me, isParent, personById } = useFamily();

  const initial = useMemo(() => {
    const date = sp.get("date");
    const time = sp.get("heure");
    const person = sp.get("personne");
    return emptyDraft({
      title: sp.get("titre") ?? "",
      emoji: sp.get("emoji") || "📅",
      location: sp.get("lieu") || null,
      space: sp.get("space") === "couple" && isParent ? "couple" : "family",
      ...(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { start_date: date } : {}),
      ...(time && /^\d{2}:\d{2}/.test(time) ? { start_time: time.slice(0, 5) } : {}),
      person_ids: person && personById(person) ? [person] : [],
    });
    // Valeurs initiales calculées une seule fois à l'ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(d: EventDraft) {
    const { data, error } = await supabase()
      .from("events")
      .insert({ ...d, created_by: me.id })
      .select("id")
      .single();
    if (error) throw new Error("Impossible d'enregistrer 😕");

    const names = d.person_ids.map((id) => personById(id)?.name).filter(Boolean) as string[];
    const when = d.recurrence !== "none" ? describeRecurrence(d) : formatDayLong(d.start_date);
    const time = d.all_day || !d.start_time ? null : formatTime(d.start_time);
    notify({
      title: `📅 Nouveau : ${d.title}${names.length ? ` — ${joinNames(names)}` : ""}, ${when}`,
      body: [`${d.emoji} ${me.display_name} l'a ajouté`, time, d.location].filter(Boolean).join(" · "),
      url: `/agenda/${data.id}?date=${d.start_date}`,
      tag: `event-new-${data.id}`,
    });
    toast("C'est noté dans l'agenda ✅", "success");
    router.push(`/agenda?date=${d.start_date}`);
  }

  return (
    <>
      <PageHeader title="Nouvel événement" back="/agenda" />
      <EventForm initial={initial} submitLabel="Ajouter à l'agenda" onSubmit={create} />
    </>
  );
}
