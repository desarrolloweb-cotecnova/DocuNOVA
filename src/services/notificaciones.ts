import { createClient } from "@/lib/supabase/server";
import type { Notificacion } from "@/lib/tipos";

/**
 * Notificaciones del usuario autenticado. Devuelve la lista (limitada) para el
 * panel del topbar o la página completa. Errores silenciados a `[]` para que la
 * app siga funcionando si la tabla aún no existe (migración pendiente).
 */
export async function listMisNotificaciones(
  limite = 200,
): Promise<Notificacion[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("destinatario", user.id)
    .order("leida", { ascending: true })
    .order("creado_en", { ascending: false })
    .limit(limite);

  if (error) return [];
  return (data as Notificacion[] | null) ?? [];
}

/** Cuenta las notificaciones no leídas del usuario autenticado. */
export async function contarMisNoLeidas(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notificaciones")
    .select("*", { count: "exact", head: true })
    .eq("destinatario", user.id)
    .eq("leida", false);

  if (error) return 0;
  return count ?? 0;
}
