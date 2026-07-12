"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { creaRegistros } from "@/lib/roles";
import type { EstadoRegistro } from "@/lib/tipos";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function nullable(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

/** Crea un registro a partir de un documento activo (como autor). */
export async function crearRegistro(formData: FormData) {
  const supabase = await requireCapacidad(creaRegistros);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("registros").insert({
    documento_id: str(formData.get("documento_id")),
    usuario_id: user!.id,
    oficina_id: nullable(formData.get("oficina_id")),
    url_archivo: nullable(formData.get("url_archivo")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/registros");
}

/** Cambia el estado de un registro (completar / anular). */
export async function setEstadoRegistro(formData: FormData) {
  const supabase = await requireCapacidad(creaRegistros);
  const estado = str(formData.get("estado")) as EstadoRegistro;
  const { error } = await supabase
    .from("registros")
    .update({ estado })
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/registros");
}
