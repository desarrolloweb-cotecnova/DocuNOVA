"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * Cliente de Supabase para el navegador (Client Components).
 * Persiste la sesión en cookies compartidas con el servidor (@supabase/ssr).
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
