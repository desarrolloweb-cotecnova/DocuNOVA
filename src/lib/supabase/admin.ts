import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la clave de servicio (service_role). SOLO servidor.
 *
 * Omite la RLS y puede usar el API de administración de Auth (p. ej. forjar la
 * sesión de un usuario para la impersonación del módulo de Configuración). La clave
 * NUNCA debe llegar al navegador: por eso vive en SUPABASE_SERVICE_ROLE_KEY
 * (sin prefijo NEXT_PUBLIC_) y este módulo no se importa desde componentes de
 * cliente.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Falta la clave de servicio. Define SUPABASE_SERVICE_ROLE_KEY en las " +
        "variables de entorno para habilitar la impersonación.",
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
