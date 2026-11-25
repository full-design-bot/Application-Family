"use client";

import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ChildProfileSheet } from "@/components/agenda/ChildProfileSheet";
import { ageLabel } from "@/components/agenda/shared";
import { Avatar, Button, EmptyState, PageHeader, SectionTitle, Spinner } from "@/components/ui";
import { formatOccurrenceTime, isOccurrencePast, loadOccurrences, subscribeEvents } from "@/lib/agenda";
import { addDaysISO, daysBetween, formatDayShort, todayISO } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import type { Occurrence } from "@/lib/recurrence";
import type { Person } from "@/lib/types";

function nextBirthday(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const today = todayISO();
  const y = Number(today.slice(0, 4));
  let next = `${y}${birthdate.slice(4)}`;
  if (next < today) next = `${y + 1}${birthdate.slice(4)}`;
  return daysBetween(today, next);
}

export default function EnfantsPage() {
  const { children, isParent } = useFamily();
  const [occs, setOccs] = useState<Occurrence[] | null>(null);
  const [editing, setEditing] = useState<Person | null | undefined>(undefined);

  const load = useCallback(async () => {
    const today = todayISO();
    setOccs(await loadOccurrences(today, addDaysISO(today, 14)).catch(() => []));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => subscribeEvents(() => load(), "enfants-events"), [load]);

  return (
    <>
      <PageHeader
        title="Les enfants"
        subtitle="Activités, santé, mots d'enfants et souvenirs"
        back="/plus"
        action={
          isParent && (
            <button type="button" onClick={() => setEditing(null)} aria-label="Ajouter un enfant" className="inline-flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm">
              <Plus className="size-6" />
            </button>
          )
        }
      />

      {children.length === 0 && (
        <EmptyState emoji="👶" title="Aucun profil enfant" text="Ajoute Jules et Pia pour suivre leurs activités et garder leurs plus beaux mots." action={isParent && <Button onClick={() => setEditing(null)}>Ajouter un enfant</Button>} />
      )}

      <div className="space-y-3">
        {children.map((c) => {
          const next = (occs ?? []).filter((o) => o.event.person_ids.includes(c.id) && !isOccurrencePast(o)).slice(0, 3);
          const bday = nextBirthday(c.birthdate);
          return (
            <Link key={c.id} href={`/enfants/${c.id}`} className="block overflow-hidden rounded-3xl border border-line bg-card active:scale-[0.99] transition">
              <div className="flex items-center gap-3 p-4" style={{ background: `color-mix(in srgb, ${c.color} 18%, transparent)` }}>
                <Avatar person={c} size={60} />
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold">{c.name}</p>
                  <p className="text-muted">
                    {ageLabel(c.birthdate) ?? "Âge inconnu"}
                    {bday !== null && bday <= 60 && (bday === 0 ? " · 🎂 C'est son anniversaire !" : ` · 🎂 dans ${bday} j`)}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted" />
              </div>
              <div className="space-y-1.5 px-4 pb-4 pt-3">
                {occs === null ? (
                  <Spinner className="size-4" />
                ) : next.length ? (
                  next.map((o) => (
                    <p key={`${o.event.id}-${o.date}`} className="flex items-center gap-2 text-sm">
                      <span className="text-lg">{o.event.emoji}</span>
                      <span className="font-semibold">{o.event.title}</span>
                      <span className="truncate text-muted capitalize">
                        {o.date === todayISO() ? "aujourd'hui" : formatDayShort(o.date)} · {formatOccurrenceTime(o)}
                      </span>
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted">Pas d&apos;activité dans les 15 prochains jours</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {children.length > 0 && isParent && (
        <>
          <SectionTitle>Profils</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <Button key={c.id} variant="secondary" size="sm" onClick={() => setEditing(c)}>
                ✏️ {c.name}
              </Button>
            ))}
            <Button variant="soft" size="sm" onClick={() => setEditing(null)}>
              + Ajouter un enfant
            </Button>
          </div>
        </>
      )}

      <ChildProfileSheet open={editing !== undefined} onClose={() => setEditing(undefined)} child={editing ?? null} />
    </>
  );
}
