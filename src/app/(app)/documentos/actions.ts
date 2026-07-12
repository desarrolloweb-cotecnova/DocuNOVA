"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { apruebaTRD, elabora } from "@/lib/roles";
import type { EstadoDocumento, TipoDocumento } from "@/lib/tipos";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function nullable(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}
function bool(v: FormDataEntryValue | null): boolean {
  return str(v) === "1" || str(v) === "on";
}

/** Crea un documento (definición) en estado borrador. */
export async function crearDocumento(formData: FormData) {
  const supabase = await requireCapacidad(elabora);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("documentos").insert({
    oficina_id: str(formData.get("oficina_id")),
    serie_id: nullable(formData.get("serie_id")),
    codigo: nullable(formData.get("codigo")),
    nombre: str(formData.get("nombre")),
    tipo: str(formData.get("tipo")) as TipoDocumento,
    es_publico: bool(formData.get("es_publico")),
    requiere_descarga: bool(formData.get("requiere_descarga")),
    url_plantilla: nullable(formData.get("url_plantilla")),
    creado_por: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}

/** Cambia el estado de un documento (activar/archivar) — solo aprobador. */
export async function setEstadoDocumento(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const estado = str(formData.get("estado")) as EstadoDocumento;
  const { error } = await supabase
    .from("documentos")
    .update({ estado })
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}

/** Elimina un documento — solo aprobador. */
export async function eliminarDocumento(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("documentos")
    .delete()
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}
