import { NextResponse } from "next/server";
import { runAgendaCron } from "@/lib/cron/agenda";
import { runCoupleCron } from "@/lib/cron/couple";

// Tâches planifiées, appelées toutes les 5 minutes par Supabase pg_cron
// (voir supabase/setup/02_taches_planifiees.sql) avec l'en-tête
// Authorization: Bearer <CRON_SECRET>.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const now = new Date();
  const log: string[] = [];
  const tasks: [string, (d: Date) => Promise<string[]>][] = [
    ["agenda", runAgendaCron],
    ["couple", runCoupleCron],
  ];
  for (const [name, run] of tasks) {
    try {
      const lines = await run(now);
      log.push(...lines.map((l) => `[${name}] ${l}`));
    } catch (err) {
      console.error(`cron ${name}`, err);
      log.push(`[${name}] ERREUR ${(err as Error).message}`);
    }
  }
  return NextResponse.json({ ok: true, at: now.toISOString(), log });
}
