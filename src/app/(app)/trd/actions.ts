"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { apruebaTRD, elabora } from "@/lib/roles";
import type { EstadoTrd, NivelSerie } from "@/lib/tipos";

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
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  return s === "" ? null : Number.parseInt(s, 10);
}

function camposSerie(formData: FormData) {
  return {
    codigo: str(formData.get("codigo")),
    nombre: str(formData.get("nombre")),
    nivel: str(formData.get("nivel")) as NivelSerie,
    padre_id: nullable(formData.get("padre_id")),
    soporte_fisico: bool(formData.get("soporte_fisico")),
    soporte_digital: bool(formData.get("soporte_digital")),
    anios_gestion: intOrNull(formData.get("anios_gestion")),
    anios_central: intOrNull(formData.get("anios_central")),
    disp_conservacion: bool(formData.get("disp_conservacion")),
    disp_seleccion: bool(formData.get("disp_seleccion")),
    disp_eliminacion: bool(formData.get("disp_eliminacion")),
    disp_digital: bool(formData.get("disp_digital")),
    procedimiento: nullable(formData.get("procedimiento")),
  };
}

/** Crea una entrada de TRD (serie/subserie/tipo). */
export async function crearSerie(formData: FormData) {
  const supabase = await requireCapacidad(elabora);
  const { error } = await supabase.from("series").insert({
    oficina_id: str(formData.get("oficina_id")),
    ...camposSerie(formData),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/trd");
}

/** Actualiza una entrada de TRD. */
export async function actualizarSerie(formData: FormData) {
  const supabase = await requireCapacidad(elabora);
  const { error } = await supabase
    .from("series")
    .update(camposSerie(formData))
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/trd");
}

/** Elimina una entrada de TRD (y su subárbol). */
export async function eliminarSerie(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("series")
    .delete()
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/trd");
}

async function cambiarEstadoTrd(
  formData: FormData,
  estado: EstadoTrd,
  puede: (rol: string | null | undefined) => boolean,
) {
  const supabase = await requireCapacidad(puede);
  const oficinaId = str(formData.get("oficina_id"));
  const comentario = nullable(formData.get("comentario"));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: e1 } = await supabase
    .from("series")
    .update({ estado_aprobacion: estado })
    .eq("oficina_id", oficinaId);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase.from("aprobaciones_trd").insert({
    oficina_id: oficinaId,
    estado,
    usuario_id: user?.id ?? null,
    comentario,
  });
  if (e2) throw new Error(e2.message);
  revalidatePath("/trd");
}

/** Envía la TRD de la oficina a revisión (quien elabora). */
export async function enviarRevision(formData: FormData) {
  await cambiarEstadoTrd(formData, "en_revision", elabora);
}

/** Aprueba la TRD de la oficina (aprobador). */
export async function aprobarTRD(formData: FormData) {
  await cambiarEstadoTrd(formData, "aprobado", apruebaTRD);
}

/** Rechaza la TRD de la oficina (aprobador). */
export async function rechazarTRD(formData: FormData) {
  await cambiarEstadoTrd(formData, "rechazado", apruebaTRD);
}
