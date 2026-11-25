"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Chip, EmptyState, LoadingBlock, PageHeader, SectionTitle, Spinner, cn } from "@/components/ui";
import { FullscreenImage } from "@/components/couple/FullscreenImage";
import { COUPLE_CHANNEL, formatMonth } from "@/components/couple/lib";
import { formatDateFull, toParisISODate, todayISO } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { useSignedUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase/client";
import type { CapsuleContent, ChildEntry, Message, Person } from "@/lib/types";

type Source = "ephemeral" | "capsule" | "photo" | "child";

interface Souvenir {
  id: string;
  /** date du souvenir (YYYY-MM-DD, heure de Paris) */
  day: string;
  /** pour le tri */
  at: string;
  source: Source;
  mediaPath: string | null;
  title: string | null;
  text: string | null;
  person?: Person;
}

const SOURCE_BADGE: Record<Source, string> = {
  ephemeral: "💛",
  capsule: "🔓",
  photo: "📷",
  child: "🧸",
};

const SOURCE_LABEL: Record<Source, string> = {
  ephemeral: "Photo éphémère gardée",
  capsule: "Capsule temporelle",
  photo: "Photo de la discussion",
  child: "Souvenir",
};

export default function SouvenirsPage() {
  const { children, personById, isParent } = useFamily();
  const [items, setItems] = useState<Souvenir[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [index, setIndex] = useState<number | null>(null);
  const today = todayISO();

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = supabase();
      const nowMs = Date.now();
      const [msgRes, childRes] = await Promise.all([
        isParent
          ? sb
              .from("messages")
              .select("*")
              .eq("channel", COUPLE_CHANNEL)
              .or("kept.eq.true,kind.eq.photo,kind.eq.capsule")
              .eq("deleted", false)
              .order("created_at", { ascending: false })
              .limit(1000)
          : Promise.resolve({ data: [] as Message[] }),
        sb.from("child_entries").select("*").eq("kind", "memory").order("entry_date", { ascending: false }).limit(1000),
      ]);
      const msgs = (msgRes.data ?? []) as Message[];
      const capsuleIds = msgs.filter((m) => m.kind === "capsule" && m.unlock_at && new Date(m.unlock_at).getTime() <= nowMs).map((m) => m.id);
      const { data: contents } = capsuleIds.length
        ? await sb.from("capsule_contents").select("*").in("message_id", capsuleIds)
        : { data: [] as CapsuleContent[] };
      const byId = new Map(((contents ?? []) as CapsuleContent[]).map((c) => [c.message_id, c]));

      const list: Souvenir[] = [];
      for (const m of msgs) {
        const day = toParisISODate(m.created_at);
        if (m.kind === "ephemeral" && m.kept && m.media_path) {
          list.push({ id: m.id, day, at: m.created_at, source: "ephemeral", mediaPath: m.media_path, title: null, text: null });
        } else if (m.kind === "photo" && m.media_path) {
          list.push({ id: m.id, day, at: m.created_at, source: "photo", mediaPath: m.media_path, title: null, text: m.body });
        } else if (m.kind === "capsule") {
          const c = byId.get(m.id);
          if (c && (c.body || c.media_path)) {
            list.push({ id: m.id, day, at: m.created_at, source: "capsule", mediaPath: c.media_path, title: "Capsule temporelle", text: c.body });
          }
        }
      }
      for (const e of (childRes.data ?? []) as ChildEntry[]) {
        list.push({
          id: e.id,
          day: e.entry_date,
          at: `${e.entry_date}T12:00:00`,
          source: "child",
          mediaPath: e.media_path,
          title: e.title,
          text: e.body,
          person: personById(e.person_id),
        });
      }
      list.sort((a, b) => (a.day === b.day ? b.at.localeCompare(a.at) : b.day.localeCompare(a.day)));
      if (alive) setItems(list);
    })();
    return () => {
      alive = false;
    };
  }, [isParent, personById]);

  const shown = useMemo(
    () =>
      (items ?? []).filter((s) =>
        filter === "all" ? true : filter === "us" ? s.source !== "child" : s.source === "child" && s.person?.id === filter,
      ),
    [items, filter],
  );

  const months = useMemo(() => {
    const groups: { key: string; label: string; items: { s: Souvenir; i: number }[] }[] = [];
    shown.forEach((s, i) => {
      const key = s.day.slice(0, 7);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: formatMonth(`${key}-15T12:00:00Z`), items: [] };
        groups.push(g);
      }
      g.items.push({ s, i });
    });
    return groups;
  }, [shown]);

  const onThisDay = useMemo(
    () =>
      shown
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.day.slice(5) === today.slice(5) && s.day.slice(0, 4) < today.slice(0, 4)),
    [shown, today],
  );

  return (
    <>
      <PageHeader title="Souvenirs 📸" subtitle="Les moments qu'on a voulu garder" back="/plus" />

      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          Tout
        </Chip>
        {isParent && (
          <Chip active={filter === "us"} onClick={() => setFilter("us")}>
            💑 Nous deux
          </Chip>
        )}
        {children.map((c) => (
          <Chip key={c.id} active={filter === c.id} color={c.color} onClick={() => setFilter(c.id)}>
            {c.emoji} {c.name}
          </Chip>
        ))}
      </div>

      {items === null ? (
        <LoadingBlock />
      ) : shown.length === 0 ? (
        <EmptyState
          emoji="🌱"
          title="Pas encore de souvenirs ici"
          text="Les photos éphémères que vous gardez tous les deux, les capsules ouvertes, les photos de la discussion et les souvenirs des enfants apparaîtront ici."
        />
      ) : (
        <>
          {onThisDay.length > 0 && <OnThisDay items={onThisDay} today={today} onOpen={setIndex} />}
          {months.map((g) => (
            <section key={g.key}>
              <SectionTitle>
                <span className="capitalize">{g.label}</span>
              </SectionTitle>
              <div className="grid grid-cols-3 gap-1.5">
                {g.items.map(({ s, i }) => (
                  <Tile key={`${s.source}-${s.id}`} s={s} onClick={() => setIndex(i)} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {index !== null && shown[index] && (
        <Viewer
          s={shown[index]}
          onClose={() => setIndex(null)}
          onPrev={index > 0 ? () => setIndex(index - 1) : undefined}
          onNext={index < shown.length - 1 ? () => setIndex(index + 1) : undefined}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------ tuiles
function Tile({ s, onClick, className }: { s: Souvenir; onClick: () => void; className?: string }) {
  const url = useSignedUrl(s.mediaPath);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("relative aspect-square overflow-hidden rounded-2xl bg-card-2 transition active:scale-[0.97]", className)}
    >
      {s.mediaPath ? (
        url ? (
          <img src={url} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Spinner className="size-4" />
          </span>
        )
      ) : (
        <span
          className={cn(
            "flex size-full flex-col justify-between p-2 text-left",
            s.source === "capsule" ? "bg-sand-soft" : "bg-sky-soft",
          )}
        >
          <span className="text-xl">{s.source === "capsule" ? "💌" : (s.person?.emoji ?? "💭")}</span>
          <span className="line-clamp-3 text-xs font-medium leading-snug text-ink">{s.title || s.text}</span>
        </span>
      )}
      <span className="absolute right-1 top-1 rounded-full bg-card/85 px-1.5 text-xs">{s.source === "child" ? (s.person?.emoji ?? "🧸") : SOURCE_BADGE[s.source]}</span>
    </button>
  );
}

function OnThisDay({ items, today, onOpen }: { items: { s: Souvenir; i: number }[]; today: string; onOpen: (i: number) => void }) {
  const years = Number(today.slice(0, 4)) - Number(items[0].s.day.slice(0, 4));
  return (
    <div className="mb-2 rounded-3xl bg-gradient-to-br from-rose-soft to-sand-soft p-4">
      <p className="font-display text-lg font-bold">
        🕰️ Il y a {years === 1 ? "un an" : `${years} ans`}…
      </p>
      <p className="mb-3 text-sm text-muted">Ce jour-là, {formatDateFull(items[0].s.day)}</p>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {items.map(({ s, i }) => (
          <Tile key={`otd-${s.source}-${s.id}`} s={s} onClick={() => onOpen(i)} className="w-28 shrink-0" />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ plein écran
function Viewer({ s, onClose, onPrev, onNext }: { s: Souvenir; onClose: () => void; onPrev?: () => void; onNext?: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  const header = (
    <div>
      <p className="font-semibold">
        {s.source === "child" && s.person ? `${s.person.emoji} ${s.person.name}` : SOURCE_LABEL[s.source]}
      </p>
      <p className="text-white/70">{formatDateFull(s.day)}</p>
    </div>
  );
  const nav = (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        aria-label="Précédent"
        disabled={!onPrev}
        onClick={onPrev}
        className="inline-flex size-12 items-center justify-center rounded-full bg-white/10 disabled:opacity-20"
      >
        <ChevronLeft className="size-6" />
      </button>
      <div className="min-w-0 flex-1 text-center">
        {s.title && s.source !== "capsule" && <p className="font-semibold">{s.title}</p>}
        {s.text && s.mediaPath && <p className="line-clamp-4 whitespace-pre-wrap text-sm text-white/85">{s.text}</p>}
      </div>
      <button
        type="button"
        aria-label="Suivant"
        disabled={!onNext}
        onClick={onNext}
        className="inline-flex size-12 items-center justify-center rounded-full bg-white/10 disabled:opacity-20"
      >
        <ChevronRight className="size-6" />
      </button>
    </div>
  );

  if (s.mediaPath) return <FullscreenImage key={s.id} path={s.mediaPath} onClose={onClose} header={header} footer={nav} />;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true">
      <div className="flex items-center gap-2 px-3 pt-safe">
        <div className="min-w-0 flex-1 py-3 text-sm">{header}</div>
        <button type="button" aria-label="Fermer" onClick={onClose} className="mt-1 inline-flex size-11 items-center justify-center rounded-full bg-white/10">
          <X className="size-6" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="animate-pop max-w-md rounded-3xl bg-card p-6 text-ink">
          <p className="mb-2 text-3xl">{s.source === "capsule" ? "💌" : (s.person?.emoji ?? "💭")}</p>
          {s.title && s.source !== "capsule" && <p className="mb-1 font-display text-xl font-bold">{s.title}</p>}
          <p className="whitespace-pre-wrap break-words">{s.text}</p>
        </div>
      </div>
      <div className="px-4 pb-safe pt-2">{nav}</div>
      <div className="h-4" />
    </div>
  );
}
