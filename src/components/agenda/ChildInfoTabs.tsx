"use client";

// Fiche enfant : onglets « Activités » et « Infos ».

import { Phone, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, Field, Input, LinkButton, LoadingBlock, Textarea, useToast } from "@/components/ui";
import { isOccurrencePast, loadOccurrences, subscribeEvents } from "@/lib/agenda";
import { addDaysISO, todayISO } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import type { Occurrence } from "@/lib/recurrence";
import { supabase } from "@/lib/supabase/client";
import type { Person, PersonDetails } from "@/lib/types";
import { OccurrenceCard } from "./OccurrenceCard";

// ------------------------------------------------------------------ Activités
export function ActivitiesTab({ child }: { child: Person }) {
  const [occs, setOccs] = useState<Occurrence[] | null>(null);
  const load = useCallback(async () => {
    const today = todayISO();
    const list = await loadOccurrences(today, addDaysISO(today, 60)).catch(() => []);
    setOccs(list.filter((o) => o.event.person_ids.includes(child.id) && !isOccurrencePast(o)));
  }, [child.id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => subscribeEvents(() => load(), `enfant-events-${child.id}`), [child.id, load]);

  const addHref = `/agenda/nouveau?personne=${child.id}`;
  if (occs === null) return <LoadingBlock />;
  return (
    <div className="space-y-2">
      {occs.length === 0 ? (
        <EmptyState emoji="🗓️" title={`Rien de prévu pour ${child.name}`} text="Piscine, judo, anniversaire d'un copain…" action={<LinkButton href={addHref}>Ajouter une activité</LinkButton>} />
      ) : (
        <>
          {occs.map((o) => (
            <OccurrenceCard key={`${o.event.id}-${o.date}`} occ={o} showDate />
          ))}
          <LinkButton href={addHref} variant="soft" className="mt-2 w-full">
            <Plus className="size-4" /> Ajouter une activité
          </LinkButton>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Infos
type Contact = NonNullable<PersonDetails["contacts"]>[number];

const FIELDS: { key: keyof PersonDetails; label: string; placeholder: string; type?: string }[] = [
  { key: "school", label: "🏫 École", placeholder: "École Montgolfier" },
  { key: "class_name", label: "🎒 Classe", placeholder: "CP, Mme Martin" },
  { key: "clothes_size", label: "👕 Taille vêtements", placeholder: "6 ans" },
  { key: "shoe_size", label: "👟 Pointure", placeholder: "29" },
  { key: "allergies", label: "⚠️ Allergies", placeholder: "Aucune" },
  { key: "blood_type", label: "🩸 Groupe sanguin", placeholder: "O+" },
  { key: "doctor", label: "🩺 Médecin", placeholder: "Dr Dupont" },
  { key: "doctor_phone", label: "📞 Téléphone du médecin", placeholder: "05 56 …", type: "tel" },
];

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function InfosTab({ child }: { child: Person }) {
  const { reload, isParent } = useFamily();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PersonDetails>(child.details ?? {});
  const [busy, setBusy] = useState(false);
  const d = child.details ?? {};
  const contacts = (d.contacts ?? []) as Contact[];

  function startEdit() {
    setForm({ ...d, contacts: contacts.map((c) => ({ ...c })) });
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    const cleaned: PersonDetails = { ...d };
    for (const f of FIELDS) {
      const v = String(form[f.key] ?? "").trim();
      if (v) cleaned[f.key] = v;
      else delete cleaned[f.key];
    }
    const notes = String(form.notes ?? "").trim();
    if (notes) cleaned.notes = notes;
    else delete cleaned.notes;
    cleaned.contacts = ((form.contacts ?? []) as Contact[])
      .map((c) => ({ name: c.name.trim(), role: c.role?.trim() || undefined, phone: c.phone?.trim() || undefined }))
      .filter((c) => c.name);
    const { error } = await supabase().from("people").update({ details: cleaned }).eq("id", child.id);
    setBusy(false);
    if (error) return toast("Impossible d'enregistrer 😕", "error");
    await reload();
    toast("Infos enregistrées ✅", "success");
    setEditing(false);
  }

  if (editing) {
    const fc = (form.contacts ?? []) as Contact[];
    const setContact = (i: number, patch: Partial<Contact>) =>
      setForm({ ...form, contacts: fc.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
    return (
      <div className="space-y-3">
        <Card className="space-y-3">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                type={f.type ?? "text"}
                inputMode={f.type === "tel" ? "tel" : undefined}
                placeholder={f.placeholder}
                value={String(form[f.key] ?? "")}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </Field>
          ))}
        </Card>
        <Card className="space-y-3">
          <p className="font-semibold">👥 Contacts (nounou, école, grands-parents…)</p>
          {fc.map((c, i) => (
            <div key={i} className="space-y-2 rounded-2xl bg-card-2 p-3">
              <div className="flex gap-2">
                <Input placeholder="Nom" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                <button type="button" aria-label="Retirer" onClick={() => setForm({ ...form, contacts: fc.filter((_, j) => j !== i) })} className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-muted active:bg-card">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Rôle (nounou…)" value={c.role ?? ""} onChange={(e) => setContact(i, { role: e.target.value })} />
                <Input type="tel" inputMode="tel" placeholder="Téléphone" value={c.phone ?? ""} onChange={(e) => setContact(i, { phone: e.target.value })} />
              </div>
            </div>
          ))}
          <Button type="button" variant="soft" size="sm" onClick={() => setForm({ ...form, contacts: [...fc, { name: "" }] })}>
            <Plus className="size-4" /> Ajouter un contact
          </Button>
        </Card>
        <Card>
          <Field label="📝 Notes">
            <Textarea value={String(form.notes ?? "")} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Doudou : lapin bleu. Dort avec la lumière du couloir." />
          </Field>
        </Card>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
            Annuler
          </Button>
          <Button className="flex-1" onClick={save} loading={busy}>
            Enregistrer
          </Button>
        </div>
      </div>
    );
  }

  const filled = FIELDS.filter((f) => d[f.key]);
  return (
    <div className="space-y-3">
      {filled.length === 0 && !contacts.length && !d.notes ? (
        <EmptyState emoji="📋" title="Pas encore d'infos" text="École, tailles, allergies, médecin… tout au même endroit." action={isParent && <Button onClick={startEdit}>Remplir la fiche</Button>} />
      ) : (
        <>
          <Card className="divide-y divide-line py-1">
            {filled.map((f) => {
              const value = String(d[f.key]);
              return (
                <div key={f.key} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm text-muted">{f.label}</span>
                  {f.key === "doctor_phone" ? (
                    <a href={telHref(value)} className="inline-flex items-center gap-1.5 font-semibold text-sky">
                      <Phone className="size-4" /> {value}
                    </a>
                  ) : (
                    <span className={f.key === "allergies" && !/^aucune?$/i.test(value) ? "text-right font-semibold text-danger" : "text-right font-semibold"}>{value}</span>
                  )}
                </div>
              );
            })}
          </Card>
          {contacts.length > 0 && (
            <Card className="divide-y divide-line py-1">
              {contacts.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    <span className="block font-semibold">{c.name}</span>
                    {c.role && <span className="block text-sm text-muted">{c.role}</span>}
                  </span>
                  {c.phone && (
                    <a href={telHref(c.phone)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-sky-soft px-3 font-semibold text-sky">
                      <Phone className="size-4" /> Appeler
                    </a>
                  )}
                </div>
              ))}
            </Card>
          )}
          {d.notes && <Card className="whitespace-pre-wrap">{String(d.notes)}</Card>}
          {isParent && (
            <Button variant="secondary" className="w-full" onClick={startEdit}>
              ✏️ Modifier les infos
            </Button>
          )}
        </>
      )}
    </div>
  );
}
