"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { apruebaTRD } from "@/lib/roles";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function nullable(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

/** Crea una oficina. */
export async function crearOficina(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase.from("oficinas").insert({
    unidad_id: str(formData.get("unidad_id")),
    codigo: str(formData.get("codigo")),
    nombre: str(formData.get("nombre")),
    ubicacion_fisica: nullable(formData.get("ubicacion_fisica")),
    ubicacion_digital: nullable(formData.get("ubicacion_digital")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dependencias");
}

/** Actualiza una oficina. */
export async function actualizarOficina(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const id = str(formData.get("id"));
  const { error } = await supabase
    .from("oficinas")
    .update({
      unidad_id: str(formData.get("unidad_id")),
      codigo: str(formData.get("codigo")),
      nombre: str(formData.get("nombre")),
      ubicacion_fisica: nullable(formData.get("ubicacion_fisica")),
      ubicacion_digital: nullable(formData.get("ubicacion_digital")),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dependencias");
}

/** Elimina una oficina. */
export async function eliminarOficina(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("oficinas")
    .delete()
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/dependencias");
}

/** Asigna un responsable a una oficina. */
export async function agregarResponsable(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase.from("responsables_oficina").upsert(
    {
      oficina_id: str(formData.get("oficina_id")),
      usuario_id: str(formData.get("usuario_id")),
      es_principal: str(formData.get("es_principal")) === "1",
    },
    { onConflict: "oficina_id,usuario_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dependencias");
}

/** Quita un responsable de una oficina. */
export async function quitarResponsable(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("responsables_oficina")
    .delete()
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/dependencias");
}
