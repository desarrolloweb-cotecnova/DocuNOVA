/**
 * Tipos del catálogo organizacional y de la TRD (Eje → Macroproceso → Proceso →
 * Oficina Productora → Serie → Subserie). Reflejan las tablas creadas en
 * supabase/migrations/0002 y 0003.
 */

export type Eje = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
};

export type Macroproceso = {
  id: string;
  eje_id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
};

export type Proceso = {
  id: string;
  macroproceso_id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
};

export type OficinaProductora = {
  id: string;
  proceso_id: string | null;
  codigo: string;
  nombre: string;
  activo: boolean;
};

export type Serie = {
  id: string;
  oficina_id: string;
  cod_serie: string;
  nombre: string;
  activa: boolean;
};

export type Subserie = {
  id: string;
  serie_id: string;
  nombre: string;
  soporte_fisico: boolean;
  soporte_electronico: boolean;
  retencion_gestion: string | null;
  retencion_central: string | null;
  disp_conservacion_total: boolean;
  disp_eliminacion: boolean;
  disp_seleccion: boolean;
  disp_medio_digital: boolean;
  procedimiento: string | null;
  orden: number;
};

/** Etiqueta legible de la disposición final de una subserie. */
export function disposicionLabel(s: Subserie): string {
  const partes: string[] = [];
  if (s.disp_conservacion_total) partes.push("Conservación total");
  if (s.disp_eliminacion) partes.push("Eliminación");
  if (s.disp_seleccion) partes.push("Selección");
  if (s.disp_medio_digital) partes.push("Medio digital");
  return partes.length ? partes.join(" · ") : "—";
}

/** Etiqueta legible del soporte de una subserie. */
export function soporteLabel(s: Subserie): string {
  const partes: string[] = [];
  if (s.soporte_fisico) partes.push("Físico");
  if (s.soporte_electronico) partes.push("Electrónico");
  return partes.length ? partes.join(" + ") : "—";
}
