import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Cliente de Supabase para el servidor (Server Components, Server Actions y
 * Route Handlers). En Next.js 16 `cookies()` es asíncrono.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` se invocó desde un Server Component (donde no se pueden
          // escribir cookies). Se ignora sin problema: el proxy (proxy.ts) es
          // el encargado de refrescar la sesión en cada petición.
        }
      },
    },
  });
}
