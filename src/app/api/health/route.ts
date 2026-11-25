import { NextResponse } from "next/server";

// Sonde de santé (Docker HEALTHCHECK, supervision).
export function GET() {
  return NextResponse.json({ ok: true });
}
