/**
 * Piezas compartidas por las pantallas de Memoria Corporativa (formulario de
 * carga, filtros del listado y formulario de edición).
 */

import { AVISO_BYTES_MEMORIA, MAX_BYTES_MEMORIA } from "@/lib/tipos";

/** Estilo común de los `<select>` nativos del módulo. */
export const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Tamaño de archivo legible ("820 KB", "3,4 MB"). Cadena vacía si no se sabe. */
export function formatoTamano(bytes: number | null): string {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

export type AvisoPeso = { tipo: "recomendacion" | "excede"; mensaje: string };

/**
 * Recomendación sobre el peso del archivo elegido, o null si no hay nada que
 * decir. Por encima de 5 MB sugiere comprimirlo (no impide subirlo); por encima
 * de 25 MB avisa de que el módulo lo va a rechazar.
 */
export function avisoDePeso(bytes: number): AvisoPeso | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const peso = formatoTamano(bytes);

  if (bytes > MAX_BYTES_MEMORIA) {
    return {
      tipo: "excede",
      mensaje:
        `El archivo pesa ${peso} y supera el límite de ` +
        `${formatoTamano(MAX_BYTES_MEMORIA)}. Comprímelo o divídelo en varios ` +
        "documentos antes de cargarlo.",
    };
  }

  if (bytes > AVISO_BYTES_MEMORIA) {
    return {
      tipo: "recomendacion",
      mensaje:
        `El archivo pesa ${peso}. Puedes subirlo tal como está, pero si lo ` +
        "comprimes ocupará menos espacio y se abrirá más rápido para quien lo " +
        "consulte. En un PDF escaneado suele bastar con exportarlo a 200–300 " +
        "ppp o en escala de grises.",
    };
  }

  return null;
}
