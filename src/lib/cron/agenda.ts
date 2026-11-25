import "server-only";

// Cron de l'agenda (appelé toutes les 5 minutes par /api/cron) :
//  (a) rappels d'événements : X minutes avant (remind_minutes_before) et la veille au soir à partir de 19 h
//  (b) rappels « tâches » (table reminders) arrivés à échéance
// Chaque envoi est protégé par claimNotification() : jamais deux fois la même notification.

import { addMonths, format, parseISO } from "date-fns";
import { addDaysISO, formatTime, parisDateTime, toParisISODate, toParisTime, todayISO } from "@/lib/dates";
import { fetchHolidays } from "@/lib/holidays";
import { sendPushToMembers } from "@/lib/push/server";
import { expandEvents, type Occurrence } from "@/lib/recurrence";
import { adminSupabase } from "@/lib/supabase/server";
import type { EventRow, Reminder } from "@/lib/types";
import { claimNotification } from "./log";

const MINUTE = 60_000;
/** Un rappel en retard de plus de 30 min n'est plus envoyé (cron interrompu, événement créé trop tard…) */
const MAX_LATE_MS = 30 * MINUTE;
/** Horizon de recherche des occurrences */
const HORIZON_MS = 26 * 60 * MINUTE;
/** Heure (Paris) à partir de laquelle part le rappel de la veille */
const EVE_HOUR = 19;

interface MemberLite {
  id: string;
  role: string;
  person_id: string | null;
  display_name: string;
}
interface PersonLite {
  id: string;
  name: string;
  kind: string;
}

export async function runAgendaCron(now: Date): Promise<string[]> {
  const log: string[] = [];
  const sb = adminSupabase();

  const [{ data: membersData }, { data: peopleData }] = await Promise.all([
    sb.from("members").select("id, role, person_id, display_name"),
    sb.from("people").select("id, name, kind"),
  ]);
  const members = (membersData ?? []) as MemberLite[];
  const people = (peopleData ?? []) as PersonLite[];
  const parents = members.filter((m) => m.role === "parent").map((m) => m.id);
  const personName = (id: string | null) => people.find((p) => p.id === id)?.name;
  const memberOfPerson = (personId: string | null) => (personId ? members.find((m) => m.person_id === personId) : undefined);

  try {
    log.push(...(await eventReminders(now, { parents, personName, memberOfPerson })));
  } catch (err) {
    log.push(`agenda : erreur rappels d'événements — ${String(err)}`);
  }
  try {
    log.push(...(await taskReminders(now, { parents, members, personName })));
  } catch (err) {
    log.push(`agenda : erreur rappels — ${String(err)}`);
  }
  return log;
}

// ---------------------------------------------------------------------- (a) événements
interface EventCtx {
  parents: string[];
  personName: (id: string | null) => string | undefined;
  memberOfPerson: (personId: string | null) => MemberLite | undefined;
}

function minutesLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

function forWhom(e: EventRow, personName: EventCtx["personName"]): string {
  const names = e.person_ids.map((id) => personName(id)).filter(Boolean) as string[];
  if (!names.length) return "";
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

function rideLine(e: EventRow, recipient: MemberLite | undefined, ctx: EventCtx): string | null {
  const driver = e.driver_id ? ctx.personName(e.driver_id) : undefined;
  const pickup = e.pickup_id ? ctx.personName(e.pickup_id) : undefined;
  const parts: string[] = [];
  if (driver) parts.push(recipient && recipient.person_id === e.driver_id ? "c'est toi qui emmènes" : `${driver} emmène`);
  if (pickup) parts.push(recipient && recipient.person_id === e.pickup_id ? "c'est toi qui récupères" : `${pickup} récupère`);
  return parts.length ? `🚗 ${parts.join(", ")}` : null;
}

async function eventReminders(now: Date, ctx: EventCtx): Promise<string[]> {
  const log: string[] = [];
  const sb = adminSupabase();
  const today = todayISO(now);
  const tomorrow = addDaysISO(today, 1);
  const to = addDaysISO(today, 2);

  const { data, error } = await sb
    .from("events")
    .select("*")
    .lte("start_date", to)
    .or(`recurrence.neq.none,start_date.gte.${today},end_date.gte.${today}`);
  if (error) throw error;
  const events = ((data ?? []) as EventRow[]).filter((e) => e.recurrence === "none" || !e.until_date || e.until_date >= today);
  if (!events.length) return log;

  const holidays = await fetchHolidays();
  // On ne garde que les occurrences qui COMMENCENT dans la fenêtre (pas celles en cours depuis hier).
  const occs = expandEvents(events, today, to, holidays).filter((o) => o.date >= today);
  const parisHour = Number(toParisTime(now).slice(0, 2));

  for (const occ of occs) {
    const e = occ.event;
    const driverMember = ctx.memberOfPerson(e.driver_id);
    const recipients = driverMember ? [driverMember.id] : ctx.parents;
    if (!recipients.length) continue;
    const who = forWhom(e, ctx.personName);
    const url = `/agenda/${e.id}?date=${occ.date}`;

    // --- X minutes avant
    if (occ.startAt && !e.all_day) {
      const startMs = occ.startAt.getTime();
      if (startMs > now.getTime() && startMs - now.getTime() <= HORIZON_MS) {
        for (const minutes of e.remind_minutes_before ?? []) {
          if (!(minutes > 0)) continue;
          const fireAt = startMs - minutes * MINUTE;
          if (now.getTime() < fireAt || now.getTime() - fireAt > MAX_LATE_MS) continue;
          if (!(await claimNotification(`agenda:event:${e.id}:${occ.date}:${minutes}`))) continue;
          const body = [
            [formatTime(e.start_time), e.location].filter(Boolean).join(" · "),
            rideLine(e, driverMember, ctx),
            e.checklist.length ? `🎒 N'oublie pas : ${e.checklist.join(", ")}` : null,
          ]
            .filter(Boolean)
            .join("\n");
          const res = await sendPushToMembers(recipients, {
            title: `${e.emoji} ${e.title} dans ${minutesLabel(minutes)}${who ? ` — ${who}` : ""}`,
            body,
            url,
            tag: `event-${e.id}-${occ.date}`,
          });
          log.push(`agenda : rappel ${minutes} min « ${e.title} » ${occ.date} → ${recipients.length} membre(s), ${res.sent} envoi(s)`);
        }
      }
    }

    // --- la veille au soir
    if (occ.date === tomorrow && parisHour >= EVE_HOUR && (e.remind_eve || e.checklist.length > 0)) {
      if (await claimNotification(`agenda:eve:${e.id}:${occ.date}`)) {
        const title =
          `${e.checklist.length ? "🎒" : e.emoji} Demain : ${e.title}${who ? ` pour ${who}` : ""}` +
          (e.checklist.length ? ` — ${e.checklist.join(", ")}` : "");
        const body = [eveTimeLabel(occ), e.location, rideLine(e, driverMember, ctx)].filter(Boolean).join(" · ");
        const res = await sendPushToMembers(recipients, { title, body, url, tag: `event-eve-${e.id}-${occ.date}` });
        log.push(`agenda : rappel de la veille « ${e.title} » ${occ.date} → ${res.sent} envoi(s)`);
      }
    }
  }
  return log;
}

function eveTimeLabel(occ: Occurrence): string {
  const e = occ.event;
  if (e.all_day || !e.start_time) return "Toute la journée";
  return `À ${formatTime(e.start_time)}`;
}

// ---------------------------------------------------------------------- (b) rappels « tâches »
interface TaskCtx {
  parents: string[];
  members: MemberLite[];
  personName: (id: string | null) => string | undefined;
}

/** Prochaine échéance d'un rappel récurrent, en gardant l'heure de Paris. */
function nextDue(dueAt: string, recurrence: Reminder["recurrence"], now: Date): string {
  let date = toParisISODate(dueAt);
  const time = toParisTime(dueAt);
  let next = parisDateTime(date, time);
  for (let i = 0; i < 1000 && next.getTime() <= now.getTime(); i++) {
    date =
      recurrence === "daily"
        ? addDaysISO(date, 1)
        : recurrence === "weekly"
          ? addDaysISO(date, 7)
          : format(addMonths(parseISO(date), 1), "yyyy-MM-dd");
    next = parisDateTime(date, time);
  }
  return next.toISOString();
}

async function taskReminders(now: Date, ctx: TaskCtx): Promise<string[]> {
  const log: string[] = [];
  const sb = adminSupabase();
  const { data, error } = await sb
    .from("reminders")
    .select("*")
    .is("done_at", null)
    .lte("due_at", now.toISOString())
    .order("due_at");
  if (error) throw error;
  const due = ((data ?? []) as Reminder[]).filter(
    (r) => !r.last_sent_at || new Date(r.last_sent_at).getTime() < new Date(r.due_at).getTime(),
  );

  for (const r of due) {
    const dueKey = new Date(r.due_at).toISOString();
    if (!(await claimNotification(`agenda:reminder:${r.id}:${dueKey}`))) continue;

    const assigned = r.assigned_to ? ctx.members.find((m) => m.id === r.assigned_to) : undefined;
    const recipients = assigned ? [assigned.id] : ctx.parents;
    const creator = ctx.members.find((m) => m.id === r.created_by);
    const child = ctx.personName(r.person_id);
    const body = [
      child ? `Pour ${child}` : null,
      creator && creator.id !== r.assigned_to ? `De la part de ${creator.display_name}` : null,
      r.notes,
      r.require_ack ? "Touche pour dire « C'est fait ✅ »" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const res = await sendPushToMembers(recipients, {
      title: `⏰ ${r.title}`,
      body: body || undefined,
      url: "/rappels",
      tag: `reminder-${r.id}`,
    });

    // Sans accusé « C'est fait » : le rappel est considéré comme traité une fois envoyé.
    let patch: Partial<Reminder> = { last_sent_at: now.toISOString() };
    if (!r.require_ack) {
      patch =
        r.recurrence === "none"
          ? { last_sent_at: now.toISOString(), done_at: now.toISOString() }
          : { last_sent_at: null, due_at: nextDue(r.due_at, r.recurrence, now) };
    }
    const { error: upErr } = await sb.from("reminders").update(patch).eq("id", r.id);
    if (upErr) log.push(`agenda : rappel « ${r.title} » envoyé mais non mis à jour — ${upErr.message}`);
    log.push(`agenda : rappel « ${r.title} » → ${recipients.length} membre(s), ${res.sent} envoi(s)`);
  }
  return log;
}
