"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CategoryChips } from "@/components/sorties/PlaceBits";
import { PlacesMap, type MapPlace } from "@/components/sorties/PlacesMap";
import { SPACE_OPTIONS, filterBySpace, usePlaces, type SpaceFilter } from "@/components/sorties/data";
import { LoadingBlock, PageHeader, Segmented } from "@/components/ui";
import { useFamily } from "@/lib/family";
import type { PlaceCategory } from "@/lib/types";

type StatusFilter = "all" | "todo" | "done";

export default function CartePage() {
  const router = useRouter();
  const { isParent } = useFamily();
  const { places, loading } = usePlaces();
  const [space, setSpace] = useState<SpaceFilter>("all");
  const [category, setCategory] = useState<PlaceCategory | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(
    () =>
      filterBySpace(places, space)
        .filter((p) => category === "all" || p.category === category)
        .filter((p) => status === "all" || p.status === status),
    [places, space, category, status],
  );
  const onMap = useMemo<MapPlace[]>(
    () =>
      filtered
        .filter((p) => p.lat !== null && p.lng !== null)
        .map((p) => ({ id: p.id, name: p.name, category: p.category, lat: p.lat!, lng: p.lng!, status: p.status })),
    [filtered],
  );
  const missing = filtered.length - onMap.length;

  return (
    <>
      <PageHeader title="Carte 🗺️" back="/sorties" subtitle={loading ? undefined : `${onMap.length} lieu${onMap.length > 1 ? "x" : ""} sur la carte`} />

      <div className="space-y-3">
        {isParent && <Segmented<SpaceFilter> value={space} onChange={setSpace} options={SPACE_OPTIONS} />}
        <CategoryChips value={category} onChange={setCategory} />
        <Segmented<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Tous" },
            { value: "todo", label: "🔖 À tester" },
            { value: "done", label: "✅ Testés" },
          ]}
        />
      </div>

      <div className="mt-3 h-[calc(100dvh-380px)] min-h-[320px] overflow-hidden rounded-3xl border border-line">
        {loading ? <LoadingBlock /> : <PlacesMap places={onMap} onSelect={(id) => router.push(`/sorties/${id}`)} />}
      </div>

      {missing > 0 && (
        <p className="mt-2 px-1 text-sm text-muted">
          {missing} lieu{missing > 1 ? "x" : ""} sans adresse précise {missing > 1 ? "ne sont" : "n'est"} pas sur la carte (« 🔎 Localiser » dans la fiche → Modifier).
        </p>
      )}
      <p className="mt-1 px-1 text-xs text-muted">Touche un emoji pour ouvrir la fiche. Bordure verte = déjà testé.</p>
    </>
  );
}
