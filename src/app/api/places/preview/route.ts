import { NextResponse } from "next/server";
import { analyzeInput } from "@/lib/places/preview";
import { currentMember } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Analyse ce que l'utilisateur a collé et renvoie un brouillon de lieu.
 * Corps : { input: string, title?: string, text?: string }
 * Réponse : { kind, draft, suggestions, warning }
 */
export async function POST(request: Request) {
  const ctx = await currentMember();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: { input?: unknown; title?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const input = typeof body.input === "string" ? body.input.slice(0, 2000) : "";
  if (!input.trim()) return NextResponse.json({ error: "Colle un lien ou tape un nom." }, { status: 400 });

  const hints = {
    title: typeof body.title === "string" ? body.title.slice(0, 300) : null,
    text: typeof body.text === "string" ? body.text.slice(0, 1000) : null,
  };

  try {
    const result = await analyzeInput(input, hints);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Analyse impossible pour le moment." }, { status: 500 });
  }
}
