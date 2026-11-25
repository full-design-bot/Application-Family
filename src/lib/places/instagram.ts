// Lecture des pages Instagram (souvent bloquées : on récupère ce qu'on peut).
// Logique pure, testée dans instagram.test.ts.

import { cleanText, decodeEntities, extractMeta } from "./html";
import { isValidInstagramHandle, parseInstagramUrl } from "./input";

export interface InstagramInfo {
  account: string | null;
  fullName: string | null;
  caption: string | null;
}

/** Retire les couches d'échappement JSON (\" , \\u00e9 …) d'une chaîne extraite d'un script. */
export function unescapeJsonLayers(s: string): string {
  let cur = s;
  for (let i = 0; i < 3 && /\\/.test(cur); i++) {
    try {
      cur = JSON.parse(`"${cur.replace(/(^|[^\\])"/g, '$1\\"')}"`);
    } catch {
      break;
    }
  }
  return cur;
}

function fullNameFromScripts(html: string): string | null {
  // full_name dans du JSON échappé une ou plusieurs fois : \"full_name\":\"Chez Janou\"
  const m = html.match(/full_name\\*"\s*:\s*\\*"((?:[^"\\]|\\+[^"\\]|\\+u[0-9a-fA-F]{4})*?)\\*"/);
  if (!m) return null;
  const v = cleanText(unescapeJsonLayers(m[1]), 120);
  return v || null;
}

/** "Chez Janou (@chezjanou) • Instagram photos and videos" → { fullName, account } */
export function parseInstagramTitle(title: string | null | undefined): { fullName: string | null; account: string | null } {
  if (!title) return { fullName: null, account: null };
  const t = decodeEntities(title);
  const m = t.match(/^(.*?)\s*\(@([a-z0-9._]{1,30})\)/i);
  if (m) return { fullName: m[1].trim() || null, account: m[2].toLowerCase() };
  // "chezjanou on Instagram: "…"" / "Chez Janou sur Instagram : « … »"
  const on = t.match(/^(.*?)\s+(?:on|sur)\s+Instagram\s*:/i);
  if (on) {
    const who = on[1].trim();
    return isValidInstagramHandle(who) ? { fullName: null, account: who.toLowerCase() } : { fullName: who || null, account: null };
  }
  return { fullName: null, account: null };
}

/** Page publique d'une publication ou d'un compte (balises og / twitter). */
export function parseInstagramPage(html: string): InstagramInfo {
  const meta = extractMeta(html);
  const fromTitle = parseInstagramTitle(meta["og:title"] ?? meta["twitter:title"]);
  const ogUrl = meta["og:url"] ? parseInstagramUrl(meta["og:url"]) : null;
  let caption: string | null = null;
  const desc = meta["og:description"] ?? meta["description"];
  if (desc) {
    // "123 likes, 4 comments - chezjanou on November 1, 2024: "caption""
    const m = desc.match(/^[^-]*-\s*([a-z0-9._]{1,30})\s+(?:on|le)\s+[^:]+:\s*["“«]?([\s\S]*?)["”»]?\.?$/i);
    caption = cleanText(m ? m[2] : desc, 400);
    if (m && !fromTitle.account && isValidInstagramHandle(m[1])) fromTitle.account = m[1].toLowerCase();
  }
  return {
    account: fromTitle.account ?? ogUrl?.account ?? null,
    fullName: fromTitle.fullName ?? fullNameFromScripts(html),
    caption,
  };
}

/** Page « embed » (/p/<code>/embed/captioned/ ou /<compte>/embed/), accessible sans connexion. */
export function parseInstagramEmbed(html: string): InstagramInfo {
  const user = html.match(/class="UsernameText"[^>]*>\s*([a-z0-9._]{1,30})\s*</i);
  const alt = html.match(/shared by (?:&#064;|@)([a-z0-9._]{1,30})/i);
  const scriptUser = html.match(/\\*"username\\*"\s*:\s*\\*"([a-z0-9._]{1,30})\\*"/i);
  const account = (user?.[1] ?? alt?.[1] ?? scriptUser?.[1] ?? null)?.toLowerCase() ?? null;

  let caption: string | null = null;
  const cap = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments/i);
  if (cap) {
    const text = cap[1]
      .replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/i, " ")
      .replace(/<br\s*\/?>/gi, " ");
    caption = cleanText(text, 400);
  }
  return { account, fullName: fullNameFromScripts(html), caption };
}

/** "chez_janou.bdx" → "Chez Janou Bdx" (nom provisoire quand Instagram ne dit rien) */
export function nameFromHandle(handle: string): string {
  return handle
    .replace(/[._]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
