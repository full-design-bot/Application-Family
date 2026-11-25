import { NextResponse } from "next/server";
import { sendPushToMembers } from "@/lib/push/server";
import { currentMember } from "@/lib/supabase/server";

/**
 * Envoie une notification push depuis l'app.
 * Corps : { to: "partner" | "all" | "me" | string[], title, body?, url?, tag?, discreet? }
 * - "partner" : les autres parents (par défaut)
 * - discreet  : remplace le contenu par un texte neutre (jeux coquins)
 */
export async function POST(request: Request) {
  const ctx = await currentMember();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const body = await request.json();
  const to = body.to ?? "partner";
  const { data: members } = await ctx.sb.from("members").select("id, role");
  const all = (members ?? []) as { id: string; role: string }[];

  let targets: string[];
  if (Array.isArray(to)) targets = all.filter((m) => to.includes(m.id)).map((m) => m.id);
  else if (to === "me") targets = [ctx.member.id];
  else if (to === "all") targets = all.map((m) => m.id);
  else targets = all.filter((m) => m.id !== ctx.member.id && m.role === "parent").map((m) => m.id);

  const title = String(body.title ?? "Noesia Family").slice(0, 120);
  const text = body.body ? String(body.body).slice(0, 300) : undefined;
  const payload = body.discreet
    ? { title: "🎲 Noesia Family", body: "Tu as reçu quelque chose dans les jeux…", url: body.url ?? "/jeux", tag: "discret" }
    : { title, body: text, url: body.url ?? "/", tag: body.tag };

  const result = await sendPushToMembers(targets, payload);
  return NextResponse.json({ ok: true, ...result });
}
