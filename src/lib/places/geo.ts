// Normalisation des réponses OpenStreetMap (Nominatim, Photon). Logique pure, testée dans geo.test.ts.

import { categoryFromOsm } from "./categories";
import type { PlaceSuggestion } from "./types";

/** Centre de Bordeaux */
export const BORDEAUX = { lat: 44.8378, lng: -0.5792 };
/** Zone de préférence pour la recherche (gauche, haut, droite, bas) : Bordeaux Métropole élargie */
export const BORDEAUX_VIEWBOX = "-0.80,45.00,-0.40,44.70";

type Dict = Record<string, unknown>;

function s(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function join(parts: (string | null | undefined)[], sep = " "): string | null {
  const t = parts.filter(Boolean).join(sep).trim();
  return t || null;
}

/** Résultat Nominatim (format=jsonv2&addressdetails=1) → suggestion */
export function normalizeNominatim(r: unknown): PlaceSuggestion | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Dict;
  const lat = num(o.lat);
  const lng = num(o.lon);
  if (lat === null || lng === null) return null;
  const a = (o.address && typeof o.address === "object" ? o.address : {}) as Dict;
  const city = s(a.city) ?? s(a.town) ?? s(a.village) ?? s(a.municipality) ?? s(a.hamlet) ?? null;
  const street = join([s(a.house_number), s(a.road) ?? s(a.pedestrian) ?? s(a.footway) ?? s(a.square)]);
  const address = join([street, join([s(a.postcode), city])], ", ");
  const display = s(o.display_name);
  const name = s(o.name) ?? (display ? display.split(",")[0].trim() : null) ?? street;
  if (!name) return null;
  return {
    name,
    address,
    city,
    lat,
    lng,
    category: categoryFromOsm(s(o.category) ?? s(o.class), s(o.type)),
  };
}

/** Résultat Photon (GeoJSON Feature) → suggestion */
export function normalizePhoton(f: unknown): PlaceSuggestion | null {
  if (!f || typeof f !== "object") return null;
  const o = f as Dict;
  const p = (o.properties && typeof o.properties === "object" ? o.properties : {}) as Dict;
  const g = (o.geometry && typeof o.geometry === "object" ? o.geometry : {}) as Dict;
  const coords = Array.isArray(g.coordinates) ? g.coordinates : [];
  const lng = num(coords[0]);
  const lat = num(coords[1]);
  if (lat === null || lng === null) return null;
  const city = s(p.city) ?? s(p.town) ?? s(p.village) ?? s(p.locality) ?? null;
  const street = join([s(p.housenumber), s(p.street)]);
  const address = join([street, join([s(p.postcode), city])], ", ");
  const name = s(p.name) ?? street;
  if (!name) return null;
  return { name, address, city, lat, lng, category: categoryFromOsm(s(p.osm_key), s(p.osm_value)) };
}

/** Distance approximative en km */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Enlève les doublons (même nom à moins de 100 m) */
export function dedupeSuggestions(list: PlaceSuggestion[]): PlaceSuggestion[] {
  const out: PlaceSuggestion[] = [];
  for (const r of list) {
    if (!out.some((o) => o.name.toLowerCase() === r.name.toLowerCase() && distanceKm(o, r) < 0.1)) out.push(r);
  }
  return out;
}
