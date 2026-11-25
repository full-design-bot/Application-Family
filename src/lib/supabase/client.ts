"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

/** Client Supabase côté navigateur (singleton). Respecte les règles RLS de l'utilisateur connecté. */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  return client;
}
