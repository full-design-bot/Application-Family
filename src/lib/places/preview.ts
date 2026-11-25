import "server-only";

// Analyse complète d'une saisie : lien Google Maps, Instagram, autre lien, @compte ou nom.

import { guessCategory } from "./categories";
import { searchPlaces, reverseGeocode } from "./geocode";
import { distanceKm } from "./geo";
import { cityFromAddress, cleanText, draftFromHtml, extractMeta, isPlatformHost, stripTracking } from "./html";
import {
  classifyInput,
  findGoogleMapsUrlInHtml,
  isGoogleMapsUrl,
  isGoogleShortUrl,
  isAppleMapsUrl,
  isInstagramUrl,
  nameFromUrl,
  parseAppleMapsUrl,
  parseGoogleMapsUrl,
  parseInstagramUrl,
} from "./input";
import { nameFromHandle, parseInstagramEmbed, parseInstagramPage, type InstagramInfo } from "./instagram";
import { safeFetch, SafeFetchError } from "./net";
import { emptyDraft, type PlaceDraft, type PlaceSuggestion, type PreviewResponse } from "./types";

export interface PreviewHints {
  /** Titre de la page partagée (Raccourci iOS) */
  title?: string | null;
  /** Texte partagé en plus du lien */
  text?: string | null;
}

function firstLine(s: string | null | undefined): string | null {
  const line = (s ?? "").split(/\n/).map((l) => l.trim()).find(Boolean);
  return line ? cleanText(line, 120) : null;
}

function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!a || !b) return false;
  const x = n(a);
  const y = n(b);
  return x.length > 2 && y.length > 2 && (x.includes(y) || y.includes(x));
}

async function suggestionsFor(draft: PlaceDraft): Promise<PlaceSuggestion[]> {
  if (!draft.name || (draft.lat !== null && draft.lng !== null)) return [];
  const q = [draft.name, draft.city].filter(Boolean).join(" ");
  try {
    return await searchPlaces(q);
  } catch {
    return [];
  }
}

/** Complète adresse / ville / catégorie à partir des coordonnées. */
async function enrichFromCoords(draft: PlaceDraft): Promise<void> {
  if (draft.lat === null || draft.lng === null) return;
  if (draft.address && draft.city) return;
  const r = await reverseGeocode(draft.lat, draft.lng);
  if (!r || distanceKm(r, { lat: draft.lat, lng: draft.lng }) > 1) return;
  if (!draft.address) draft.address = r.address;
  if (!draft.city) draft.city = r.city;
  if (!draft.name) draft.name = r.name;
  if (r.category && sameName(r.name, draft.name)) draft.category = r.category;
}

// ---------------------------------------------------------------- Google Maps

async function fromGoogleMaps(url: string, hints: PreviewHints, aroundText: string | null): Promise<PreviewResponse> {
  const draft = emptyDraft();
  let warning: string | null = null;
  let longUrl = url;

  if (isGoogleShortUrl(url)) {
    try {
      const res = await safeFetch(url, {
        stopRedirectWhen: (next) => (isGoogleMapsUrl(next) && !isGoogleShortUrl(next)) || next.hostname.startsWith("consent."),
      });
      longUrl = res.url;
      if (isGoogleShortUrl(longUrl) && res.body) {
        // Le lien court a renvoyé une page au lieu d'une redirection
        longUrl = findGoogleMapsUrlInHtml(res.body) ?? extractMeta(res.body)["og:url"] ?? longUrl;
      }
    } catch {
      warning = "Google Maps n'a pas répondu : vérifie les infos.";
    }
  }

  const info = parseGoogleMapsUrl(longUrl);
  draft.name = info.name ?? firstLine(aroundText) ?? firstLine(hints.title) ?? null;
  draft.address = info.address;
  draft.lat = info.lat;
  draft.lng = info.lng;
  draft.url = url;
  draft.category = guessCategory(draft.name, aroundText) ?? "resto";

  if (draft.lat !== null) {
    await enrichFromCoords(draft);
  } else if (draft.address && !draft.city) {
    draft.city = cityFromAddress(draft.address) ?? cleanText(draft.address.split(",").pop()?.replace(/^\s*\d{5}\s*/, ""), 80);
  }
  if (!draft.name && !draft.address && draft.lat === null) warning = "Impossible de lire ce lien Google Maps. Tape plutôt le nom du lieu.";
  return { kind: "gmaps", draft, suggestions: await suggestionsFor(draft), warning };
}

// ---------------------------------------------------------------- Instagram

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await safeFetch(url, { timeoutMs: 6000, maxBytes: 900_000 });
    // Instagram renvoie vers la page de connexion quand il bloque
    if (res.status !== 200 || /\/accounts\/login/.test(res.url)) return null;
    return res.body;
  } catch {
    return null;
  }
}

async function fromInstagram(account: string | null, shortcode: string | null, url: string | null): Promise<PreviewResponse> {
  const draft = emptyDraft();
  const info: InstagramInfo = { account, fullName: null, caption: null };

  if (shortcode) {
    const page = await tryFetch(`https://www.instagram.com/p/${encodeURIComponent(shortcode)}/`);
    if (page) {
      const p = parseInstagramPage(page);
      info.account ??= p.account;
      info.fullName ??= p.fullName;
      info.caption ??= p.caption;
    }
    if (!info.account || !info.caption) {
      const embed = await tryFetch(`https://www.instagram.com/p/${encodeURIComponent(shortcode)}/embed/captioned/`);
      if (embed) {
        const e = parseInstagramEmbed(embed);
        info.account ??= e.account;
        info.caption ??= e.caption;
      }
    }
  }
  if (info.account && !info.fullName) {
    const embed = await tryFetch(`https://www.instagram.com/${encodeURIComponent(info.account)}/embed/`);
    if (embed) {
      const e = parseInstagramEmbed(embed);
      if (!e.account || e.account === info.account) info.fullName = e.fullName;
    }
  }

  draft.instagram = info.account;
  draft.name = info.fullName ?? (info.account ? nameFromHandle(info.account) : null);
  draft.description = info.caption;
  draft.url = shortcode && url ? url.split("?")[0] : null;
  draft.category = guessCategory(info.fullName, info.account, info.caption) ?? "resto";

  const warning = !info.account
    ? "Instagram n'a rien voulu dire sur ce lien : complète le nom à la main."
    : !info.fullName
      ? "Instagram ne donne que le nom du compte : vérifie le nom du lieu."
      : null;
  return { kind: "instagram", draft, suggestions: await suggestionsFor(draft), warning };
}

// ---------------------------------------------------------------- Autre lien

/** Lien Plans : tout est dans l'adresse (on complète avec OpenStreetMap). */
async function fromAppleMaps(url: string, hints: PreviewHints, aroundText: string | null): Promise<PreviewResponse> {
  const info = parseAppleMapsUrl(url);
  const draft = emptyDraft();
  draft.name = info.name ?? firstLine(aroundText) ?? firstLine(hints.title);
  draft.address = info.address;
  draft.city = cityFromAddress(info.address);
  draft.lat = info.lat;
  draft.lng = info.lng;
  draft.url = url;
  draft.category = guessCategory(draft.name, aroundText) ?? "resto";
  await enrichFromCoords(draft);
  return { kind: "url", draft, suggestions: await suggestionsFor(draft), warning: null };
}

async function fromWebsite(url: string, hints: PreviewHints, aroundText: string | null): Promise<PreviewResponse> {
  let draft = emptyDraft();
  let warning: string | null = null;
  if (isAppleMapsUrl(url) && (parseAppleMapsUrl(url).name || parseAppleMapsUrl(url).lat !== null)) {
    return fromAppleMaps(url, hints, aroundText);
  }
  try {
    const res = await safeFetch(url);
    // Lien court Plans (maps.apple/p/…) qui redirige vers une adresse lisible
    if (isAppleMapsUrl(res.url) && res.url !== url) {
      const info = parseAppleMapsUrl(res.url);
      if (info.name || info.lat !== null) return fromAppleMaps(res.url, hints, aroundText);
    }
    // Lien qui mène en fait vers Google Maps ou Instagram
    if (isGoogleMapsUrl(res.url) && !isGoogleMapsUrl(url)) return fromGoogleMaps(res.url, hints, aroundText);
    if (isInstagramUrl(res.url)) {
      const ig = parseInstagramUrl(res.url);
      if (ig && (ig.account || ig.shortcode)) return fromInstagram(ig.account, ig.shortcode, res.url);
    }
    // 202 & co. = page anti-robots : inutilisable
    if ((res.status === 200 || res.status === 203) && res.body) {
      draft = draftFromHtml(res.body, res.url);
      // On garde le lien tel que partagé s'il vient d'une plateforme de réservation / d'avis
      if (isPlatformHost(url)) draft.url = stripTracking(url);
      if (!draft.name) warning = "Je n'ai pas trouvé le nom sur cette page : complète les infos.";
    } else {
      warning = "Le site n'a pas voulu se laisser lire : complète les infos.";
    }
  } catch (e) {
    warning =
      e instanceof SafeFetchError && e.code === "blocked"
        ? "Ce lien n'est pas autorisé."
        : e instanceof SafeFetchError && e.code === "timeout"
          ? "Le site met trop de temps à répondre : complète les infos."
          : "Impossible d'ouvrir ce lien : complète les infos.";
  }
  const slug = nameFromUrl(url);
  draft.url ??= stripTracking(url);
  draft.name ??= slug.name ?? firstLine(hints.title) ?? firstLine(aroundText);
  draft.city ??= slug.city;
  if (draft.category === "resto" && !draft.description) {
    draft.category = guessCategory(draft.name, slug.hint, hints.title, aroundText) ?? "resto";
  }
  if (draft.lat !== null) await enrichFromCoords(draft);
  return { kind: "url", draft, suggestions: await suggestionsFor(draft), warning };
}

// ---------------------------------------------------------------- Texte libre

async function fromText(text: string): Promise<PreviewResponse> {
  const draft = emptyDraft();
  draft.name = cleanText(text, 120);
  const suggestions = await suggestionsFor(draft);
  const top = suggestions[0];
  draft.category = guessCategory(text) ?? (top?.category && sameName(top.name, text) ? top.category : null) ?? "resto";
  return { kind: "text", draft, suggestions, warning: null };
}

export async function analyzeInput(input: string, hints: PreviewHints = {}): Promise<PreviewResponse> {
  const c = classifyInput(input);
  switch (c.kind) {
    case "gmaps":
      return fromGoogleMaps(c.url, hints, c.text ?? hints.text ?? null);
    case "instagram":
      return fromInstagram(c.account, c.shortcode, c.url);
    case "url":
      return fromWebsite(c.url, hints, c.text ?? hints.text ?? null);
    case "text":
      return fromText(c.text);
    default:
      return { kind: "empty", draft: emptyDraft(), suggestions: [], warning: "Colle un lien ou tape un nom." };
  }
}

