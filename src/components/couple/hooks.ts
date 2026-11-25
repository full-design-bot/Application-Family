"use client";

// Données « Nous deux » partagées entre la page et les cartes de l'accueil.

import { useCallback, useEffect, useState } from "react";
import { questionForDate, type DailyQuestion } from "@/content/questions-du-jour";
import { todayISO } from "@/lib/dates";
import { useFamily } from "@/lib/family";
import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import type { Mood, PairedAnswer } from "@/lib/types";
import { COUPLE_CHANNEL, startOfTodayISO, uniqueChannel } from "./lib";

// ------------------------------------------------------------ je pense à toi
/** Nombre de « je pense à toi » reçus aujourd'hui (temps réel). */
export function useThoughtsToday(): number {
  const { partner, isParent } = useFamily();
  const partnerId = partner?.id;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isParent || !partnerId) return;
    const sb = supabase();
    let alive = true;
    const load = async () => {
      const { count: c } = await sb
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("channel", COUPLE_CHANNEL)
        .eq("kind", "thought")
        .eq("sender_id", partnerId)
        .gte("created_at", startOfTodayISO());
      if (alive) setCount(c ?? 0);
    };
    void load();
    const ch = sb
      .channel(uniqueChannel("couple-thoughts"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel=eq.${COUPLE_CHANNEL}` }, (p) => {
        const m = p.new as { kind: string; sender_id: string };
        if (m.kind === "thought" && m.sender_id === partnerId) setCount((c) => c + 1);
      })
      .subscribe();
    return () => {
      alive = false;
      sb.removeChannel(ch);
    };
  }, [isParent, partnerId]);

  return count;
}

// ------------------------------------------------------------ météo du cœur
export function useMoods() {
  const { me, partner, isParent } = useFamily();
  const partnerId = partner?.id;
  const [date, setDate] = useState(() => todayISO());
  const [mine, setMine] = useState<Mood | null>(null);
  const [theirs, setTheirs] = useState<Mood | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = todayISO();
    setDate(today);
    const { data } = await supabase().from("moods").select("*").eq("mood_date", today);
    const list = (data ?? []) as Mood[];
    setMine(list.find((m) => m.member_id === me.id) ?? null);
    setTheirs(partnerId ? (list.find((m) => m.member_id === partnerId) ?? null) : null);
    setLoading(false);
  }, [me.id, partnerId]);

  useEffect(() => {
    if (!isParent) return;
    void load();
    const sb = supabase();
    const ch = sb
      .channel(uniqueChannel("couple-moods"))
      .on("postgres_changes", { event: "*", schema: "public", table: "moods" }, () => void load())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [isParent, load]);

  const save = useCallback(
    async (mood: string, note: string | null) => {
      const today = todayISO();
      const row = { member_id: me.id, mood_date: today, mood, note: note?.trim() || null, updated_at: new Date().toISOString() };
      setMine(row);
      const { error } = await supabase().from("moods").upsert(row, { onConflict: "member_id,mood_date" });
      if (error) {
        await load();
        throw error;
      }
    },
    [me.id, load],
  );

  return { date, mine, theirs, loading, save, reload: load };
}

// ------------------------------------------------------------ question du jour
export interface DailyAnswer {
  text: string;
  question?: string;
}

export function answerText(a: PairedAnswer | null | undefined): string {
  if (!a) return "";
  const v = a.answer as DailyAnswer | string | null;
  if (typeof v === "string") return v;
  return v?.text ?? "";
}

export function useDailyQuestion() {
  const { me, partner, isParent } = useFamily();
  const [date, setDate] = useState(() => todayISO());
  const [mine, setMine] = useState<PairedAnswer | null>(null);
  const [theirs, setTheirs] = useState<PairedAnswer | null>(null);
  const [partnerAnswered, setPartnerAnswered] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const question: DailyQuestion = questionForDate(date);

  const load = useCallback(async () => {
    const today = todayISO();
    setDate(today);
    const sb = supabase();
    const [{ data }, rpc] = await Promise.all([
      sb.from("paired_answers").select("*").eq("game", "daily").eq("item_key", today),
      sb.rpc("couple_partner_answered", { p_game: "daily", p_item: today }),
    ]);
    const list = (data ?? []) as PairedAnswer[];
    const my = list.find((a) => a.member_id === me.id) ?? null;
    const their = list.find((a) => a.member_id !== me.id) ?? null;
    setMine(my);
    setTheirs(their);
    setPartnerAnswered(their ? true : rpc.error ? null : Boolean(rpc.data));
    setLoading(false);
  }, [me.id]);

  useEffect(() => {
    if (!isParent) return;
    void load();
    const sb = supabase();
    const ch = sb
      .channel(uniqueChannel("couple-daily"))
      .on("postgres_changes", { event: "*", schema: "public", table: "paired_answers", filter: "game=eq.daily" }, () => void load())
      .subscribe();
    const t = setInterval(() => void load(), 60_000);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(ch);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isParent, load]);

  const submit = useCallback(
    async (text: string) => {
      const today = todayISO();
      const q = questionForDate(today);
      const { data, error } = await supabase()
        .from("paired_answers")
        .upsert(
          { game: "daily", item_key: today, member_id: me.id, answer: { text: text.trim(), question: q.text } satisfies DailyAnswer },
          { onConflict: "game,item_key,member_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      setMine(data as PairedAnswer);
      await load();
      if (partner) {
        void notify({
          title: `❓ ${me.display_name} a répondu à la question du jour`,
          body: theirs || partnerAnswered ? "Viens découvrir sa réponse 👀" : "Réponds pour découvrir sa réponse !",
          url: "/nous-deux",
          tag: "daily",
        });
      }
    },
    [me.id, me.display_name, partner, theirs, partnerAnswered, load],
  );

  return { date, question, mine, theirs, partnerAnswered, loading, submit, reload: load };
}
