import type { createClient } from "@/lib/supabase/server";
import type { EntidadNotificacion, TipoNotificacion } from "@/lib/tipos";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * Emite una notificación para uno o varios destinatarios (bulk insert).
 * Silencia errores (por ejemplo si la migración 0006 aún no está aplicada)
 * para no romper la acción principal del usuario.
 */
export async function emitirNotificaciones(
  supabase: SupabaseServer,
  args: {
    destinatarios: string[];
    tipo: TipoNotificacion;
    asunto: string;
    mensaje?: string | null;
    entidadTipo?: EntidadNotificacion | null;
    entidadId?: string | null;
  },
): Promise<void> {
  const unicos = Array.from(new Set(args.destinatarios.filter(Boolean)));
  if (unicos.length === 0) return;
  const filas = unicos.map((destinatario) => ({
    destinatario,
    tipo: args.tipo,
    asunto: args.asunto,
    mensaje: args.mensaje ?? null,
    entidad_tipo: args.entidadTipo ?? null,
    entidad_id: args.entidadId ?? null,
  }));
  await supabase.from("notificaciones").insert(filas);
}

/** Devuelve los usuarios activos con rol de aprobación (superadmin/rector/administrador). */
export async function getAprobadoresIds(
  supabase: SupabaseServer,
): Promise<string[]> {
  const { data } = await supabase
    .from("perfiles")
    .select("usuario_id")
    .in("rol", ["superadmin", "rector", "administrador"])
    .eq("activo", true);
  return (data ?? []).map((p) => p.usuario_id);
}

/** Usuarios asignados como responsables de una oficina. */
export async function getResponsablesIds(
  supabase: SupabaseServer,
  oficinaId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("responsables_oficina")
    .select("usuario_id")
    .eq("oficina_id", oficinaId);
  return (data ?? []).map((r) => r.usuario_id);
}

/**
 * Autor del último evento "en_revision" en la TRD de una oficina, para poder
 * avisarle cuando su TRD sea aprobada o rechazada.
 */
export async function getAutorEnvioTrd(
  supabase: SupabaseServer,
  oficinaId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("aprobaciones_trd")
    .select("usuario_id")
    .eq("oficina_id", oficinaId)
    .eq("estado", "en_revision")
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.usuario_id ?? null;
}
