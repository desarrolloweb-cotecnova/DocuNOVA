/**
 * Tipos compartidos para el resultado de una importación por Excel. No importa
 * nada del servidor, así que puede usarse desde componentes de cliente.
 */
export type ResultadoImport = {
  ok: boolean;
  creados: number;
  actualizados: number;
  omitidos: number;
  errores: string[];
  /** Mensaje global de fallo (p. ej. archivo inválido o sin permiso). */
  mensaje?: string;
};

export const RESULTADO_INICIAL: ResultadoImport = {
  ok: false,
  creados: 0,
  actualizados: 0,
  omitidos: 0,
  errores: [],
};

/** Resultado de fallo global (antes de procesar filas). */
export function fallo(mensaje: string): ResultadoImport {
  return { ...RESULTADO_INICIAL, mensaje };
}
