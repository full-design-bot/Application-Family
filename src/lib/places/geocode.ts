import "server-only";

// Recherche de lieux par nom (OpenStreetMap Nominatim, repli sur Photon) et adresse d'un point.

import { BORDEAUX, BORDEAUX_VIEWBOX, dedupeSuggestions, normalizeNominatim, normalizePhoton } from "./geo";
import type { PlaceSuggestion } from "./types";

const UA = "NoesiaFamily/1.0";
const TIMEOUT = 6000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "fr" },
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchNominatim(q: string, limit = 6): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: String(limit),
    countrycodes: "fr",
    "accept-language": "fr",
    viewbox: BORDEAUX_VIEWBOX, // préférence pour Bordeaux, sans exclure le reste (bounded=0)
    q,
  });
  const data = await getJson(`https://nominatim.openstreetmap.org/search?${params}`);
  return (Array.isArray(data) ? data : []).map(normalizeNominatim).filter((x): x is PlaceSuggestion => x !== null);
}

export async function searchPhoton(q: string, limit = 10): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({ q, lang: "fr", lat: String(BORDEAUX.lat), lon: String(BORDEAUX.lng), limit: String(limit) });
  const data = (await getJson(`https://photon.komoot.io/api/?${params}`)) as { features?: unknown[] };
  return (data?.features ?? [])
    // Comme pour Nominatim (countrycodes=fr) : la France uniquement
    .filter((f) => (f as { properties?: { countrycode?: string } })?.properties?.countrycode?.toUpperCase() === "FR")
    .map(normalizePhoton)
    .filter((x): x is PlaceSuggestion => x !== null);
}

/** Recherche par nom : Nominatim d'abord, Photon si erreur ou aucun résultat. */
export async function searchPlaces(q: string): Promise<PlaceSuggestion[]> {
  const query = q.trim().slice(0, 150);
  if (query.length < 2) return [];
  let results: PlaceSuggestion[] = [];
  try {
    results = await searchNominatim(query);
  } catch {
    results = [];
  }
  if (results.length === 0) {
    try {
      results = await searchPhoton(query);
    } catch {
      results = [];
    }
  }
  return dedupeSuggestions(results).slice(0, 6);
}

/** Adresse d'un point (pour compléter un lien Google Maps qui ne donne que nom + coordonnées). */
export async function reverseGeocode(lat: number, lng: number): Promise<PlaceSuggestion | null> {
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    "accept-language": "fr",
    zoom: "18",
    lat: String(lat),
    lon: String(lng),
  });
  try {
    const data = await getJson(`https://nominatim.openstreetmap.org/reverse?${params}`);
    return normalizeNominatim(data);
  } catch {
    return null;
  }
}
