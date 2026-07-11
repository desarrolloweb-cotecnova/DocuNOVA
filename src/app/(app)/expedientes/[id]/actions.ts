"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  TIPOS_DOCUMENTO,
  validarFolios,
  type TipoDocumento,
} from "@/lib/documentos";

function intOrNull(value: FormDataEntryValue | null): number | null {
  const v = typeof value === "string" ? value.trim() : "";
  if (v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return v === "" ? null : v;
}

/**
 * Crea un documento dentro de un expediente. El Proceso/Oficina se heredan del
 * expediente (trigger) y la RLS impide crear documentos fuera del proceso del
 * usuario.
 */
export async function crearDocumento(formData: FormData) {
  const supabase = await createClient();

  const expediente_id = String(formData.get("expediente_id") ?? "");
  const tipoRaw = String(formData.get("tipo") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!expediente_id) throw new Error("Expediente no especificado.");
  if (!titulo) throw new Error("El título del documento es obligatorio.");
  if (!TIPOS_DOCUMENTO.includes(tipoRaw as TipoDocumento)) {
    throw new Error("Tipo de documento inválido.");
  }
  const tipo = tipoRaw as TipoDocumento;

  const base = {
    expediente_id,
    tipo,
    titulo,
    descripcion: textOrNull(formData.get("descripcion")),
    fecha_documento: textOrNull(formData.get("fecha_documento")),
  };

  let payload: Record<string, unknown>;
  if (tipo === "fisico") {
    const folio_inicial = intOrNull(formData.get("folio_inicial"));
    const folio_final = intOrNull(formData.get("folio_final"));
    const errorFolios = validarFolios(folio_inicial, folio_final);
    if (errorFolios) throw new Error(errorFolios);
    payload = {
      ...base,
      caja: textOrNull(formData.get("caja")),
      estante: textOrNull(formData.get("estante")),
      carpeta: textOrNull(formData.get("carpeta")),
      folio_inicial,
      folio_final,
      estado_conservacion: textOrNull(formData.get("estado_conservacion")),
    };
  } else {
    payload = {
      ...base,
      contenido: textOrNull(formData.get("contenido")),
    };
  }

  const { error } = await supabase.from("documentos").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath(`/expedientes/${expediente_id}`);
}
