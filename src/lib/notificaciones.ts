/**
 * Tipos y etiquetas de las notificaciones (Fase 4). Reflejan la tabla
 * `public.notificaciones` (supabase/migrations/0008_notificaciones.sql).
 */

export type Notificacion = {
  id: string;
  tipo: string;
  asunto: string;
  cuerpo: string | null;
  entidad_tipo: string | null;
  entidad_id: string | null;
  estado: string;
  leida: boolean;
  created_at: string;
};

export const TIPO_NOTIFICACION_LABELS: Record<string, string> = {
  aprobacion_pendiente: "Aprobación pendiente",
  aprobacion_completada: "Aprobación completada",
  aprobacion_rechazada: "Aprobación rechazada",
  retencion_por_vencer: "Retención por vencer",
};

export function tipoNotificacionLabel(tipo: string): string {
  return TIPO_NOTIFICACION_LABELS[tipo] ?? "Notificación";
}

/** Ruta interna a la que apunta una notificación según su entidad. */
export function notificacionHref(n: {
  entidad_tipo: string | null;
  entidad_id: string | null;
}): string | null {
  if (n.entidad_tipo === "documento" && n.entidad_id) {
    return `/documentos/${n.entidad_id}`;
  }
  return null;
}
