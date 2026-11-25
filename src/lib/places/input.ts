// Analyse de ce que l'utilisateur a collé : lien Google Maps, Instagram, autre lien ou simple nom.
// Logique pure (sans réseau), testée dans input.test.ts.

export type ClassifiedInput =
  | { kind: "gmaps"; url: string; text: string | null }
  | { kind: "instagram"; account: string | null; shortcode: string | null; url: string | null }
  | { kind: "url"; url: string; text: string | null }
  | { kind: "text"; text: string }
  | { kind: "empty" };

/** Premier lien http(s) trouvé dans un texte (ex. « Chez Janou https://maps.app.goo.gl/xyz »). */
export function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"'«»]+/i);
  if (!m) {
    // Lien sans schéma : "instagram.com/chezjanou", "www.chezjanou.fr", "maps.app.goo.gl/xyz"
    const bare = text.match(/(?:^|\s)((?:www\.|maps\.app\.goo\.gl\/|goo\.gl\/maps\/|(?:www\.)?instagram\.com\/)[^\s<>"'«»]+)/i);
    if (!bare) return null;
    return cleanUrlTail("https://" + bare[1]);
  }
  return cleanUrlTail(m[0]);
}

function cleanUrlTail(u: string): string {
  // Ponctuation collée à la fin d'une phrase
  return u.replace(/[).,;!?»]+$/, "");
}

/** Texte autour du lien (souvent le nom du lieu quand on partage depuis une app). */
function textAround(input: string, url: string): string | null {
  const rest = input.replace(url, " ").replace(/\s+/g, " ").trim();
  return rest.length > 0 ? rest : null;
}

export function safeParseUrl(u: string): URL | null {
  try {
    const url = new URL(u);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

const GOOGLE_HOST = /(^|\.)google\.[a-z.]{2,6}$/i;

export function isGoogleMapsUrl(u: string | URL): boolean {
  const url = typeof u === "string" ? safeParseUrl(u) : u;
  if (!url) return false;
  const h = url.hostname.toLowerCase();
  if (h === "maps.app.goo.gl" || (h === "goo.gl" && url.pathname.startsWith("/maps"))) return true;
  if (h === "g.co" && url.pathname.startsWith("/kgs")) return true;
  if (h === "share.google") return true;
  if (/^maps\.google\./.test(h)) return true;
  if (GOOGLE_HOST.test(h) && (url.pathname.startsWith("/maps") || (url.pathname === "/search" && url.searchParams.has("q")))) return true;
  return false;
}

/** Lien court Google à déplier (redirection). */
export function isGoogleShortUrl(u: string | URL): boolean {
  const url = typeof u === "string" ? safeParseUrl(u) : u;
  if (!url) return false;
  const h = url.hostname.toLowerCase();
  return h === "maps.app.goo.gl" || h === "goo.gl" || h === "g.co" || h === "share.google";
}

export function isInstagramUrl(u: string | URL): boolean {
  const url = typeof u === "string" ? safeParseUrl(u) : u;
  if (!url) return false;
  const h = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  return h === "instagram.com" || h === "instagr.am";
}

const IG_RESERVED = new Set([
  "p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct", "about", "legal",
  "developer", "web", "s", "share", "challenge", "emails", "privacy", "help", "api", "oauth",
]);
const IG_HANDLE = /^[a-z0-9._]{1,30}$/i;

export function isValidInstagramHandle(h: string): boolean {
  return IG_HANDLE.test(h) && !IG_RESERVED.has(h.toLowerCase()) && !/^\.|\.$|\.\./.test(h);
}

/** instagram.com/<compte>, /<compte>/p/<code>, /p/<code>, /reel/<code>, /stories/<compte>/… */
export function parseInstagramUrl(u: string | URL): { account: string | null; shortcode: string | null } | null {
  const url = typeof u === "string" ? safeParseUrl(u) : u;
  if (!url || !isInstagramUrl(url)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { account: null, shortcode: null };
  const first = parts[0].toLowerCase();
  if (first === "p" || first === "reel" || first === "reels" || first === "tv") {
    return { account: null, shortcode: parts[1] ?? null };
  }
  if (first === "stories") {
    const acc = parts[1];
    return { account: acc && isValidInstagramHandle(acc) ? acc.toLowerCase() : null, shortcode: null };
  }
  if (isValidInstagramHandle(parts[0])) {
    const second = (parts[1] ?? "").toLowerCase();
    const shortcode = second === "p" || second === "reel" || second === "tv" ? parts[2] ?? null : null;
    return { account: parts[0].toLowerCase(), shortcode };
  }
  return { account: null, shortcode: null };
}

/** "@chezjanou", "insta chezjanou", "chezjanou sur insta", "instagram: @chezjanou" */
export function parseInstagramHandle(text: string): string | null {
  const t = text.trim();
  const patterns = [
    /^@([a-z0-9._]{1,30})$/i,
    /^(?:insta(?:gram)?)\s*[:\-–]?\s*@?([a-z0-9._]{1,30})$/i,
    /^@?([a-z0-9._]{1,30})\s+(?:(?:sur|on|en)\s+)?(?:insta(?:gram)?|ig)$/i,
    /^(?:ig)\s*[:\-–]\s*@?([a-z0-9._]{1,30})$/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && isValidInstagramHandle(m[1])) return m[1].toLowerCase();
  }
  return null;
}

export function classifyInput(raw: string | null | undefined): ClassifiedInput {
  const input = (raw ?? "").trim();
  if (!input) return { kind: "empty" };

  const handle = parseInstagramHandle(input);
  if (handle) return { kind: "instagram", account: handle, shortcode: null, url: null };

  const urlStr = extractFirstUrl(input);
  const url = urlStr ? safeParseUrl(urlStr) : null;
  if (url && urlStr) {
    const text = textAround(input, urlStr);
    if (isGoogleMapsUrl(url)) return { kind: "gmaps", url: url.toString(), text };
    if (isInstagramUrl(url)) {
      const ig = parseInstagramUrl(url)!;
      return { kind: "instagram", account: ig.account, shortcode: ig.shortcode, url: url.toString() };
    }
    return { kind: "url", url: url.toString(), text };
  }
  return { kind: "text", text: input.replace(/\s+/g, " ").slice(0, 200) };
}

// ---------------------------------------------------------------- Google Maps

export interface GoogleMapsInfo {
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

function decodePlus(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " ")).replace(/\s+/g, " ").trim();
  } catch {
    return s.replace(/\+/g, " ").trim();
  }
}

function validCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

const COORDS_TEXT = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** Sépare "Chez Janou, 12 Rue X, 33000 Bordeaux" en nom + adresse. */
export function splitNameAddress(text: string): { name: string | null; address: string | null } {
  const t = text.trim();
  if (!t) return { name: null, address: null };
  const idx = t.indexOf(",");
  if (idx === -1) return /^\d/.test(t) ? { name: null, address: t } : { name: t, address: null };
  const first = t.slice(0, idx).trim();
  const rest = t.slice(idx + 1).trim();
  // Si ça commence par un numéro, c'est une adresse et non un nom.
  if (/^\d/.test(first)) return { name: null, address: t };
  return { name: first, address: rest || null };
}

/**
 * Lit un lien Google Maps "long" :
 * /maps/place/<Nom>/@lat,lng,17z/data=…!3d<lat>!4d<lng>, ?q=…, ?query=…, ?ll=…, /maps/search/<texte>/
 */
export function parseGoogleMapsUrl(u: string | URL): GoogleMapsInfo {
  const out: GoogleMapsInfo = { name: null, address: null, lat: null, lng: null };
  const url = typeof u === "string" ? safeParseUrl(u) : u;
  if (!url) return out;

  // Page de consentement : la vraie adresse est dans "continue"
  if (url.hostname.startsWith("consent.")) {
    const cont = url.searchParams.get("continue");
    return cont ? parseGoogleMapsUrl(cont) : out;
  }

  const path = url.pathname;
  const full = decodeURIComponentSafe(path) + "?" + url.search;

  // Coordonnées exactes du lieu (!3d…!4d…)
  const exact = full.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (exact) {
    const lat = Number(exact[1]);
    const lng = Number(exact[2]);
    if (validCoords(lat, lng)) {
      out.lat = lat;
      out.lng = lng;
    }
  }
  // Centre de la vue (@lat,lng,zoom)
  if (out.lat === null) {
    const at = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) {
      const lat = Number(at[1]);
      const lng = Number(at[2]);
      if (validCoords(lat, lng)) {
        out.lat = lat;
        out.lng = lng;
      }
    }
  }

  // Nom dans /place/<Nom>/ ou /search/<texte>/
  const place = path.match(/\/maps\/(?:place|search)\/([^/@]+)/);
  if (place) {
    const text = decodePlus(place[1]);
    const coordsInText = text.match(COORDS_TEXT);
    if (coordsInText) {
      if (out.lat === null && validCoords(Number(coordsInText[1]), Number(coordsInText[2]))) {
        out.lat = Number(coordsInText[1]);
        out.lng = Number(coordsInText[2]);
      }
    } else {
      Object.assign(out, pickDefined(splitNameAddress(text)));
    }
  }

  // Paramètres q / query / destination / ll
  for (const key of ["q", "query", "destination", "daddr"]) {
    const v = url.searchParams.get(key);
    if (!v) continue;
    const coordsInText = v.match(COORDS_TEXT);
    if (coordsInText) {
      if (out.lat === null && validCoords(Number(coordsInText[1]), Number(coordsInText[2]))) {
        out.lat = Number(coordsInText[1]);
        out.lng = Number(coordsInText[2]);
      }
    } else if (!out.name && !out.address) {
      Object.assign(out, pickDefined(splitNameAddress(v.replace(/\+/g, " ").replace(/\s+/g, " "))));
    }
    break;
  }
  const ll = url.searchParams.get("ll") ?? url.searchParams.get("center");
  if (ll && out.lat === null) {
    const m = ll.match(COORDS_TEXT);
    if (m && validCoords(Number(m[1]), Number(m[2]))) {
      out.lat = Number(m[1]);
      out.lng = Number(m[2]);
    }
  }
  return out;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function pickDefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

/** Cherche un lien Google Maps long dans une page HTML (cas où le lien court renvoie une page au lieu d'une redirection). */
export function findGoogleMapsUrlInHtml(html: string): string | null {
  const m = html.match(/https?:\/\/(?:www\.)?google\.[a-z.]+\/maps\/[^"'\s<>\\]+/i) ?? html.match(/https?:\/\/maps\.google\.[a-z.]+\/[^"'\s<>\\]+/i);
  return m ? m[0].replace(/&amp;/g, "&") : null;
}

// ---------------------------------------------------------------- Noms depuis l'adresse d'une page

function titleCase(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w, i) => (i > 0 && /^(de|du|des|la|le|les|et|a|à|au|aux|en|d|l)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/\b([dl]) /gi, "$1'");
}

export interface SlugInfo {
  name: string | null;
  city: string | null;
  hint: string | null;
}

/**
 * Devine un nom à partir de l'adresse de la page quand la page est inaccessible :
 * TheFork, TripAdvisor, Booking, ou dernier segment lisible.
 */
export function nameFromUrl(u: string | URL): SlugInfo {
  const url = typeof u === "string" ? safeParseUrl(u) : u;
  const none = { name: null, city: null, hint: null };
  if (!url) return none;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = decodeURIComponentSafe(url.pathname);

  // TheFork / LaFourchette : /restaurant/chez-janou-r123456
  if (/(^|\.)(thefork|lafourchette)\./.test(host)) {
    const m = path.match(/\/restaurant\/([^/]+?)(?:-r\d+)?\/?$/i) ?? path.match(/\/restaurant\/([^/]+?)-r\d+/i);
    if (m) return { name: titleCase(m[1].replace(/-/g, " ")), city: null, hint: "restaurant" };
  }
  // TripAdvisor : Restaurant_Review-g187079-d123-Reviews-Chez_Janou-Bordeaux_Gironde_Nouvelle_Aquitaine.html
  if (/(^|\.)tripadvisor\./.test(host)) {
    const m = path.match(/\/(Restaurant|Attraction|Hotel|Vacation|ShowUser)?_?Review-g\d+-d\d+-Reviews-(?:or\d+-)?([^-]+)-([^-.]+)/i);
    if (m) {
      const kind = (m[1] ?? "").toLowerCase();
      return {
        name: m[2].replace(/_/g, " ").trim(),
        city: m[3].split("_")[0] || null,
        hint: kind === "hotel" ? "hotel" : kind === "attraction" ? "attraction" : "restaurant",
      };
    }
  }
  // Booking : /hotel/fr/le-petit-hotel.fr.html
  if (/(^|\.)booking\.com$/.test(host)) {
    const m = path.match(/\/hotel\/[a-z]{2}\/([^/.]+)/i);
    if (m) return { name: titleCase(m[1].replace(/-/g, " ")), city: null, hint: "hotel" };
  }
  // Dernier segment lisible : /restaurant/le-pavillon-des-boulevards → "Le Pavillon des Boulevards"
  const segs = path.split("/").filter(Boolean);
  const last = segs[segs.length - 1]?.replace(/\.(html?|php|aspx?)$/i, "") ?? "";
  if (/^[a-zà-ÿ0-9]+(?:[-_][a-zà-ÿ0-9]+)+$/i.test(last) && /[a-z]{3}/i.test(last) && !/\d{3,}/.test(last)) {
    return { name: titleCase(last.replace(/[-_]+/g, " ")), city: null, hint: segs.slice(0, -1).join(" ") || null };
  }
  return none;
}

// ---------------------------------------------------------------- Plans (Apple Maps)

export function isAppleMapsUrl(u: string | URL): boolean {
  const url = typeof u === "string" ? safeParseUrl(u) : u;
  if (!url) return false;
  const h = url.hostname.toLowerCase();
  return h === "maps.apple.com" || h === "maps.apple";
}

/** maps.apple.com/?q=…&ll=…&address=… ou maps.apple.com/place?name=…&coordinate=…&address=… */
export function parseAppleMapsUrl(u: string | URL): GoogleMapsInfo {
  const out: GoogleMapsInfo = { name: null, address: null, lat: null, lng: null };
  const url = typeof u === "string" ? safeParseUrl(u) : u;
  if (!url || !isAppleMapsUrl(url)) return out;
  const p = url.searchParams;
  const name = p.get("name") ?? p.get("q");
  if (name && !COORDS_TEXT.test(name)) out.name = name.replace(/\s+/g, " ").trim() || null;
  const address = p.get("address");
  if (address) out.address = address.replace(/\s+/g, " ").trim() || null;
  for (const key of ["coordinate", "ll", "sll", "q"]) {
    const m = p.get(key)?.match(COORDS_TEXT);
    if (m && validCoords(Number(m[1]), Number(m[2]))) {
      out.lat = Number(m[1]);
      out.lng = Number(m[2]);
      break;
    }
  }
  return out;
}
