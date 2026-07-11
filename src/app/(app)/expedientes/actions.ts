"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_EXPEDIENTE, type EstadoExpediente } from "@/lib/documentos";

/**
 * Crea un expediente. El Proceso y la Oficina se derivan de la subserie
 * mediante un trigger; la RLS (`can_write_proceso`) garantiza que el usuario
 * solo pueda crear expedientes de su propio proceso.
 */
export async function crearExpediente(formData: FormData) {
  const supabase = await createClient();

  const titulo = String(formData.get("titulo") ?? "").trim();
  const subserie_id = String(formData.get("subserie_id") ?? "");
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const estadoRaw = String(formData.get("estado") ?? "abierto");
  const estado: EstadoExpediente = ESTADOS_EXPEDIENTE.includes(
    estadoRaw as EstadoExpediente,
  )
    ? (estadoRaw as EstadoExpediente)
    : "abierto";

  if (!titulo) throw new Error("El título es obligatorio.");
  if (!subserie_id) throw new Error("Debes seleccionar una subserie (TRD).");

  const { data, error } = await supabase
    .from("expedientes")
    .insert({ titulo, descripcion, subserie_id, estado })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/expedientes");
  redirect(`/expedientes/${data.id}`);
}
