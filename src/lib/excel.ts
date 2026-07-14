import * as XLSX from "xlsx";
import type { Plantilla } from "@/lib/plantillas";

/**
 * Utilidades de Excel para la carga masiva (servidor). Se apoyan en SheetJS.
 */

/** Lee la primera hoja de un archivo .xlsx/.xls y devuelve filas normalizadas. */
export async function leerFilas(file: File): Promise<Record<string, string>[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "array" });
  const primera = wb.SheetNames[0];
  if (!primera) return [];
  const hoja = wb.Sheets[primera];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: "",
  });
  return filas.map((fila) => {
    const limpia: Record<string, string> = {};
    for (const clave of Object.keys(fila)) {
      limpia[clave.trim()] = String(fila[clave] ?? "").trim();
    }
    return limpia;
  });
}

/**
 * Genera el libro .xlsx de una plantilla con filas de datos (hoja de datos +
 * instrucciones). Si no hay filas, usa la fila de ejemplo como guía.
 */
export function construirLibroDatos(
  plantilla: Plantilla,
  filas: Record<string, string | number>[],
): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const datos = XLSX.utils.json_to_sheet(
    filas.length > 0 ? filas : [plantilla.ejemplo],
    { header: plantilla.columnas },
  );
  XLSX.utils.book_append_sheet(wb, datos, plantilla.hoja);

  const instrucciones = XLSX.utils.aoa_to_sheet(
    plantilla.instrucciones.map((linea) => [linea]),
  );
  XLSX.utils.book_append_sheet(wb, instrucciones, "Instrucciones");

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/** Genera el libro .xlsx de una plantilla solo con la fila de ejemplo. */
export function construirLibro(plantilla: Plantilla): ArrayBuffer {
  return construirLibroDatos(plantilla, []);
}

/** Interpreta un valor de celda como booleano (Sí/No, 1/0, true/x…). */
export function siNo(valor: string | undefined): boolean {
  const v = (valor ?? "").trim().toLowerCase();
  return ["si", "sí", "s", "1", "true", "verdadero", "x"].includes(v);
}

/** Interpreta un valor de celda como entero, o null si está vacío/no numérico. */
export function entero(valor: string | undefined): number | null {
  const v = (valor ?? "").trim();
  if (v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/** Devuelve el texto recortado o null si está vacío. */
export function textoONull(valor: string | undefined): string | null {
  const v = (valor ?? "").trim();
  return v === "" ? null : v;
}
