import "server-only";

// Récupération sûre d'une page web distante (anti-SSRF) :
// - uniquement http/https sur les ports standard, sans identifiants dans l'URL ;
// - refuse les hôtes internes et toute IP privée / locale / réservée, y compris après résolution DNS
//   (la vérification se fait au moment de la connexion : pas de contournement par « DNS rebinding ») ;
// - redirections suivies à la main (5 max) et revérifiées à chaque saut ;
// - délai global de 6 s, taille lue limitée, User-Agent générique.

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import { ipVersion, isForbiddenHostname, isPrivateAddress } from "./ip";

export const USER_AGENT = "Mozilla/5.0 (compatible; NoesiaFamily/1.0)";

export class SafeFetchError extends Error {
  constructor(
    public code: "bad_url" | "blocked" | "timeout" | "network" | "too_many_redirects" | "too_large",
    message: string,
  ) {
    super(message);
  }
}

export interface SafeFetchOptions {
  /** Délai global en ms (redirections comprises). Défaut : 6000 */
  timeoutMs?: number;
  /** Taille maximale lue (octets, après décompression). Défaut : 1,5 Mo — au-delà on tronque. */
  maxBytes?: number;
  maxRedirects?: number;
  /** Arrête de suivre les redirections dès que cette fonction renvoie vrai pour la prochaine adresse. */
  stopRedirectWhen?: (next: URL) => boolean;
  /** Ne pas lire le corps de la réponse */
  skipBody?: boolean;
  accept?: string;
}

export interface SafeFetchResult {
  status: number;
  /** Adresse finale (après redirections) */
  url: string;
  /** Adresses traversées */
  chain: string[];
  contentType: string;
  body: string;
  truncated: boolean;
}

/** Vérifie qu'une adresse peut être contactée (avant toute connexion). */
export function assertFetchableUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = typeof raw === "string" ? new URL(raw) : raw;
  } catch {
    throw new SafeFetchError("bad_url", "Adresse invalide");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SafeFetchError("bad_url", "Seuls les liens http(s) sont acceptés");
  if (url.username || url.password) throw new SafeFetchError("bad_url", "Adresse invalide");
  if (url.port && url.port !== "80" && url.port !== "443") throw new SafeFetchError("blocked", "Port non autorisé");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isForbiddenHostname(host)) throw new SafeFetchError("blocked", "Adresse interne refusée");
  if (ipVersion(host) !== 0 && isPrivateAddress(host)) throw new SafeFetchError("blocked", "Adresse interne refusée");
  return url;
}

/** Résolution DNS qui refuse les adresses privées (appelée par Node au moment de se connecter). */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = (Array.isArray(addresses) ? addresses : []) as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) {
      const e = Object.assign(new Error("Adresse interne refusée"), { code: "EBLOCKED" }) as NodeJS.ErrnoException;
      return callback(e, "", 4);
    }
    if (options.all) {
      (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    } else {
      callback(null, list[0].address, list[0].family);
    }
  });
};

function charsetFrom(contentType: string, head: Buffer): string {
  const fromHeader = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader;
  const sniff = head.subarray(0, 4096).toString("latin1");
  return sniff.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1] ?? "utf-8";
}

function decodeBody(buf: Buffer, contentType: string): string {
  const charset = charsetFrom(contentType, buf);
  try {
    return new TextDecoder(charset.toLowerCase()).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

interface Hop {
  status: number;
  location: string | null;
  contentType: string;
  body: Buffer;
  truncated: boolean;
}

function requestOnce(url: URL, deadline: number, opts: Required<Pick<SafeFetchOptions, "maxBytes" | "skipBody">> & { accept: string }): Promise<Hop> {
  return new Promise<Hop>((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new SafeFetchError("timeout", "Le site met trop de temps à répondre"));
    const mod = url.protocol === "https:" ? https : http;
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const req = mod.request(
      url,
      {
        method: "GET",
        agent: false,
        lookup: guardedLookup,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: opts.accept,
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers["content-type"] ?? "");
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        if ((status >= 300 && status < 400 && location) || opts.skipBody) {
          res.resume();
          return done(() => resolve({ status, location, contentType, body: Buffer.alloc(0), truncated: false }));
        }
        const textual = !contentType || /text\/|html|xml|json/i.test(contentType);
        if (!textual) {
          res.resume();
          return done(() => resolve({ status, location, contentType, body: Buffer.alloc(0), truncated: false }));
        }
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: Readable = res;
        if (enc.includes("gzip")) stream = res.pipe(zlib.createGunzip());
        else if (enc.includes("br")) stream = res.pipe(zlib.createBrotliDecompress());
        else if (enc.includes("deflate")) stream = res.pipe(zlib.createInflate());

        const chunks: Buffer[] = [];
        let size = 0;
        const finish = (truncated: boolean) =>
          done(() => {
            resolve({ status, location, contentType, body: Buffer.concat(chunks), truncated });
            req.destroy();
          });
        stream.on("data", (c: Buffer) => {
          if (settled) return;
          chunks.push(c);
          size += c.length;
          if (size >= opts.maxBytes) finish(true);
        });
        stream.on("end", () => finish(false));
        stream.on("error", () => finish(true));
      },
    );
    const timer = setTimeout(() => {
      done(() => reject(new SafeFetchError("timeout", "Le site met trop de temps à répondre")));
      req.destroy();
    }, remaining);
    req.on("error", (err: NodeJS.ErrnoException) => {
      done(() =>
        reject(
          err.code === "EBLOCKED"
            ? new SafeFetchError("blocked", "Adresse interne refusée")
            : new SafeFetchError("network", "Site injoignable"),
        ),
      );
    });
    req.end();
  });
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? 6000;
  const maxBytes = options.maxBytes ?? 1_500_000;
  const maxRedirects = options.maxRedirects ?? 5;
  const accept = options.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5";
  const deadline = Date.now() + timeoutMs;

  let url = assertFetchableUrl(rawUrl);
  const chain: string[] = [url.toString()];
  for (let i = 0; i <= maxRedirects; i++) {
    const hop = await requestOnce(url, deadline, { maxBytes, skipBody: options.skipBody ?? false, accept });
    if (hop.status >= 300 && hop.status < 400 && hop.location) {
      if (i === maxRedirects) throw new SafeFetchError("too_many_redirects", "Trop de redirections");
      let next: URL;
      try {
        next = new URL(hop.location, url);
      } catch {
        throw new SafeFetchError("bad_url", "Redirection invalide");
      }
      next = assertFetchableUrl(next);
      chain.push(next.toString());
      if (options.stopRedirectWhen?.(next)) {
        return { status: hop.status, url: next.toString(), chain, contentType: "", body: "", truncated: false };
      }
      url = next;
      continue;
    }
    return {
      status: hop.status,
      url: url.toString(),
      chain,
      contentType: hop.contentType,
      body: hop.body.length ? decodeBody(hop.body, hop.contentType) : "",
      truncated: hop.truncated,
    };
  }
  throw new SafeFetchError("too_many_redirects", "Trop de redirections");
}
