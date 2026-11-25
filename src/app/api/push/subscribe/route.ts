import { NextResponse } from "next/server";
import { currentMember } from "@/lib/supabase/server";

// Enregistre (ou supprime) l'abonnement push de l'appareil courant.
export async function POST(request: Request) {
  const ctx = await currentMember();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const body = await request.json();
  const sub = body.subscription as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }
  // Un même appareil peut avoir changé de compte : on remplace.
  await ctx.sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await ctx.sb.from("push_subscriptions").insert({
    member_id: ctx.member.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const ctx = await currentMember();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { endpoint } = await request.json();
  await ctx.sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
