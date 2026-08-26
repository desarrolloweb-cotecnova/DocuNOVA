/**
 * Tipos y enumeraciones del dominio de DocuNOVA. Reflejan el esquema de
 * supabase/migrations/0001-0003. Las etiquetas están en español para la UI.
 */
import type { Role } from "./roles";

// -----------------------------------------------------------------------------
// Unidades organizacionales (eje -> macroproceso -> proceso)
// -----------------------------------------------------------------------------
export const TIPOS_UNIDAD = ["eje", "macroproceso", "proceso"] as const;
export type TipoUnidad = (typeof TIPOS_UNIDAD)[number];

export const TIPO_UNIDAD_LABELS: Record<TipoUnidad, string> = {
  eje: "Eje",
  macroproceso: "Macroproceso",
  proceso: "Proceso",
};

export type Unidad = {
  id: string;
  tipo: TipoUnidad;
  codigo: string;
  nombre: string;
  padre_id: string | null;
  activo: boolean;
  creado_en: string;
};

// -----------------------------------------------------------------------------
// Oficinas y responsables
// -----------------------------------------------------------------------------
export type Oficina = {
  id: string;
  unidad_id: string;
  codigo: string;
  nombre: string;
  ubicacion_fisica: string | null;
  ubicacion_digital: string | null;
  activo: boolean;
  creado_en: string;
};

export type ResponsableOficina = {
  id: string;
  oficina_id: string;
  usuario_id: string;
  es_principal: boolean;
  creado_en: string;
};

// -----------------------------------------------------------------------------
// Perfiles
// -----------------------------------------------------------------------------
export type Perfil = {
  usuario_id: string;
  email: string;
  nombre_completo: string | null;
  titulo_cargo: string | null;
  supervisor_id: string | null;
  es_responsable: boolean;
  activo: boolean;
  rol: Role;
  unidad_id: string | null;
  foto_url: string | null;
  creado_en: string;
  actualizado_en: string;
};

// -----------------------------------------------------------------------------
// Series (TRD)
// -----------------------------------------------------------------------------
export const NIVELES_SERIE = ["serie", "subserie", "tipo"] as const;
export type NivelSerie = (typeof NIVELES_SERIE)[number];

export const NIVEL_SERIE_LABELS: Record<NivelSerie, string> = {
  serie: "Serie",
  subserie: "Subserie",
  tipo: "Tipo documental",
};

export const NIVEL_SERIE_ICON: Record<NivelSerie, string> = {
  serie: "📁",
  subserie: "📂",
  tipo: "📄",
};

export const ESTADOS_TRD = [
  "borrador",
  "en_revision",
  "aprobado",
  "rechazado",
] as const;
export type EstadoTrd = (typeof ESTADOS_TRD)[number];

export const ESTADO_TRD_LABELS: Record<EstadoTrd, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export type Serie = {
  id: string;
  oficina_id: string;
  padre_id: string | null;
  codigo: string;
  nombre: string;
  nivel: NivelSerie;
  soporte_fisico: boolean;
  soporte_digital: boolean;
  anios_gestion: number | null;
  anios_central: number | null;
  disp_conservacion: boolean;
  disp_seleccion: boolean;
  disp_eliminacion: boolean;
  disp_digital: boolean;
  procedimiento: string | null;
  estado_aprobacion: EstadoTrd;
  version: number;
  creado_en: string;
  actualizado_en: string;
};

export type AprobacionTrd = {
  id: string;
  oficina_id: string;
  estado: EstadoTrd;
  usuario_id: string | null;
  comentario: string | null;
  creado_en: string;
};

// -----------------------------------------------------------------------------
// Documentos y registros
// -----------------------------------------------------------------------------
export const TIPOS_DOCUMENTO = ["ruta_cargue", "diligenciable"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  ruta_cargue: "Ruta de cargue",
  diligenciable: "Diligenciable",
};

export const ESTADOS_DOCUMENTO = ["borrador", "activo", "archivado"] as const;
export type EstadoDocumento = (typeof ESTADOS_DOCUMENTO)[number];

export const ESTADO_DOCUMENTO_LABELS: Record<EstadoDocumento, string> = {
  borrador: "Borrador",
  activo: "Activo",
  archivado: "Archivado",
};

export type Documento = {
  id: string;
  serie_id: string | null;
  oficina_id: string;
  codigo: string | null;
  nombre: string;
  tipo: TipoDocumento;
  es_publico: boolean;
  estado: EstadoDocumento;
  url_plantilla: string | null;
  requiere_descarga: boolean;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
};

export const ESTADOS_REGISTRO = ["borrador", "completado", "anulado"] as const;
export type EstadoRegistro = (typeof ESTADOS_REGISTRO)[number];

export const ESTADO_REGISTRO_LABELS: Record<EstadoRegistro, string> = {
  borrador: "Borrador",
  completado: "Completado",
  anulado: "Anulado",
};

export type Registro = {
  id: string;
  documento_id: string;
  usuario_id: string;
  oficina_id: string | null;
  url_archivo: string | null;
  datos_formulario: Record<string, unknown>;
  estado: EstadoRegistro;
  creado_en: string;
  actualizado_en: string;
};

// -----------------------------------------------------------------------------
// Memoria Corporativa
// -----------------------------------------------------------------------------
export const CATEGORIAS_MEMORIA = [
  "historica",
  "gobierno",
  "activa",
  "banco_proyectos",
] as const;
export type CategoriaMemoria = (typeof CATEGORIAS_MEMORIA)[number];

export const CATEGORIA_MEMORIA_LABELS: Record<CategoriaMemoria, string> = {
  historica: "Memoria Histórica",
  gobierno: "Memoria de Gobierno",
  activa: "Memoria Activa",
  banco_proyectos: "Banco de Proyectos",
};

/** Descripción corta de cada categoría (encabezado de la pestaña). */
export const CATEGORIA_MEMORIA_DESC: Record<CategoriaMemoria, string> = {
  historica:
    "Documentos que han perdido vigencia operativa pero conservan valor para la trazabilidad y el patrimonio documental (hitos, reglamentos no vigentes, informes de PDI/PEI).",
  gobierno:
    "Instrumentos vigentes que orientan el funcionamiento institucional: estatutos, reglamentos, políticas, actos administrativos, actas y contratos.",
  activa:
    "Documentos operativos de alta rotación y consulta frecuente: SIGYC, SAI, programas académicos vigentes, contratos y convenios activos.",
  banco_proyectos:
    "Proyectos institucionales en formulación, ejecución y cierre, iniciativas con aval y lecciones aprendidas.",
};

export const VISIBILIDADES_MEMORIA = ["publico", "privado"] as const;
export type VisibilidadMemoria = (typeof VISIBILIDADES_MEMORIA)[number];

export const VISIBILIDAD_MEMORIA_LABELS: Record<VisibilidadMemoria, string> = {
  publico: "Público",
  privado: "Privado",
};

export const ESTADOS_MEMORIA = ["pendiente", "publicado", "rechazado"] as const;
export type EstadoMemoria = (typeof ESTADOS_MEMORIA)[number];

export const ESTADO_MEMORIA_LABELS: Record<EstadoMemoria, string> = {
  pendiente: "Pendiente de aprobación",
  publicado: "Publicado",
  rechazado: "Rechazado",
};

export type MemoriaComponente = {
  id: string;
  categoria: CategoriaMemoria;
  nombre: string;
  orden: number;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

export type MemoriaDocumento = {
  id: string;
  categoria: CategoriaMemoria;
  componente_id: string | null;
  unidad_id: string | null;
  titulo: string;
  descripcion: string | null;
  /** Objeto en el bucket 'memoria' (null si el archivo vive en Drive). */
  archivo_ruta: string | null;
  /** ID del archivo en Google Drive (null si vive en Supabase Storage). */
  drive_file_id: string | null;
  /** Enlace para abrirlo en la interfaz de Google Drive. */
  drive_enlace: string | null;
  archivo_nombre: string;
  archivo_tipo: string | null;
  archivo_tamano: number | null;
  visibilidad: VisibilidadMemoria;
  estado: EstadoMemoria;
  comentario_revision: string | null;
  cargado_por: string | null;
  aprobado_por: string | null;
  creado_en: string;
  actualizado_en: string;
};

// -----------------------------------------------------------------------------
// Notificaciones
// -----------------------------------------------------------------------------
export const TIPOS_NOTIFICACION = [
  "trd_enviada_revision",
  "trd_aprobada",
  "trd_rechazada",
  "documento_activado",
  "documento_archivado",
  "registro_completado",
  "registro_anulado",
] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

export const TIPO_NOTIFICACION_LABELS: Record<TipoNotificacion, string> = {
  trd_enviada_revision: "TRD enviada a revisión",
  trd_aprobada: "TRD aprobada",
  trd_rechazada: "TRD rechazada",
  documento_activado: "Documento activado",
  documento_archivado: "Documento archivado",
  registro_completado: "Registro completado",
  registro_anulado: "Registro anulado",
};

export type EntidadNotificacion =
  "serie" | "oficina" | "documento" | "registro";

export type Notificacion = {
  id: string;
  destinatario: string;
  tipo: TipoNotificacion;
  asunto: string;
  mensaje: string | null;
  entidad_tipo: EntidadNotificacion | null;
  entidad_id: string | null;
  leida: boolean;
  creado_en: string;
};

/** Etiqueta genérica: devuelve la del mapa o un guion si no existe. */
export function labelDe<T extends string>(
  mapa: Record<T, string>,
  valor: string | null | undefined,
): string {
  if (valor && valor in mapa) return mapa[valor as T];
  return "—";
}
