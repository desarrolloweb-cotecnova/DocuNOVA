"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

/**
 * Actualiza el perfil del usuario autenticado. Los campos privilegiados
 * (rol, activo, unidad, es_responsable) los revierte el trigger del backend si
 * quien edita no es administrador de usuarios, así que enviarlos es seguro.
 */
export async function actualizarPerfil(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error: e1 } = await supabase
    .from("perfiles")
    .update({
      nombre_completo: nullable(formData.get("nombre_completo")),
      titulo_cargo: nullable(formData.get("titulo_cargo")),
      supervisor_id: nullable(formData.get("supervisor_id")),
      unidad_id: nullable(formData.get("unidad_id")),
      es_responsable: bool(formData.get("es_responsable")),
    })
    .eq("usuario_id", user.id);
  if (e1) throw new Error(e1.message);

  const numero = nullable(formData.get("numero_documento"));
  const { error: e2 } = await supabase
    .from("datos_personales")
    .upsert(
      { usuario_id: user.id, numero_documento: numero },
      { onConflict: "usuario_id" },
    );
  if (e2) throw new Error(e2.message);

  revalidatePath("/perfil");
}
