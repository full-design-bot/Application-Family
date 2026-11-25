"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryChips, PlaceCard } from "@/components/sorties/PlaceBits";
import { SPACE_OPTIONS, filterBySpace, useParentIds, usePlaces, type SpaceFilter } from "@/components/sorties/data";
import { EmptyState, Input, LinkButton, LoadingBlock, PageHeader, Segmented } from "@/components/ui";
import { useFamily } from "@/lib/family";
import { averageRating, matchesSearch } from "@/lib/places/links";
import type { PlaceCategory } from "@/lib/types";

type StatusFilter = "todo" | "done";

export default function SortiesPage() {
  const { isParent } = useFamily();
  const { places, loading, error } = usePlaces();
  const parentIds = useParentIds();
  const [space, setSpace] = useState<SpaceFilter>("all");
  const [category, setCategory] = useState<PlaceCategory | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("todo");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const base = filterBySpace(places, space).filter((p) => category === "all" || p.category === category);
    return { todo: base.filter((p) => p.status === "todo").length, done: base.filter((p) => p.status === "done").length };
  }, [places, space, category]);

  const visible = useMemo(() => {
    const list = filterBySpace(places, space)
      .filter((p) => category === "all" || p.category === category)
      .filter((p) => p.status === status)
      .filter((p) => matchesSearch(p, q));
    if (status === "done") {
      // Les mieux notés d'abord
      return [...list].sort((a, b) => (averageRating(b.ratings) ?? 0) - (averageRating(a.ratings) ?? 0));
    }
    return list;
  }, [places, space, category, status, q]);

  return (
    <>
      <PageHeader
        title="Sorties 📍"
        subtitle="Restos, bars, balades et idées de sorties"
        back="/plus"
        action={
          <Link
            href="/sorties/ajouter"
            aria-label="Ajouter"
            className="inline-flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm active:brightness-95"
          >
            <Plus className="size-6" />
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        <QuickAction href="/sorties/ajouter" emoji="➕" label="Ajouter" className="bg-accent-soft" />
        <QuickAction href="/sorties/ce-soir" emoji="🎲" label="On sort où ce soir ?" className="bg-rose-soft" />
        <QuickAction href="/sorties/carte" emoji="🗺️" label="Carte" className="bg-sage-soft" />
      </div>

      <div className="mt-4 space-y-3">
        {isParent && <Segmented<SpaceFilter> value={space} onChange={setSpace} options={SPACE_OPTIONS} />}
        <CategoryChips value={category} onChange={setCategory} />
        <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: "todo", label: `🔖 À tester (${counts.todo})` },
            { value: "done", label: `✅ Testés (${counts.done})` },
          ]}
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom, une ville, un tag…" className="pl-11" type="search" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <EmptyState emoji="😕" title={error} />
        ) : visible.length === 0 ? (
          places.length === 0 ? (
            <EmptyState
              emoji="🍽️"
              title="Aucune idée de sortie pour l'instant"
              text="Colle un lien Google Maps, un compte Instagram ou tape juste un nom de resto."
              action={<LinkButton href="/sorties/ajouter">➕ Ajouter la première</LinkButton>}
            />
          ) : (
            <EmptyState
              emoji={status === "done" ? "🧪" : "🔍"}
              title={status === "done" ? "Rien de testé ici pour l'instant" : "Rien ne correspond"}
              text={q ? "Essaie un autre mot." : "Change les filtres pour voir plus d'idées."}
            />
          )
        ) : (
          visible.map((p) => <PlaceCard key={p.id} place={p} parentIds={parentIds} />)
        )}
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        📲 <Link href="/sorties/raccourci" className="font-semibold text-accent underline-offset-2 active:underline">
          Ajouter depuis le bouton Partager de l&apos;iPhone
        </Link>
      </p>
    </>
  );
}

function QuickAction({ href, emoji, label, className }: { href: string; emoji: string; label: string; className?: string }) {
  return (
    <Link href={href} className={`flex min-h-20 flex-col items-center justify-center rounded-3xl p-2 text-center transition active:scale-[0.97] ${className ?? ""}`}>
      <span className="text-2xl">{emoji}</span>
      <span className="mt-1 text-xs font-bold leading-tight">{label}</span>
    </Link>
  );
}
