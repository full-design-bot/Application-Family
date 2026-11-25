"use client";

import Link from "next/link";
import { Repeat } from "lucide-react";
import { Avatar, cn } from "@/components/ui";
import { formatOccurrenceTime, isOccurrencePast } from "@/lib/agenda";
import { formatDayShort } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import type { Occurrence } from "@/lib/recurrence";

/** Ligne « 🚗 Aller : Sam · Retour : toi » (ou null) */
export function useRideLabel() {
  const { personById, personOf, me } = useFamily();
  const myPersonId = personOf(me.id)?.id;
  return (driverId: string | null, pickupId: string | null): string | null => {
    const name = (id: string) => (id === myPersonId ? "toi" : (personById(id)?.name ?? "?"));
    if (driverId && pickupId && driverId === pickupId) return `🚗 ${name(driverId)} emmène et récupère`;
    const parts: string[] = [];
    if (driverId) parts.push(`Aller : ${name(driverId)}`);
    if (pickupId) parts.push(`Retour : ${name(pickupId)}`);
    return parts.length ? `🚗 ${parts.join(" · ")}` : null;
  };
}

/** Carte d'une occurrence (agenda, fiche enfant…). Ouvre le détail au toucher. */
export function OccurrenceCard({ occ, showDate = false, className }: { occ: Occurrence; showDate?: boolean; className?: string }) {
  const { personById } = useFamily();
  const ride = useRideLabel();
  const e = occ.event;
  const persons = e.person_ids.map((id) => personById(id)).filter((p) => !!p);
  const rideLine = ride(e.driver_id, e.pickup_id);
  const past = isOccurrencePast(occ);

  return (
    <Link
      href={`/agenda/${e.id}?date=${occ.date}`}
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-line bg-card p-3 transition active:scale-[0.99]",
        e.space === "couple" && "border-rose/40 bg-rose-soft",
        past && "opacity-55",
        className,
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card-2 text-2xl">{e.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          {showDate && <span className="capitalize">{formatDayShort(occ.date)} ·</span>}
          <span>{formatOccurrenceTime(occ)}</span>
          {occ.endDate && <span>→ {formatDayShort(occ.endDate)}</span>}
          {e.recurrence !== "none" && <Repeat className="size-3" aria-label="Récurrent" />}
          {e.space === "couple" && <span>💑</span>}
        </span>
        <span className="block truncate font-semibold leading-snug">{e.title}</span>
        {(persons.length > 0 || e.location) && (
          <span className="mt-1 flex items-center gap-1.5">
            {persons.length > 0 && (
              <span className="flex -space-x-1">
                {persons.map((p) => (
                  <Avatar key={p.id} person={p} size={22} className="ring-2 ring-card" />
                ))}
              </span>
            )}
            {persons.length > 0 && (
              <span className="truncate text-sm text-muted">{persons.map((p) => p.name).join(", ")}</span>
            )}
            {e.location && <span className="truncate text-sm text-muted">{persons.length ? "· " : "📍 "}{e.location}</span>}
          </span>
        )}
        {rideLine && <span className="mt-0.5 block truncate text-sm text-muted">{rideLine}</span>}
      </span>
    </Link>
  );
}
