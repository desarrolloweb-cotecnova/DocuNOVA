/**
 * Tipos y utilidades del módulo de Expedientes y Documentos (Fase 2).
 * Reflejan las tablas de supabase/migrations/0006_expedientes_documentos.sql.
 */

export const ESTADOS_EXPEDIENTE = ["abierto", "cerrado", "archivado"] as const;
export type EstadoExpediente = (typeof ESTADOS_EXPEDIENTE)[number];

export const ESTADO_EXPEDIENTE_LABELS: Record<EstadoExpediente, string> = {
  abierto: "Abierto",
  cerrado: "Cerrado",
  archivado: "Archivado",
};

export const TIPOS_DOCUMENTO = ["fisico", "electronico"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  fisico: "Físico",
  electronico: "Electrónico",
};

export type Expediente = {
  id: string;
  codigo: string | null;
  titulo: string;
  descripcion: string | null;
  subserie_id: string;
  proceso_id: string | null;
  oficina_id: string | null;
  responsable_id: string | null;
  estado: EstadoExpediente;
  fecha_apertura: string;
  created_at: string;
};

export type Documento = {
  id: string;
  expediente_id: string;
  tipo: TipoDocumento;
  titulo: string;
  descripcion: string | null;
  fecha_documento: string | null;
  proceso_id: string | null;
  oficina_id: string | null;
  caja: string | null;
  estante: string | null;
  carpeta: string | null;
  folio_inicial: number | null;
  folio_final: number | null;
  estado_conservacion: string | null;
  custodio_id: string | null;
  contenido: string | null;
  created_at: string;
};

export function estadoExpedienteLabel(estado: string): string {
  return ESTADO_EXPEDIENTE_LABELS[estado as EstadoExpediente] ?? "Desconocido";
}

export function tipoDocumentoLabel(tipo: string): string {
  return TIPO_DOCUMENTO_LABELS[tipo as TipoDocumento] ?? "Desconocido";
}

/**
 * Valida un rango de folios físicos. Devuelve un mensaje de error en español o
 * `null` si el rango es válido. Ambos vacíos es válido (folios opcionales).
 */
export function validarFolios(
  inicial: number | null,
  final: number | null,
): string | null {
  if (inicial === null && final === null) return null;
  if (inicial !== null && inicial < 1) return "El folio inicial debe ser ≥ 1.";
  if (final !== null && final < 1) return "El folio final debe ser ≥ 1.";
  if (inicial !== null && final !== null && final < inicial) {
    return "El folio final no puede ser menor que el inicial.";
  }
  return null;
}

/** Etiqueta legible del rango de folios (p. ej. "1–20", "5", "—"). */
export function foliosLabel(
  inicial: number | null,
  final: number | null,
): string {
  if (inicial === null && final === null) return "—";
  if (inicial !== null && final !== null) {
    return inicial === final ? `${inicial}` : `${inicial}–${final}`;
  }
  return String(inicial ?? final);
}

/** Resumen de la ubicación física de un documento (caja/estante/carpeta). */
export function ubicacionFisicaLabel(d: {
  caja: string | null;
  estante: string | null;
  carpeta: string | null;
}): string {
  const partes: string[] = [];
  if (d.caja) partes.push(`Caja ${d.caja}`);
  if (d.estante) partes.push(`Estante ${d.estante}`);
  if (d.carpeta) partes.push(`Carpeta ${d.carpeta}`);
  return partes.length ? partes.join(" · ") : "—";
}

/**
 * Normaliza el texto de búsqueda del usuario a una consulta `websearch` segura
 * para Postgres full-text search. Colapsa espacios y descarta cadenas vacías.
 */
export function normalizarBusqueda(texto: string | null | undefined): string {
  return (texto ?? "").trim().replace(/\s+/g, " ");
}
