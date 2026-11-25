import "server-only";

import { questionForDate } from "@/content/questions-du-jour";
import { claimNotification } from "@/lib/cron/log";
import { todayISO, toParisTime } from "@/lib/dates";
import { parentIds, sendPushToMembers } from "@/lib/push/server";
import { adminSupabase } from "@/lib/supabase/server";

const VIEW_ONCE_GRACE_MS = 2 * 60 * 1000;

/**
 * Tâches planifiées de l'espace couple (appelé toutes les 5 minutes) :
 *  a) nettoyage des photos éphémères expirées / vues,
 *  b) notification des capsules temporelles qui viennent de s'ouvrir,
 *  c) question du jour (une fois par jour, à partir de 9 h, heure de Paris).
 */
export async function runCoupleCron(now: Date): Promise<string[]> {
  const log: string[] = [];
  const sb = adminSupabase();

  // ------------------------------------------------ a) photos éphémères
  try {
    const { data: eph, error } = await sb
      .from("messages")
      .select("id, media_path, view_once, viewed_at, expires_at, keep_votes")
      .eq("kind", "ephemeral")
      .eq("kept", false)
      .eq("deleted", false);
    if (error) throw error;
    const limit = now.getTime() - VIEW_ONCE_GRACE_MS;
    const toClean = (eph ?? []).filter((m) => {
      const expired = m.expires_at && new Date(m.expires_at).getTime() < now.getTime();
      // Vue unique : on laisse 2 min après l'ouverture… sauf si l'un de nous a
      // déjà voté « on la garde » (l'autre a alors jusqu'à l'expiration pour voter).
      const seen =
        m.view_once && m.viewed_at && new Date(m.viewed_at).getTime() < limit && !(m.keep_votes as string[] | null)?.length;
      return expired || seen;
    });
    for (const m of toClean) {
      if (m.media_path) {
        const { error: rmErr } = await sb.storage.from("media").remove([m.media_path as string]);
        if (rmErr) log.push(`couple: suppression du fichier ${m.media_path} impossible (${rmErr.message})`);
      }
      await sb.from("messages").update({ media_path: null, deleted: true }).eq("id", m.id);
    }
    if (toClean.length) log.push(`couple: ${toClean.length} photo(s) éphémère(s) effacée(s)`);
  } catch (e) {
    log.push(`couple: erreur nettoyage éphémères (${(e as Error).message})`);
  }

  // ------------------------------------------------ b) capsules ouvertes
  try {
    const { data: caps, error } = await sb
      .from("messages")
      .select("id, sender_id, meta, unlock_at")
      .eq("kind", "capsule")
      .lte("unlock_at", now.toISOString());
    if (error) throw error;
    const pending = (caps ?? []).filter((c) => !(c.meta as Record<string, unknown> | null)?.notified);
    if (pending.length) {
      const parents = await parentIds();
      for (const c of pending) {
        const meta = (c.meta ?? {}) as Record<string, unknown>;
        const to = typeof meta.to === "string" ? [meta.to] : parents.filter((id) => id !== c.sender_id);
        // On marque d'abord (évite un double envoi si le cron se chevauche)
        await sb
          .from("messages")
          .update({ meta: { ...meta, notified: true } })
          .eq("id", c.id);
        await sendPushToMembers(to, {
          title: "🔓 Ta capsule temporelle s'est ouverte !",
          body: "Un message du passé t'attend dans la discussion 💌",
          url: "/messages",
          tag: `capsule-${c.id}`,
        });
      }
      log.push(`couple: ${pending.length} capsule(s) ouverte(s) notifiée(s)`);
    }
  } catch (e) {
    log.push(`couple: erreur capsules (${(e as Error).message})`);
  }

  // ------------------------------------------------ c) question du jour
  try {
    const date = todayISO(now);
    if (toParisTime(now) >= "09:00" && (await claimNotification(`daily:${date}`))) {
      const q = questionForDate(date);
      const parents = await parentIds();
      await sendPushToMembers(parents, {
        title: "❓ Question du jour",
        body: q.text,
        url: "/nous-deux",
        tag: "daily",
      });
      log.push(`couple: question du jour envoyée (${date})`);
    }
  } catch (e) {
    log.push(`couple: erreur question du jour (${(e as Error).message})`);
  }

  return log;
}
