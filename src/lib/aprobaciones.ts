/**
 * Tipos y utilidades de los flujos de aprobación y firma electrónica (Fase 3).
 * Reflejan las tablas de supabase/migrations/0007_aprobacion_firma_auditoria.sql.
 */

export const ESTADOS_SOLICITUD = [
  "en_curso",
  "aprobado",
  "rechazado",
  "cancelado",
] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ESTADO_SOLICITUD_LABELS: Record<EstadoSolicitud, string> = {
  en_curso: "En curso",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

export const ESTADOS_PASO = ["pendiente", "aprobado", "rechazado"] as const;
export type EstadoPaso = (typeof ESTADOS_PASO)[number];

export const ESTADO_PASO_LABELS: Record<EstadoPaso, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export type Solicitud = {
  id: string;
  documento_id: string;
  proceso_id: string | null;
  estado: EstadoSolicitud;
  paso_actual: number;
  created_at: string;
};

export type Paso = {
  id: string;
  solicitud_id: string;
  orden: number;
  aprobador_id: string;
  estado: EstadoPaso;
  comentario: string | null;
  decidido_at: string | null;
};

export type Firma = {
  id: string;
  documento_id: string;
  paso_id: string | null;
  firmante_id: string | null;
  rol_snapshot: string | null;
  tipo_firma: string;
  hash_documento: string | null;
  ip: string | null;
  created_at: string;
};

export function estadoSolicitudLabel(estado: string): string {
  return ESTADO_SOLICITUD_LABELS[estado as EstadoSolicitud] ?? "Desconocido";
}

export function estadoPasoLabel(estado: string): string {
  return ESTADO_PASO_LABELS[estado as EstadoPaso] ?? "Desconocido";
}

/**
 * Construye la representación canónica y estable de un documento que se firma.
 * El hash de la firma electrónica se calcula sobre esta cadena, de modo que
 * cualquier cambio posterior al documento invalida la coincidencia del hash.
 */
export function canonicalDocumento(doc: {
  id: string;
  titulo: string;
  tipo: string;
  fecha_documento: string | null;
  contenido: string | null;
}): string {
  return [
    doc.id,
    doc.titulo ?? "",
    doc.tipo ?? "",
    doc.fecha_documento ?? "",
    doc.contenido ?? "",
  ].join(""); // separador de unidad, improbable en el contenido
}

/** ¿Es este paso el que está pendiente de decisión ahora mismo? */
export function esPasoActual(
  paso: { orden: number; estado: string },
  solicitud: { estado: string; paso_actual: number },
): boolean {
  return (
    solicitud.estado === "en_curso" &&
    paso.estado === "pendiente" &&
    paso.orden === solicitud.paso_actual
  );
}
