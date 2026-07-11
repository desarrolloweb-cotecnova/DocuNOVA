"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Marca una notificación del usuario como leída. */
export async function marcarLeida(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase.rpc("marcar_notificacion_leida", {
    p_notif: id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/notificaciones");
}
