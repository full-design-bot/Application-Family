// Lecture d'une page web : balises Open Graph, <title>, JSON-LD schema.org.
// Logique pure (sans réseau), testée dans html.test.ts.

import { categoryFromSchemaTypes, guessCategory } from "./categories";
import { nameFromUrl, parseInstagramUrl, safeParseUrl } from "./input";
import { emptyDraft, type PlaceDraft } from "./types";

// ---------------------------------------------------------------- Entités HTML

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê",
  agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", ugrave: "ù", icirc: "î", iuml: "ï",
  euml: "ë", oelig: "œ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", ndash: "–",
  mdash: "—", middot: "·", laquo: "«", raquo: "»", euro: "€", bull: "•", copy: "©", reg: "®",
  Eacute: "É", Egrave: "È", Agrave: "À", Ccedil: "Ç",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[code] ?? NAMED_ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function cleanText(s: string | null | undefined, max = 500): string | null {
  if (!s) return null;
  const t = decodeEntities(String(s))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

// ---------------------------------------------------------------- Balises meta

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

/** Toutes les balises <meta> : clé (property, name ou itemprop, en minuscules) → contenu (premier gagnant). */
export function extractMeta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const head = html.slice(0, 600_000);
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop"))?.toLowerCase();
    const content = attr(tag, "content");
    if (!key || content === null) continue;
    if (!(key in out)) out[key] = decodeEntities(content).trim();
  }
  return out;
}

export function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? cleanText(m[1], 300) : null;
}

/** Lien canonique de la page */
export function extractCanonical(html: string): string | null {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if ((attr(m[0], "rel") ?? "").toLowerCase() === "canonical") return attr(m[0], "href");
  }
  return null;
}

// ---------------------------------------------------------------- JSON-LD

export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].trim().replace(/^<!--/, "").replace(/-->$/, "").trim();
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Certains sites mettent des retours à la ligne non échappés : on tente une version nettoyée.
      try {
        out.push(JSON.parse(raw.replace(/[\u0000-\u001f]+/g, " ")));
      } catch {
        /* JSON invalide : ignoré */
      }
    }
  }
  return out;
}

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Aplati un JSON-LD (tableaux, @graph) en liste de nœuds. */
function flattenNodes(data: unknown, acc: Json[] = [], depth = 0): Json[] {
  if (depth > 6) return acc;
  if (Array.isArray(data)) {
    data.forEach((d) => flattenNodes(d, acc, depth + 1));
  } else if (isObj(data)) {
    acc.push(data);
    if (data["@graph"]) flattenNodes(data["@graph"], acc, depth + 1);
    // Lieu d'un événement
    if (isObj(data.location)) flattenNodes(data.location, acc, depth + 1);
  }
  return acc;
}

function typesOf(node: Json): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

const BUSINESS_TYPES = new Set(
  [
    "restaurant", "foodestablishment", "localbusiness", "barorpub", "cafeorcoffeeshop", "bakery", "winery",
    "nightclub", "fastfoodrestaurant", "icecreamshop", "brewery", "distillery", "lodgingbusiness", "hotel",
    "motel", "bedandbreakfast", "campground", "resort", "hostel", "vacationrental", "touristattraction",
    "museum", "park", "zoo", "aquarium", "amusementpark", "playground", "movietheater", "performingartstheater",
    "musicvenue", "eventvenue", "place", "landmarksorhistoricalbuildings", "sportsactivitylocation",
    "entertainmentbusiness", "beach", "event", "theaterevent", "musicevent", "festival", "artgallery",
    "childcare", "bowlingalley", "touristdestination",
  ],
);

// Plus le score est haut, plus le nœud est intéressant
function businessScore(node: Json): number {
  const types = typesOf(node).map((t) => t.toLowerCase());
  if (!types.some((t) => BUSINESS_TYPES.has(t))) return 0;
  let score = 1;
  if (types.some((t) => t !== "place" && t !== "localbusiness")) score += 2;
  if (node.address) score += 1;
  if (node.geo) score += 1;
  if (node.name) score += 1;
  return score;
}

export interface BusinessInfo {
  name: string | null;
  types: string[];
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  priceRange: string | null;
  cuisine: string | null;
  image: string | null;
  description: string | null;
  url: string | null;
  sameAs: string[];
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

function firstImage(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = firstImage(x);
      if (r) return r;
    }
    return null;
  }
  if (isObj(v)) return str(v.url) ?? str(v.contentUrl) ?? null;
  return null;
}

function parseAddress(v: unknown): { address: string | null; city: string | null } {
  if (typeof v === "string") return { address: cleanText(v, 200), city: cityFromAddress(v) };
  if (Array.isArray(v)) return v.length ? parseAddress(v[0]) : { address: null, city: null };
  if (!isObj(v)) return { address: null, city: null };
  const street = str(v.streetAddress);
  const postal = str(v.postalCode);
  const city = str(v.addressLocality);
  const locality = [postal, city].filter(Boolean).join(" ");
  const address = [street, locality].filter(Boolean).join(", ");
  return { address: cleanText(address, 200), city: city ? cleanText(city, 80) : address ? cityFromAddress(address) : null };
}

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function findBusiness(jsonld: unknown[]): BusinessInfo | null {
  const nodes = flattenNodes(jsonld);
  let best: Json | null = null;
  let bestScore = 0;
  for (const n of nodes) {
    const s = businessScore(n);
    if (s > bestScore) {
      best = n;
      bestScore = s;
    }
  }
  if (!best) return null;
  const { address, city } = parseAddress(best.address);
  const geo = isObj(best.geo) ? best.geo : Array.isArray(best.geo) && isObj(best.geo[0]) ? (best.geo[0] as Json) : null;
  let lat = geo ? toNumber(geo.latitude) : null;
  let lng = geo ? toNumber(geo.longitude) : null;
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    lat = null;
    lng = null;
  }
  const cuisine = Array.isArray(best.servesCuisine)
    ? best.servesCuisine.filter((x): x is string => typeof x === "string").join(", ")
    : str(best.servesCuisine);
  const sameAs = Array.isArray(best.sameAs)
    ? best.sameAs.filter((x): x is string => typeof x === "string")
    : typeof best.sameAs === "string"
      ? [best.sameAs]
      : [];
  return {
    name: cleanText(str(best.name), 120),
    types: typesOf(best),
    address,
    city,
    lat,
    lng,
    priceRange: str(best.priceRange),
    cuisine: cuisine || null,
    image: firstImage(best.image) ?? firstImage(best.photo) ?? firstImage(best.logo),
    description: cleanText(str(best.description), 500),
    url: str(best.url),
    sameAs,
  };
}

// ---------------------------------------------------------------- Prix, ville, Instagram

/** "€€", "$$$", "20-30 €", "Moins de 15 €", "Prix moyen 45 €" → 1..4 */
export function parsePriceLevel(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = s.trim();
  const symbols = t.match(/^[€$£]{1,4}(?:\s*[-–]\s*[€$£]{1,4})?$/);
  if (symbols) {
    const parts = t.split(/[-–]/).map((p) => p.replace(/\s/g, "").length);
    return Math.min(4, Math.max(1, Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)));
  }
  const nums = [...t.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) => parseFloat(m[1].replace(",", ".")));
  if (nums.length === 0) return null;
  const avg = nums.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(2, nums.length);
  if (avg < 15) return 1;
  if (avg < 35) return 2;
  if (avg < 70) return 3;
  return 4;
}

/** Ville d'une adresse française : "… 33000 Bordeaux" → "Bordeaux" */
export function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = address.match(/\b\d{5}\s+([A-Za-zÀ-ÿ'’\- ]+?)(?:\s*,|\s*$|\s+France\b)/);
  if (m) return m[1].trim();
  return null;
}

/** Premier lien vers un compte Instagram dans la page (pied de page du site du resto…). */
export function findInstagramAccount(html: string, sameAs: string[] = []): string | null {
  for (const s of sameAs) {
    const ig = parseInstagramUrl(s);
    if (ig?.account) return ig.account;
  }
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/[a-z0-9._]{1,30}\/?(?=["'?#\s<])/gi)) {
    const ig = parseInstagramUrl(m[0]);
    if (ig?.account) return ig.account;
  }
  return null;
}

// ---------------------------------------------------------------- Titre → nom

// Sites "plateformes" : leur nom n'est pas celui du lieu.
const PLATFORMS = /^(thefork|lafourchette|tripadvisor|google|google maps|facebook|instagram|booking\.com|booking|airbnb|yelp|petit futé|le petit futé|michelin|guide michelin|gault&millau|tiktok|youtube|x|twitter|linktree|ubereats|uber eats|deliveroo|just eat|zenchef|resy|opentable)$/i;

const GENERIC_SEGMENT = /^(accueil|home|homepage|bienvenue|welcome|site officiel|official site|page d'accueil|menu|la carte|réservation|reservation|réserver|contact|index)$/i;

export function isPlatformName(s: string | null | undefined): boolean {
  return !!s && PLATFORMS.test(s.trim());
}

/** "Accueil - Chez Janou | Restaurant à Bordeaux" → "Chez Janou" (en ignorant le nom du site plateforme). */
export function nameFromTitle(title: string | null, siteName: string | null): string | null {
  if (!title) return null;
  const segments = title
    .split(/\s+[|\-–—·•:]\s+|\s*[|·•]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const site = siteName?.trim().toLowerCase();
  // Le nom du site (non plateforme) présent dans le titre est presque toujours le nom du lieu
  if (site && !isPlatformName(siteName) && segments.some((s) => s.toLowerCase() === site)) return siteName!.trim();
  const useful = segments.filter((s) => !GENERIC_SEGMENT.test(s) && !isPlatformName(s) && s.toLowerCase() !== site);
  let name = useful[0] ?? null;
  if (!name) return siteName && !isPlatformName(siteName) ? siteName : null;
  // TheFork : "Chez Janou à Bordeaux" → "Chez Janou"
  if (isPlatformName(siteName)) name = name.replace(/\s+(?:à|in)\s+[A-ZÀ-Ý][\p{L}'’\- ]+$/u, "").trim();
  return name.length > 120 ? name.slice(0, 120) : name || null;
}

const PLATFORM_HOSTS =
  /(^|\.)(thefork|lafourchette|tripadvisor|yelp|michelin|gaultmillau|petitfute|timeout|google|facebook|instagram|booking|airbnb|abritel|tiktok|youtube|ubereats|deliveroo|justeat|zenchef|opentable|resy|linktr|sortiraparis|bordeaux-tourisme|lefooding|routard|onlyfood|tfrcdn)\./i;

export function isPlatformHost(u: string): boolean {
  const host = safeParseUrl(u)?.hostname ?? "";
  return PLATFORM_HOSTS.test(host);
}

/** Retire les paramètres de suivi (utm_…, fbclid, igsh…) d'un lien. */
export function stripTracking(u: string): string {
  const url = safeParseUrl(u);
  if (!url) return u;
  for (const k of [...url.searchParams.keys()]) {
    if (/^(utm_\w+|fbclid|gclid|dclid|msclkid|igsh|igshid|si|mc_cid|mc_eid|_ga|ref|ref_src)$/i.test(k)) url.searchParams.delete(k);
  }
  url.hash = "";
  return url.toString();
}

function absoluteUrl(u: string | null | undefined, base: string): string | null {
  if (!u) return null;
  try {
    const url = new URL(u, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Images qui expirent ou ne s'affichent pas hors de leur site : on ne les garde pas. */
export function isEphemeralImage(u: string | null | undefined): boolean {
  if (!u) return true;
  return /(cdninstagram\.com|fbcdn\.net|fbsbx\.com|lookaside\.|maps\.google\.[a-z.]+\/maps\/api\/staticmap|googleusercontent\.com\/.*=s\d+-p-k-no)/i.test(u);
}

// ---------------------------------------------------------------- Brouillon complet

/**
 * Construit un brouillon de lieu à partir du HTML d'une page.
 * `pageUrl` = adresse finale (après redirections).
 */
export function draftFromHtml(html: string, pageUrl: string): PlaceDraft {
  const draft = emptyDraft();
  const meta = extractMeta(html);
  const title = extractTitle(html);
  const business = findBusiness(extractJsonLd(html));
  const slug = nameFromUrl(pageUrl);

  const siteName = meta["og:site_name"] ?? meta["application-name"] ?? null;
  const ogTitle = meta["og:title"] ?? meta["twitter:title"] ?? null;
  const description = meta["og:description"] ?? meta["description"] ?? meta["twitter:description"] ?? null;

  draft.name =
    business?.name ??
    nameFromTitle(ogTitle, siteName) ??
    nameFromTitle(title, siteName) ??
    slug.name ??
    (siteName && !isPlatformName(siteName) ? siteName : null);
  if (draft.name && slug.name && isPlatformName(siteName) && draft.name.length > 60) draft.name = slug.name;

  draft.url = stripTracking(pageUrl);

  draft.description = business?.description ?? cleanText(description, 500);

  const image = absoluteUrl(business?.image ?? meta["og:image"] ?? meta["og:image:url"] ?? meta["twitter:image"] ?? meta["twitter:image:src"], pageUrl);
  draft.image_url = image && !isEphemeralImage(image) ? image : null;

  // Adresse : JSON-LD, sinon balises OG "place"/"business"
  draft.address =
    business?.address ??
    cleanText(
      [meta["business:contact_data:street_address"] ?? meta["og:street-address"], [meta["business:contact_data:postal_code"] ?? meta["og:postal-code"], meta["business:contact_data:locality"] ?? meta["og:locality"]].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", "),
      200,
    );
  draft.city = business?.city ?? meta["business:contact_data:locality"] ?? meta["og:locality"] ?? cityFromAddress(draft.address) ?? slug.city;

  const lat = business?.lat ?? toNumber(meta["place:location:latitude"] ?? meta["og:latitude"] ?? meta["geo.position"]?.split(/[;,]/)[0]);
  const lng = business?.lng ?? toNumber(meta["place:location:longitude"] ?? meta["og:longitude"] ?? meta["geo.position"]?.split(/[;,]/)[1]);
  if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) {
    draft.lat = lat;
    draft.lng = lng;
  }

  draft.price_level = parsePriceLevel(business?.priceRange);
  // Sur les guides / plateformes, le lien Instagram du pied de page est celui de la plateforme.
  draft.instagram = isPlatformHost(pageUrl)
    ? findInstagramAccount("", business?.sameAs ?? [])
    : findInstagramAccount(html, business?.sameAs ?? []);

  draft.category =
    (business ? categoryFromSchemaTypes(business.types) : null) ??
    guessCategory(draft.name, slug.hint, business?.cuisine, ogTitle ?? title, draft.description, siteName, meta["og:type"]) ??
    "resto";

  return draft;
}
