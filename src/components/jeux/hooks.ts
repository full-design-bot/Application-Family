"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/lib/family";
import { isMyTurn } from "@/lib/jeux/games";
import { supabase } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";
import { fetchGame, fetchPartnerKeys, randomId } from "./data";

/** Une partie, mise à jour en temps réel. */
export function useGame(id: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const reload = useCallback(async () => {
    const g = await fetchGame(id);
    setGame(g);
    setMissing(!g);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    reload();
    const sb = supabase();
    const ch = sb
      .channel(`jeux-partie-${id}-${randomId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${id}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setGame(null);
          setMissing(true);
        } else {
          const next = payload.new as Game;
          // on ignore un événement plus ancien que ce qu'on affiche déjà
          setGame((prev) => (!prev || Date.parse(prev.updated_at) <= Date.parse(next.updated_at) ? next : prev));
        }
      })
      .subscribe();
    // au retour sur l'app (iPhone), on recharge : le temps réel a pu décrocher
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, reload]);

  return { game, setGame, loading, missing, reload };
}

/** Toutes mes parties (en cours et terminées), en temps réel. */
export function useGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase().from("games").select("*").order("updated_at", { ascending: false }).limit(300);
    setGames((data ?? []) as Game[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const sb = supabase();
    const ch = sb
      .channel(`jeux-liste-${randomId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => reload())
      .subscribe();
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  return { games, loading, reload };
}

/**
 * Parties où c'est à moi de jouer (utilisable sur l'accueil) :
 * const { games, count } = useMyTurnGames();
 */
export function useMyTurnGames() {
  const { me } = useFamily();
  const { games, loading } = useGames();
  const mine = useMemo(() => games.filter((g) => isMyTurn(g, me.id)), [games, me.id]);
  return { games: mine, count: mine.length, loading };
}

/**
 * Questions des jeux découverte auxquelles l'autre a répondu et pas moi.
 * Renvoie un dictionnaire jeu → clés en attente.
 */
export function usePairedPending(games: string[]) {
  const { me, isParent } = useFamily();
  const [pending, setPending] = useState<Record<string, string[]>>({});
  const key = games.join(",");

  const reload = useCallback(async () => {
    if (!isParent) return;
    const list = key.split(",");
    const [partnerKeys, { data: mine }] = await Promise.all([
      fetchPartnerKeys(),
      supabase().from("paired_answers").select("game, item_key").eq("member_id", me.id).in("game", list),
    ]);
    const answered = new Set((mine ?? []).map((r) => `${r.game}::${r.item_key}`));
    const out: Record<string, string[]> = {};
    for (const g of list) out[g] = [];
    for (const r of partnerKeys) {
      if (!list.includes(r.game) || answered.has(`${r.game}::${r.item_key}`)) continue;
      out[r.game].push(r.item_key);
    }
    setPending(out);
  }, [key, me.id, isParent]);

  useEffect(() => {
    reload();
    const sb = supabase();
    const ch = sb
      .channel(`jeux-paired-${randomId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "paired_answers" }, () => reload())
      .subscribe();
    // les réponses de l'autre restent invisibles (RLS) : on recharge au retour sur l'app
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  const total = Object.values(pending).reduce((n, l) => n + l.length, 0);
  return { pending, total, reload };
}
