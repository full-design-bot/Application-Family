import { NextResponse, type NextRequest } from "next/server";
import { searchPlaces } from "@/lib/places/geocode";
import { currentMember } from "@/lib/supabase/server";

/**
 * Recherche de lieux par nom (OpenStreetMap Nominatim, repli Photon).
 * GET ?q=chez janou → { results: [{ name, address, city, lat, lng, category }] }
 */
export async function GET(request: NextRequest) {
  const ctx = await currentMember();
  if (!ctx) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 150);
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const results = await searchPlaces(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "Recherche indisponible" }, { status: 502 });
  }
}
