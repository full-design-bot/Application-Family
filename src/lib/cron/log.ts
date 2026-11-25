import "server-only";

import { adminSupabase } from "@/lib/supabase/server";

/**
 * Réserve une clé de notification. Renvoie true la première fois seulement :
 * permet d'éviter d'envoyer deux fois le même rappel quand le cron repasse.
 *   if (await claimNotification(`event:${id}:${date}:60`)) await sendPushToMembers(...)
 */
export async function claimNotification(key: string): Promise<boolean> {
  const { data, error } = await adminSupabase()
    .from("notification_log")
    .upsert({ key }, { onConflict: "key", ignoreDuplicates: true })
    .select("key");
  if (error) {
    console.error("notification_log", error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
