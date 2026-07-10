/**
 * Lee las variables de entorno públicas de Supabase.
 *
 * Estas variables NO son secretas (la `anon key` está pensada para el cliente y
 * está protegida por las políticas RLS de la base de datos). La clave de
 * servicio (`service_role`) nunca se expone aquí.
 *
 * Lanza un error claro si faltan, para que el problema sea evidente en desarrollo.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase. Define NEXT_PUBLIC_SUPABASE_URL y " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env.local (ver .env.example).",
    );
  }

  return { url, anonKey };
}
