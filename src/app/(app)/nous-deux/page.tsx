"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, PageHeader, SectionTitle, Segmented, Spinner } from "@/components/ui";
import { BucketList } from "@/components/couple/BucketList";
import { CapsuleCard, CapsuleSheet } from "@/components/couple/Capsule";
import { DailyHistory, DailyQuestionPanel } from "@/components/couple/DailyQuestion";
import { FullscreenImage } from "@/components/couple/FullscreenImage";
import { MoodPicker } from "@/components/couple/Mood";
import { ThinkOfYouButton } from "@/components/couple/ThinkOfYouButton";
import { COUPLE_CHANNEL, useNow } from "@/components/couple/lib";
import { daysBetween, formatDayLong, todayISO } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { supabase } from "@/lib/supabase/client";
import type { EventRow, Message } from "@/lib/types";

export default function NousDeuxPage() {
  const { isParent, partner } = useFamily();

  if (!isParent) {
    return (
      <>
        <PageHeader title="Nous deux" back="/plus" />
        <EmptyState emoji="💑" title="Espace réservé aux parents" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Nous deux 💑" subtitle={partner ? `Toi & ${partner.display_name}` : undefined} back="/plus" />

      <NextCountdown />

      <ThinkOfYouButton variant="large" className="mt-2" />

      <SectionTitle>
        <span id="meteo" className="scroll-mt-4">🌦️ Météo du cœur</span>
      </SectionTitle>
      <MoodPicker />

      <SectionTitle>
        <span id="question" className="scroll-mt-4">❓ Question du jour</span>
      </SectionTitle>
      <DailyQuestionPanel />
      <PastQuestions />

      <SectionTitle>✨ Notre liste à vivre</SectionTitle>
      <BucketList />

      <Capsules />

      <SectionTitle>💞 Et aussi</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Shortcut href="/souvenirs" emoji="📸" title="Souvenirs" text="Photos gardées, capsules ouvertes" className="bg-rose-soft" />
        <Shortcut href="/dessin" emoji="🎨" title="Dessiner à deux" text="Tableau partagé en direct" className="bg-sand-soft" />
        <Shortcut href="/messages" emoji="💬" title="Discussion" text="Rien que vous deux" className="bg-accent-soft" />
        <Shortcut href="/jeux" emoji="🎲" title="Jeux" text="Pour rire (ou pas que)" className="bg-sky-soft" />
      </div>
    </>
  );
}

function Shortcut({ href, emoji, title, text, className }: { href: string; emoji: string; title: string; text: string; className: string }) {
  return (
    <Link href={href} className={`rounded-3xl p-4 transition active:scale-[0.98] ${className}`}>
      <span className="block text-3xl">{emoji}</span>
      <span className="mt-2 block font-bold">{title}</span>
      <span className="block text-sm leading-snug text-muted">{text}</span>
    </Link>
  );
}

// ------------------------------------------------------------ compte à rebours
function NextCountdown() {
  const [event, setEvent] = useState<EventRow | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase()
        .from("events")
        .select("*")
        .eq("countdown", true)
        .gte("start_date", todayISO())
        .order("start_date")
        .limit(1)
        .maybeSingle();
      if (alive) setEvent((data as EventRow | null) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!event) return null;
  const days = daysBetween(todayISO(), event.start_date);
  return (
    <div className="animate-pop mb-2 flex items-center gap-4 rounded-3xl bg-sky-soft p-4">
      <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-card">
        <span className="font-display text-2xl font-bold leading-none text-sky">{days === 0 ? "🎉" : days}</span>
        {days > 0 && <span className="text-[11px] text-muted">jour{days > 1 ? "s" : ""}</span>}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted">
          {days === 0 ? "C'est aujourd'hui !" : days === 1 ? "C'est demain !" : `Plus que ${days} jours avant`}
        </p>
        <p className="truncate font-display text-lg font-bold">
          {event.emoji} {event.title}
        </p>
        <p className="text-xs text-muted">{formatDayLong(event.start_date)}</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ questions passées
function PastQuestions() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(!open)} className="px-1 text-sm font-semibold text-muted">
        {open ? "▾" : "▸"} Questions des jours passés
      </button>
      {open && (
        <div className="mt-2">
          <DailyHistory />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ capsules
function Capsules() {
  const { me, partner } = useFamily();
  const [list, setList] = useState<Message[] | null>(null);
  const [tab, setTab] = useState<"soon" | "open">("soon");
  const [creating, setCreating] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const now = useNow(30000);
  const partnerName = partner?.display_name ?? "ton amour";

  const load = useCallback(async () => {
    const { data } = await supabase()
      .from("messages")
      .select("*")
      .eq("channel", COUPLE_CHANNEL)
      .eq("kind", "capsule")
      .order("unlock_at", { ascending: true });
    setList((data ?? []) as Message[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const soon = (list ?? []).filter((m) => m.unlock_at && new Date(m.unlock_at).getTime() > now);
  const opened = (list ?? []).filter((m) => m.unlock_at && new Date(m.unlock_at).getTime() <= now).reverse();
  const shown = tab === "soon" ? soon : opened;

  return (
    <>
      <SectionTitle
        action={
          <Button size="sm" variant="soft" onClick={() => setCreating(true)}>
            + Nouvelle
          </Button>
        }
      >
        🔒 Capsules temporelles
      </SectionTitle>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "soon", label: `À venir (${soon.length})` },
          { value: "open", label: `Ouvertes (${opened.length})` },
        ]}
      />
      <div className="mt-3 space-y-3">
        {list === null ? (
          <Spinner />
        ) : shown.length ? (
          shown.map((m) => (
            <div key={m.id}>
              <p className="mb-1 px-1 text-xs text-muted">{m.sender_id === me.id ? `De toi pour ${partnerName}` : `De ${partnerName} pour toi`}</p>
              <CapsuleCard m={m} mine={m.sender_id === me.id} partnerName={partnerName} onPhoto={setPhoto} full />
            </div>
          ))
        ) : (
          <p className="px-1 text-sm text-muted">
            {tab === "soon" ? "Aucune capsule en attente. Écris un mot pour le futur 💌" : "Aucune capsule ouverte pour l'instant."}
          </p>
        )}
      </div>
      <CapsuleSheet
        open={creating}
        onClose={() => setCreating(false)}
        meId={me.id}
        myName={me.display_name}
        partnerId={partner?.id ?? null}
        partnerName={partnerName}
        onSent={() => void load()}
      />
      {photo && <FullscreenImage path={photo} onClose={() => setPhoto(null)} />}
    </>
  );
}
