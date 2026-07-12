import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

/**
 * Devuelve el rol del usuario autenticado leyendo su perfil, o null si no hay
 * sesión o perfil. Útil para guardas de Server Actions y de páginas.
 */
export async function rolDelUsuario(): Promise<Role | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("usuario_id", user.id)
    .maybeSingle();

  return (data?.rol as Role | undefined) ?? null;
}

/**
 * Verifica que el rol del usuario cumpla el predicado dado; lanza si no.
 * Devuelve el cliente Supabase ya autenticado para reutilizarlo en la acción.
 */
export async function requireCapacidad(
  puede: (rol: string | null | undefined) => boolean,
): Promise<Awaited<ReturnType<typeof createClient>>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (!puede(data?.rol)) throw new Error("No autorizado");
  return supabase;
}
