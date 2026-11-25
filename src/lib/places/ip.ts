// Protection anti-SSRF : adresses IP privées / réservées et noms d'hôtes internes.
// Logique pure, testée dans ip.test.ts.

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8], // "ce réseau"
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // lien local / métadonnées cloud
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // réservé + broadcast
];

function isPrivateV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // invalide = refusé
  return V4_BLOCKS.some(([base, bits]) => {
    const b = ipv4ToInt(base)!;
    const size = 2 ** (32 - bits);
    return n >= b && n < b + size;
  });
}

/** Développe une IPv6 en 8 groupes de 16 bits (null si invalide). */
function expandV6(ip: string): number[] | null {
  let addr = ip.toLowerCase().split("%")[0];
  // Partie IPv4 finale (::ffff:1.2.3.4)
  const v4 = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = ipv4ToInt(v4[1]);
    if (n === null) return null;
    addr = addr.slice(0, -v4[1].length) + ((n >>> 16) & 0xffff).toString(16) + ":" + (n & 0xffff).toString(16);
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

function isPrivateV6(ip: string): boolean {
  const g = expandV6(ip);
  if (!g) return true;
  const allZeroUntil = (k: number) => g.slice(0, k).every((x) => x === 0);
  // :: et ::1
  if (allZeroUntil(7) && (g[7] === 0 || g[7] === 1)) return true;
  // IPv4 mappée ::ffff:a.b.c.d ou compatible ::a.b.c.d
  if (allZeroUntil(5) && (g[5] === 0xffff || g[5] === 0)) {
    const v4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
    return isPrivateV4(v4);
  }
  // NAT64 64:ff9b::/96
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isPrivateV4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 lien local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site local (obsolète)
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true; // 100::/64 discard
  if (g[0] === 0x2002) {
    // 6to4 : l'IPv4 est dans les groupes 1-2
    return isPrivateV4(`${g[1] >> 8}.${g[1] & 255}.${g[2] >> 8}.${g[2] & 255}`);
  }
  return false;
}

export function ipVersion(s: string): 0 | 4 | 6 {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return 4;
  if (s.includes(":") && /^[0-9a-f:.%a-z]+$/i.test(s)) return 6;
  return 0;
}

/** Vrai si l'adresse IP ne doit pas être contactée (privée, locale, réservée, invalide). */
export function isPrivateAddress(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, "");
  const v = ipVersion(clean);
  if (v === 4) return isPrivateV4(clean);
  if (v === 6) return isPrivateV6(clean);
  return true;
}

/** Noms d'hôtes manifestement internes (refusés avant même la résolution DNS). */
export function isForbiddenHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (/\.(local|internal|intranet|lan|home|corp|localdomain|home\.arpa)$/.test(h)) return true;
  if (!h.includes(".") && ipVersion(h) === 0) return true; // nom sans domaine ("intranet", "db")
  // Écritures numériques détournées : 2130706433, 0x7f.1, 0177.0.0.1
  if (/^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){0,3}$/i.test(h) && ipVersion(h) !== 4) return true;
  if (ipVersion(h) === 4 && h.split(".").some((p) => p.length > 1 && p.startsWith("0"))) return true;
  return false;
}
