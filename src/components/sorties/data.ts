"use client";

// Chargement des lieux (avec mise à jour en temps réel) et petites aides partagées par les pages Sorties.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/lib/family";
import { supabase } from "@/lib/supabase/client";
import type { Place, Space } from "@/lib/types";

export type SpaceFilter = "all" | Space;

export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase().from("places").select("*").order("created_at", { ascending: false });
    if (error) setError("Impossible de charger les sorties.");
    else {
      setPlaces((data ?? []) as Place[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sb = supabase();
    const ch = sb
      .channel(`sorties-places-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "places" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [load]);

  return { places, loading, error, reload: load };
}

export function usePlace(id: string | undefined) {
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase().from("places").select("*").eq("id", id).maybeSingle();
    setPlace((data as Place | null) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    load();
    const sb = supabase();
    const ch = sb
      .channel(`sorties-place-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "places", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [id, load]);

  return { place, loading, reload: load, setPlace };
}

/** Identifiants des parents (ceux qui notent et qui swipent) */
export function useParentIds(): string[] {
  const { members } = useFamily();
  return useMemo(() => members.filter((m) => m.role === "parent").map((m) => m.id), [members]);
}

export function filterBySpace(places: Place[], space: SpaceFilter): Place[] {
  return space === "all" ? places : places.filter((p) => p.space === space);
}

/** Mélange stable pour la journée (même ordre à chaque ouverture, différent chaque jour) */
export function dailyShuffle<T extends { id: string }>(list: T[], seed: string): T[] {
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  return [...list].sort((a, b) => hash(seed + a.id) - hash(seed + b.id));
}

export const SPACE_OPTIONS: { value: SpaceFilter; label: string }[] = [
  { value: "family", label: "👨‍👩‍👧‍👦 Famille" },
  { value: "couple", label: "💑 À deux" },
  { value: "all", label: "Tout" },
];
