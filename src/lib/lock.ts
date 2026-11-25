"use client";

// Verrou Face ID / Touch ID de la section coquine.
// Utilise WebAuthn (passkey locale) pour demander la biométrie de l'iPhone.
// C'est un verrou d'interface : la vraie protection des données reste
// les règles d'accès de la base (réservé aux comptes parents).

const CRED_KEY = "noesia-lock-credential";
const UNLOCK_KEY = "noesia-lock-unlocked-at";
const UNLOCK_MINUTES = 10;

function b64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function unb64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export function biometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return Promise.resolve(false);
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
}

export function hasBiometricCredential() {
  return typeof localStorage !== "undefined" && !!localStorage.getItem(CRED_KEY);
}

/** Crée la clé locale (déclenche Face ID). */
export async function registerBiometric(memberId: string, email: string): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Noesia Family", id: location.hostname },
        user: { id: new TextEncoder().encode(memberId.slice(0, 64)), name: email, displayName: "Noesia — verrou" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(CRED_KEY, b64(cred.rawId));
    markUnlocked();
    return true;
  } catch {
    return false;
  }
}

/** Demande Face ID. */
export async function verifyBiometric(): Promise<boolean> {
  const id = localStorage.getItem(CRED_KEY);
  if (!id) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: unb64(id) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    if (!res) return false;
    markUnlocked();
    return true;
  } catch {
    return false;
  }
}

export function forgetBiometric() {
  localStorage.removeItem(CRED_KEY);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return b64(await crypto.subtle.digest("SHA-256", data));
}

export function markUnlocked() {
  sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
}

export function lockNow() {
  sessionStorage.removeItem(UNLOCK_KEY);
}

export function isUnlocked(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const at = Number(sessionStorage.getItem(UNLOCK_KEY) ?? 0);
  return Date.now() - at < UNLOCK_MINUTES * 60 * 1000;
}
