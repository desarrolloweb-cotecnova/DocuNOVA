/**
 * Utilidades para interpretar los tiempos de retención de la TRD (texto libre
 * como "5 años", "6 meses", "5 años 6 meses") y calcular vencimientos del
 * archivo de gestión a partir de la fecha de apertura del expediente.
 */

/** Convierte un texto de retención a número de meses. Devuelve null si no aplica. */
export function retencionAMeses(
  texto: string | null | undefined,
): number | null {
  if (!texto) return null;
  const t = texto.toLowerCase();
  if (/permanente|indefinid|conservaci[oó]n total/.test(t)) return null;

  let meses = 0;
  let encontrado = false;
  const anios = t.match(/(\d+)\s*a[nñ]os?/);
  if (anios) {
    meses += parseInt(anios[1], 10) * 12;
    encontrado = true;
  }
  const mm = t.match(/(\d+)\s*mes/);
  if (mm) {
    meses += parseInt(mm[1], 10);
    encontrado = true;
  }
  return encontrado ? meses : null;
}

/** Suma meses a una fecha (sin mutar) y ajusta el fin de mes. */
function addMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha.getTime());
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return d;
}

/**
 * Calcula la fecha de vencimiento del archivo de gestión: fecha de apertura +
 * retención en gestión. Devuelve null si la retención no es un plazo concreto.
 */
export function vencimientoGestion(
  fechaApertura: string | null,
  retencionGestion: string | null | undefined,
): Date | null {
  if (!fechaApertura) return null;
  const meses = retencionAMeses(retencionGestion);
  if (meses === null) return null;
  const base = new Date(`${fechaApertura}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  return addMeses(base, meses);
}

export type EstadoVencimiento = "vencido" | "proximo" | "vigente" | "sin_dato";

/**
 * Clasifica un vencimiento respecto a hoy. "proximo" cuando faltan `diasAviso`
 * días o menos (por defecto 180 ≈ 6 meses).
 */
export function estadoVencimiento(
  vencimiento: Date | null,
  hoy: Date = new Date(),
  diasAviso = 180,
): EstadoVencimiento {
  if (!vencimiento) return "sin_dato";
  const dias = Math.ceil(
    (vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (dias < 0) return "vencido";
  if (dias <= diasAviso) return "proximo";
  return "vigente";
}

export const ESTADO_VENCIMIENTO_LABELS: Record<EstadoVencimiento, string> = {
  vencido: "Vencido",
  proximo: "Próximo a vencer",
  vigente: "Vigente",
  sin_dato: "Sin plazo",
};
