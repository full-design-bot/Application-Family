"use client";

// Outils partagés de l'espace couple (messages, nous deux, souvenirs).

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect, useState } from "react";
import { TZ, parisDateTime, todayISO } from "@/lib/dates";
import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import type { Message, MessageKind } from "@/lib/types";

export const COUPLE_CHANNEL = "couple";

/** Nom de canal temps réel unique (un composant peut être monté plusieurs fois). */
export function uniqueChannel(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Heure courante, rafraîchie toutes les `intervalMs` millisecondes. */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}

export function truncate(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/** Début de la journée (heure de Paris) en ISO, pour les filtres "aujourd'hui". */
export function startOfTodayISO(): string {
  return parisDateTime(todayISO(), "00:00").toISOString();
}

// ------------------------------------------------------------ messages
export async function markChatRead(memberId: string) {
  await supabase()
    .from("chat_reads")
    .upsert({ member_id: memberId, channel: COUPLE_CHANNEL, last_read_at: new Date().toISOString() }, { onConflict: "member_id,channel" });
}

export type NewMessage = Partial<Omit<Message, "id" | "created_at" | "channel" | "sender_id">> & { kind: MessageKind };

/** Insère un message dans la discussion du couple et renvoie la ligne créée. */
export async function insertMessage(senderId: string, msg: NewMessage): Promise<Message> {
  const { data, error } = await supabase()
    .from("messages")
    .insert({ channel: COUPLE_CHANNEL, sender_id: senderId, ...msg })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

/** Prévient l'autre parent d'un nouveau message. */
export function notifyNewMessage(myName: string, kind: MessageKind, body?: string | null) {
  const text =
    kind === "text"
      ? truncate(body ?? "", 120)
      : kind === "photo"
        ? "📷 Une photo"
        : kind === "ephemeral"
          ? "📸 Photo éphémère"
          : kind === "capsule"
            ? "🔒 Une capsule temporelle pour toi"
            : kind === "drawing"
              ? "🎨 Un dessin"
              : kind === "thought"
                ? "💛 pense à toi"
                : truncate(body ?? "", 120);
  void notify({ title: myName, body: text, url: "/messages", tag: "messages" });
}

/** Envoie un « Je pense à toi » (message spécial + notification). */
export async function sendThought(senderId: string, myName: string): Promise<Message> {
  const m = await insertMessage(senderId, { kind: "thought", body: "💛" });
  void notify({ title: `💛 ${myName} pense à toi`, body: "Un petit coucou du cœur, juste comme ça.", url: "/nous-deux", tag: "thought" });
  return m;
}

/** Photo éphémère : « 💛 On la garde ? » (RPC atomique, repli si la migration 0003 manque). */
export async function keepVote(message: Message, meId: string, parentCount: number): Promise<Message> {
  const sb = supabase();
  const { data, error } = await sb.rpc("couple_keep_vote", { p_message: message.id });
  if (!error && data) return data as Message;
  const votes = Array.from(new Set([...(message.keep_votes ?? []), meId]));
  const kept = votes.length >= Math.max(2, parentCount);
  const { data: upd, error: err2 } = await sb
    .from("messages")
    .update({ keep_votes: votes, kept, ...(kept ? { expires_at: null } : {}) })
    .eq("id", message.id)
    .select("*")
    .single();
  if (err2) throw err2;
  return upd as Message;
}

/** Photo éphémère : le destinataire l'ouvre (viewed_at = maintenant, une seule fois). */
export async function markViewed(message: Message): Promise<Message> {
  const sb = supabase();
  const { data, error } = await sb.rpc("couple_mark_viewed", { p_message: message.id });
  if (!error && data) return data as Message;
  if (message.viewed_at) return message;
  const { data: upd } = await sb
    .from("messages")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", message.id)
    .is("viewed_at", null)
    .select("*")
    .maybeSingle();
  return (upd as Message | null) ?? { ...message, viewed_at: new Date().toISOString() };
}

/** Une photo éphémère est-elle encore visible ? */
export function ephemeralAlive(m: Message, now: number, meId: string): boolean {
  if (m.kept) return !!m.media_path;
  if (m.deleted || !m.media_path) return false;
  if (m.expires_at && new Date(m.expires_at).getTime() <= now) return false;
  // Vue unique déjà ouverte par le destinataire : plus visible (sauf l'aperçu côté expéditeur)
  if (m.view_once && m.viewed_at && m.sender_id !== meId) return false;
  return true;
}

// ------------------------------------------------------------ dates
/** "25 décembre" (+ année si ce n'est pas cette année) */
export function formatUnlockDate(iso: string): string {
  const d = new TZDate(new Date(iso), TZ);
  const sameYear = d.getFullYear() === new TZDate(new Date(), TZ).getFullYear();
  return format(d, sameYear ? "d MMMM" : "d MMMM yyyy", { locale: fr });
}

/** "novembre 2026" */
export function formatMonth(iso: string): string {
  return format(new TZDate(new Date(iso), TZ), "MMMM yyyy", { locale: fr });
}

/** Compte à rebours lisible : "12 j 4 h", "3 h 05 min", "4 min 10 s", "8 s" */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "maintenant";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(sec).padStart(2, "0")} s`;
  return `${sec} s`;
}

// ------------------------------------------------------------ humeurs
export const MOODS: { emoji: string; label: string }[] = [
  { emoji: "☀️", label: "Grand soleil" },
  { emoji: "🌤️", label: "Plutôt beau" },
  { emoji: "☁️", label: "Nuageux" },
  { emoji: "🌧️", label: "Petite pluie" },
  { emoji: "⛈️", label: "Orageux" },
  { emoji: "🌈", label: "Ça va mieux" },
  { emoji: "😴", label: "Fatigué·e" },
  { emoji: "🥰", label: "Amoureux·se" },
];

export function moodLabel(emoji: string | null | undefined): string {
  return MOODS.find((m) => m.emoji === emoji)?.label ?? "";
}
