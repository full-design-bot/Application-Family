"use client";

// Gestion des notifications côté iPhone / navigateur.

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Demande l'autorisation et enregistre l'appareil. Doit être appelé suite à un appui (iOS). */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) {
    return {
      ok: false,
      error: isIOS() && !isStandalone()
        ? "Sur iPhone, ajoute d'abord l'app à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvre-la depuis l'icône."
        : "Ce navigateur ne gère pas les notifications.",
    };
  }
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { ok: false, error: "Clé VAPID manquante (NEXT_PUBLIC_VAPID_PUBLIC_KEY)." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Notifications refusées. Active-les dans Réglages → Notifications." };

  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
  if (!reg) return { ok: false, error: "Service worker indisponible." };
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  }
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) return { ok: false, error: "Impossible d'enregistrer l'appareil." };
  return { ok: true };
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

export interface NotifyOptions {
  /** "partner" (défaut) = l'autre parent, "all", "me", ou liste d'identifiants de membres */
  to?: "partner" | "all" | "me" | string[];
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  /** Contenu neutre sur l'écran verrouillé (jeux coquins) */
  discreet?: boolean;
}

/** Envoie une notification push (sans bloquer l'interface si ça échoue). */
export async function notify(opts: NotifyOptions) {
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
  } catch {
    // silencieux
  }
}

/** Met à jour la pastille de l'icône de l'app (iOS 16.4+, app installée). */
export function setBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (count > 0) nav.setAppBadge?.(count).catch(() => {});
  else nav.clearAppBadge?.().catch(() => {});
}
