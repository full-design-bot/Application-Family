// Petits utilitaires d'affichage pour les sorties (logique pure, utilisable côté client).

import type { Place } from "../types";
import { categoryEmoji } from "./categories";

/** Lien « Ouvrir dans Plans » */
export function appleMapsUrl(p: Pick<Place, "name" | "address" | "city" | "lat" | "lng">): string {
  const q = [p.name, fullAddress(p)].filter(Boolean).join(", ");
  const params = new URLSearchParams({ q });
  if (p.lat !== null && p.lng !== null) params.set("ll", `${p.lat},${p.lng}`);
  return `https://maps.apple.com/?${params}`;
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${encodeURIComponent(handle.replace(/^@/, ""))}/`;
}

/** "12 rue X, 33000 Bordeaux" (ajoute la ville si elle n'est pas déjà dans l'adresse) */
export function fullAddress(p: Pick<Place, "address" | "city">): string {
  if (!p.address) return p.city ?? "";
  if (p.city && !p.address.toLowerCase().includes(p.city.toLowerCase())) return `${p.address}, ${p.city}`;
  return p.address;
}

/** Ouvre la création d'événement de l'agenda préremplie */
export function agendaUrl(p: Pick<Place, "name" | "address" | "city" | "category" | "space">): string {
  const params = new URLSearchParams({
    titre: p.name,
    lieu: fullAddress(p),
    emoji: categoryEmoji(p.category),
    space: p.space,
  });
  return `/agenda/nouveau?${params}`;
}

export function priceLabel(n: number | null | undefined): string | null {
  return n && n >= 1 && n <= 4 ? "€".repeat(n) : null;
}

/** Nettoie un @compte saisi à la main (ou un lien Instagram) */
export function cleanInstagramHandle(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  const fromUrl = t.match(/instagram\.com\/([a-z0-9._]{1,30})/i);
  const h = (fromUrl ? fromUrl[1] : t.replace(/^@/, "")).toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : null;
}

/** Notes des deux parents : accord si les deux ont noté et que l'écart est ≤ 1. */
export function ratingsAgreement(ratings: Record<string, number>, ids: string[]): "agree" | "disagree" | null {
  const values = ids.map((id) => ratings[id]).filter((v): v is number => typeof v === "number");
  if (values.length < 2) return null;
  return Math.max(...values) - Math.min(...values) <= 1 ? "agree" : "disagree";
}

export function averageRating(ratings: Record<string, number>): number | null {
  const v = Object.values(ratings).filter((x) => typeof x === "number" && x >= 1 && x <= 5);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Tags libres : "terrasse, enfants ok" → ["terrasse", "enfants ok"] */
export function parseTags(s: string): string[] {
  const seen = new Set<string>();
  return s
    .split(/[,;\n#]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && t.length <= 30 && !seen.has(t) && (seen.add(t), true))
    .slice(0, 12);
}

/** Lieu correspondant à une recherche texte */
export function matchesSearch(p: Place, q: string): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const needle = norm(q.trim());
  if (!needle) return true;
  const hay = norm([p.name, p.city, p.address, p.description, p.notes, p.instagram, ...(p.tags ?? [])].filter(Boolean).join(" "));
  return needle.split(/\s+/).every((w) => hay.includes(w));
}
