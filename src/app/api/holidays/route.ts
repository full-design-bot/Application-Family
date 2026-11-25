import { NextResponse } from "next/server";
import { fetchHolidays } from "@/lib/holidays";

export async function GET() {
  const holidays = await fetchHolidays();
  return NextResponse.json(
    { location: process.env.SCHOOL_LOCATION ?? "Bordeaux", holidays },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
