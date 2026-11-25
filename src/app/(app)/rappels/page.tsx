"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, Card, Chip, EmptyState, Field, Input, LoadingBlock, PageHeader, Segmented, Sheet, Textarea, Toggle, cn, useToast } from "@/components/ui";
import { addDaysISO, formatDayShort, parisDateTime, toParisISODate, toParisTime, todayISO } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import type { Reminder } from "@/lib/types";

type Recur = Reminder["recurrence"];
const RECURRENCES: { value: Recur; label: string }[] = [
  { value: "none", label: "Une fois" },
  { value: "daily", label: "Chaque jour" },
  { value: "weekly", label: "Chaque semaine" },
  { value: "monthly", label: "Chaque mois" },
];
const RECUR_LABEL: Record<Recur, string> = { none: "", daily: "chaque jour", weekly: "chaque semaine", monthly: "chaque mois" };
const SUGGESTIONS = ["🐶 Sortir le chien", "🗑️ Sortir les poubelles", "💊 Donner le médicament", "📞 Appeler Mamie", "🎒 Préparer le sac", "🧾 Payer la cantine"];

type Target = "me" | "partner" | "both";

function dueLabel(due: string, nowMs: number) {
  const day = toParisISODate(due);
  const today = todayISO();
  const time = toParisTime(due);
  const dayLabel = day === today ? "Aujourd'hui" : day === addDaysISO(today, 1) ? "Demain" : day === addDaysISO(today, -1) ? "Hier" : formatDayShort(day);
  return { text: `${dayLabel} à ${time.replace(":", " h ")}`, late: new Date(due).getTime() < nowMs };
}

export default function RappelsPage() {
  const { me, partner, children, personOf, personById, nameOf } = useFamily();
  const toast = useToast();
  const [items, setItems] = useState<Reminder[] | null>(null);
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [open, setOpen] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const load = useCallback(async () => {
    const { data, error } = await supabase().from("reminders").select("*").order("due_at");
    if (error) toast("Impossible de charger les rappels 😕", "error");
    setItems((data ?? []) as Reminder[]);
    setNowMs(Date.now());
  }, [toast]);

  useEffect(() => {
    load();
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const sb = supabase();
    const ch = sb
      .channel(`rappels-live-${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [load]);

  async function markDone(r: Reminder) {
    const { error } = await supabase().rpc("complete_reminder", { p_id: r.id });
    if (error) return toast("Oups, ça n'a pas marché", "error");
    toast(r.recurrence === "none" ? "Bravo, c'est fait ✅" : "Fait ✅ — on recommence la prochaine fois", "success");
    const title = `✅ ${me.display_name} a fait : ${r.title}`;
    if (r.created_by && r.created_by !== me.id) notify({ to: [r.created_by], title, url: "/rappels", tag: `reminder-done-${r.id}` });
    else if (!r.assigned_to && partner) notify({ title, url: "/rappels", tag: `reminder-done-${r.id}` });
    load();
  }

  async function remove(r: Reminder) {
    const { error } = await supabase().from("reminders").delete().eq("id", r.id);
    if (error) return toast("Impossible de supprimer", "error");
    load();
  }

  if (items === null) {
    return (
      <>
        <PageHeader title="Rappels" back="/plus" />
        <LoadingBlock />
      </>
    );
  }

  const todo = items.filter((r) => !r.done_at);
  const done = items
    .filter((r) => r.done_at)
    .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""))
    .slice(0, 50);
  const list = tab === "todo" ? todo : done;

  function whoFor(r: Reminder) {
    if (!r.assigned_to) return { label: "Tous les deux", person: null };
    if (r.assigned_to === me.id) return { label: "Toi", person: personOf(me.id) };
    return { label: nameOf(r.assigned_to), person: personOf(r.assigned_to) };
  }

  return (
    <>
      <PageHeader
        title="Rappels"
        subtitle="Avec accusé « C'est fait »"
        back="/plus"
        action={
          <button type="button" onClick={() => setOpen(true)} aria-label="Nouveau rappel" className="inline-flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm active:brightness-95">
            <Plus className="size-6" />
          </button>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "todo", label: `À faire${todo.length ? ` (${todo.length})` : ""}` },
          { value: "done", label: "Faits" },
        ]}
      />

      <div className="mt-4 space-y-2">
        {list.length === 0 &&
          (tab === "todo" ? (
            <EmptyState emoji="🎈" title="Rien à faire, profitez !" text="Un rappel pour sortir le chien, la cantine, un médicament ?" action={<Button onClick={() => setOpen(true)}>Créer un rappel</Button>} />
          ) : (
            <EmptyState emoji="📭" title="Pas encore de rappel fait" />
          ))}

        {list.map((r) => {
          const who = whoFor(r);
          const child = personById(r.person_id);
          const due = dueLabel(r.due_at, nowMs);
          return (
            <Card key={r.id} className={cn("p-3", tab === "todo" && due.late && "border-accent/50")}>
              <div className="flex items-start gap-3">
                <Avatar person={who.person ?? { emoji: "👫", color: "var(--sand)", name: who.label }} size={40} />
                <div className="min-w-0 flex-1">
                  <p className={cn("font-semibold leading-snug", tab === "done" && "text-muted line-through")}>{r.title}</p>
                  <p className={cn("text-sm", tab === "todo" && due.late ? "font-semibold text-accent" : "text-muted")}>
                    {tab === "done" && r.done_at ? `Fait par ${r.done_by === me.id ? "toi" : nameOf(r.done_by)} · ${formatDayShort(toParisISODate(r.done_at))}` : due.text}
                    {tab === "todo" && r.recurrence !== "none" && ` · 🔁 ${RECUR_LABEL[r.recurrence]}`}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>Pour {who.label === "Toi" ? "toi" : who.label.toLowerCase() === "tous les deux" ? "vous deux" : who.label}</span>
                    {child && (
                      <span className="inline-flex items-center gap-1">
                        · <Avatar person={child} size={18} /> {child.name}
                      </span>
                    )}
                    {r.created_by && r.created_by !== r.assigned_to && <span>· de {r.created_by === me.id ? "toi" : nameOf(r.created_by)}</span>}
                  </p>
                  {r.notes && <p className="mt-1 whitespace-pre-wrap text-sm">{r.notes}</p>}
                </div>
                <button type="button" aria-label="Supprimer" onClick={() => remove(r)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted active:bg-card-2">
                  <Trash2 className="size-4" />
                </button>
              </div>
              {tab === "todo" && (
                <Button variant={due.late ? "primary" : "soft"} className="mt-3 w-full" onClick={() => markDone(r)}>
                  C&apos;est fait ✅
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <NewReminderSheet
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          setTab("todo");
          load();
        }}
        partnerName={partner?.display_name ?? null}
        kids={children}
      />
    </>
  );
}

function NewReminderSheet({
  open,
  onClose,
  onCreated,
  partnerName,
  kids,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  partnerName: string | null;
  kids: ReturnType<typeof useFamily>["children"];
}) {
  const { me, partner } = useFamily();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<Target>("both");
  const [personId, setPersonId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [recurrence, setRecurrence] = useState<Recur>("none");
  const [ack, setAck] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Valeurs par défaut à chaque ouverture : dans une heure, pile.
  useEffect(() => {
    if (!open) return;
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
    setTitle("");
    setTarget(partner ? "partner" : "me");
    setPersonId(null);
    setDate(toParisISODate(inOneHour));
    setTime(`${toParisTime(inOneHour).slice(0, 2)}:00`);
    setRecurrence("none");
    setAck(true);
    setNotes("");
  }, [open, partner]);

  async function create(ev: React.FormEvent) {
    ev.preventDefault();
    const t = title.trim();
    if (!t) return toast("Qu'est-ce qu'il ne faut pas oublier ? ✏️", "error");
    if (!date || !time) return toast("Choisis une date et une heure 🕐", "error");
    const assigned = target === "me" ? me.id : target === "partner" ? (partner?.id ?? null) : null;
    const due = parisDateTime(date, time);
    setBusy(true);
    const { error } = await supabase()
      .from("reminders")
      .insert({
        title: t,
        notes: notes.trim() || null,
        due_at: due.toISOString(),
        recurrence,
        assigned_to: assigned,
        person_id: personId,
        require_ack: ack,
        created_by: me.id,
      });
    setBusy(false);
    if (error) return toast("Impossible d'enregistrer 😕", "error");
    if (target !== "me" && partner) {
      notify({
        title: `⏰ ${me.display_name} ${target === "partner" ? "t'a laissé" : "nous a laissé"} un rappel : ${t}`,
        body: `${dueLabel(due.toISOString(), 0).text}${recurrence !== "none" ? ` · 🔁 ${RECUR_LABEL[recurrence]}` : ""}`,
        url: "/rappels",
        tag: "reminder-new",
      });
    }
    toast("Rappel programmé ⏰", "success");
    onCreated();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nouveau rappel ⏰">
      <form onSubmit={create} className="space-y-4">
        <Field label="Quoi ?">
          <Input placeholder="Sortir le chien" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {!title && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {SUGGESTIONS.map((s) => (
              <Chip key={s} onClick={() => setTitle(s)}>
                {s}
              </Chip>
            ))}
          </div>
        )}

        <Field label="Pour qui ?">
          <Segmented
            value={target}
            onChange={setTarget}
            options={[
              { value: "me", label: "Moi" },
              ...(partnerName ? [{ value: "partner" as Target, label: partnerName }] : []),
              { value: "both", label: "Tous les deux" },
            ]}
          />
        </Field>

        {kids.length > 0 && (
          <div>
            <span className="mb-1 block px-1 text-sm font-medium text-muted">Enfant concerné</span>
            <div className="flex flex-wrap gap-2">
              <Chip active={!personId} onClick={() => setPersonId(null)}>
                Aucun
              </Chip>
              {kids.map((k) => (
                <Chip key={k.id} active={personId === k.id} color={k.color} onClick={() => setPersonId(personId === k.id ? null : k.id)} className="pl-1">
                  <Avatar person={k} size={24} /> {k.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Le">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="À">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        <div>
          <span className="mb-1 block px-1 text-sm font-medium text-muted">Répéter</span>
          <div className="flex flex-wrap gap-2">
            {RECURRENCES.map((r) => (
              <Chip key={r.value} active={recurrence === r.value} onClick={() => setRecurrence(r.value)}>
                {r.label}
              </Chip>
            ))}
          </div>
        </div>

        <Toggle checked={ack} onChange={setAck} label="Demander un accusé « C'est fait »" description={ack ? "Le rappel reste affiché tant que personne n'a dit « C'est fait »." : "Une simple notification, puis c'est classé."} />

        <Field label="Détails (facultatif)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="2 comprimés au dîner…" className="min-h-16" />
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Programmer le rappel
        </Button>
      </form>
    </Sheet>
  );
}
