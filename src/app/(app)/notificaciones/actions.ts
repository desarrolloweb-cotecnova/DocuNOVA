"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Marca una notificación como leída (solo el destinatario, la RLS lo asegura). */
export async function marcarLeida(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = str(formData.get("id"));
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("id", id)
    .eq("destinatario", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/notificaciones");
}

/** Marca todas las notificaciones del usuario como leídas. */
export async function marcarTodasLeidas() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("destinatario", user.id)
    .eq("leida", false);
  if (error) throw new Error(error.message);
  revalidatePath("/notificaciones");
}
