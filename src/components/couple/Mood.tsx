"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Button, Input, Spinner, cn, useToast } from "@/components/ui";
import { useFamily } from "@/lib/family";
import type { Mood } from "@/lib/types";
import { useMoods } from "./hooks";
import { MOODS, moodLabel } from "./lib";

function MoodSlot({ who, mood, empty, personId }: { who: string; mood: Mood | null; empty: string; personId?: string | null }) {
  const { personById } = useFamily();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <div className="relative">
        <Avatar person={personById(personId)} size={40} />
        <span className="absolute -bottom-1 -right-1 text-2xl leading-none">{mood?.mood ?? "❔"}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{who}</p>
        <p className="truncate text-xs text-muted">{mood ? mood.note || moodLabel(mood.mood) : empty}</p>
      </div>
    </div>
  );
}

/**
 * Résumé de la météo du cœur (mon humeur + celle de l'autre).
 * Au toucher → /nous-deux. Autonome : charge ses propres données.
 */
export function MoodSummary({ className, href = "/nous-deux#meteo" }: { className?: string; href?: string }) {
  const { me, partner, isParent } = useFamily();
  const { mine, theirs, loading } = useMoods();
  if (!isParent) return null;
  return (
    <Link href={href} className={cn("block rounded-3xl border border-line bg-card p-4 transition active:scale-[0.99]", className)}>
      <p className="mb-3 text-sm font-semibold text-muted">🌦️ Météo du cœur</p>
      {loading ? (
        <Spinner className="size-5" />
      ) : (
        <div className="flex gap-3">
          <MoodSlot who="Toi" mood={mine} empty="Et toi, ça va ?" personId={me.person_id} />
          {partner && <MoodSlot who={partner.display_name} mood={theirs} empty="Pas encore de météo" personId={partner.person_id} />}
        </div>
      )}
    </Link>
  );
}

/** Choix de mon humeur du jour + affichage de celle de l'autre (page Nous deux). */
export function MoodPicker() {
  const { partner, isParent } = useFamily();
  const toast = useToast();
  const { mine, theirs, loading, save } = useMoods();
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!isParent) return null;

  const noteValue = note ?? mine?.note ?? "";

  async function pick(emoji: string, n: string | null = noteValue) {
    setSaving(true);
    try {
      await save(emoji, n);
    } catch {
      toast("Humeur non enregistrée 😕", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {MOODS.map((m) => (
          <button
            key={m.emoji}
            type="button"
            onClick={() => pick(m.emoji)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-2xl py-2 transition active:scale-95",
              mine?.mood === m.emoji ? "bg-accent-soft ring-2 ring-accent" : "bg-card-2",
            )}
          >
            <span className="text-3xl">{m.emoji}</span>
            <span className="text-[11px] leading-tight text-muted">{m.label}</span>
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (mine) void pick(mine.mood, noteValue);
          else toast("Choisis d'abord ta météo ☀️");
        }}
      >
        <Input value={noteValue} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="Un petit mot sur ta journée…" />
        <Button type="submit" variant="soft" loading={saving} disabled={!mine}>
          OK
        </Button>
      </form>
      {partner && (
        <div className="rounded-2xl bg-card-2 p-3">
          {loading ? (
            <Spinner className="size-5" />
          ) : theirs ? (
            <p>
              <span className="mr-2 text-2xl align-middle">{theirs.mood}</span>
              <span className="font-semibold">{partner.display_name}</span> : {theirs.note || moodLabel(theirs.mood)}
            </p>
          ) : (
            <p className="text-muted">{partner.display_name} n&apos;a pas encore donné sa météo aujourd&apos;hui.</p>
          )}
        </div>
      )}
    </div>
  );
}
