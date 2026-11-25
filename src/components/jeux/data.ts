"use client";

// Accès aux données des jeux (client navigateur).

import { notify } from "@/lib/push/client";
import { supabase } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";
import type { NewGameRow } from "@/lib/jeux/games";

export async function fetchGame(id: string): Promise<Game | null> {
  const { data } = await supabase().from("games").select("*").eq("id", id).maybeSingle();
  return (data as Game | null) ?? null;
}

export async function createGame(row: NewGameRow): Promise<Game> {
  const { data, error } = await supabase().from("games").insert(row).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Impossible de créer la partie");
  return data as Game;
}

export async function deleteGame(id: string) {
  const { error } = await supabase().from("games").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export class GameConflict extends Error {}

/**
 * Met à jour une partie sans écraser un coup joué en même temps :
 * on relit la ligne, on calcule le changement, et on n'écrit que si
 * `updated_at` n'a pas bougé entre-temps (sinon on recommence).
 * `mutate` renvoie null pour abandonner (coup devenu impossible).
 */
export async function updateGame(
  id: string,
  mutate: (game: Game) => Partial<Pick<Game, "state" | "turn" | "status" | "winner">> | null,
): Promise<Game | null> {
  const sb = supabase();
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await fetchGame(id);
    if (!current) throw new Error("Partie introuvable");
    const patch = mutate(current);
    if (!patch) return null;
    const { data, error } = await sb
      .from("games")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("updated_at", current.updated_at)
      .select("*");
    if (error) throw new Error(error.message);
    if (data && data.length > 0) return data[0] as Game;
    await new Promise((r) => setTimeout(r, 120 + attempt * 80));
  }
  throw new GameConflict("La partie a bougé, réessaie.");
}

export async function setSecret(gameId: string, memberId: string, secret: Record<string, unknown>) {
  const { error } = await supabase()
    .from("game_secrets")
    .upsert({ game_id: gameId, member_id: memberId, secret }, { onConflict: "game_id,member_id" });
  if (error) throw new Error(error.message);
}

export async function getMySecret<T = Record<string, unknown>>(gameId: string, memberId: string): Promise<T | null> {
  const { data } = await supabase()
    .from("game_secrets")
    .select("secret")
    .eq("game_id", gameId)
    .eq("member_id", memberId)
    .maybeSingle();
  return ((data?.secret as T | undefined) ?? null) as T | null;
}

/** Message d'erreur lisible depuis une erreur Supabase / RPC. */
export function errorText(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Oups, quelque chose s'est mal passé.";
}

export function gameUrl(id: string) {
  return `/jeux/partie/${id}`;
}

/** Notification « c'est ton tour » à l'autre joueur. */
export function notifyGame(game: Pick<Game, "id">, title: string, body?: string) {
  void notify({ title, body, url: gameUrl(game.id), tag: `jeux-${game.id}` });
}

/** Clés des questions auxquelles l'autre a répondu (sans leurs réponses). */
export async function fetchPartnerKeys(game?: string): Promise<{ game: string; item_key: string }[]> {
  const { data, error } = await supabase().rpc("paired_partner_keys", { p_game: game ?? null });
  if (error || !Array.isArray(data)) return [];
  return data as { game: string; item_key: string }[];
}

export function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
