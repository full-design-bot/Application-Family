import "server-only";

import webpush from "web-push";
import { adminSupabase } from "@/lib/supabase/server";

export interface PushPayload {
  title: string;
  body?: string;
  /** Page ouverte au clic sur la notification */
  url?: string;
  /** Les notifications de même tag se remplacent */
  tag?: string;
  /** Nombre affiché sur la pastille de l'icône (si supporté) */
  badge?: number;
}

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:contact@example.com", pub, priv);
  configured = true;
  return true;
}

/**
 * Envoie une notification à tous les appareils des membres donnés.
 * Les abonnements expirés (404/410) sont supprimés automatiquement.
 */
export async function sendPushToMembers(memberIds: string[], payload: PushPayload) {
  if (!memberIds.length || !configure()) return { sent: 0 };
  const sb = adminSupabase();
  const { data: subs } = await sb.from("push_subscriptions").select("*").in("member_id", memberIds);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12, urgency: "high" },
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await sb.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("Erreur push", status, err);
        }
      }
    }),
  );
  return { sent };
}

/** Identifiants de tous les parents (pour le cron). */
export async function parentIds(): Promise<string[]> {
  const { data } = await adminSupabase().from("members").select("id").eq("role", "parent");
  return (data ?? []).map((m) => m.id as string);
}
