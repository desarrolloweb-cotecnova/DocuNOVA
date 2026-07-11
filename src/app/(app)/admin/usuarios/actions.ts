"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin, ROLES, type Role } from "@/lib/roles";

/** Verifica que quien ejecuta la acción sea el super administrador. */
async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isSuperAdmin(profile?.role)) throw new Error("No autorizado");
  return supabase;
}

function nullableId(value: FormDataEntryValue | null): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return v === "" ? null : v;
}

/** Activa o desactiva una cuenta. */
export async function setActivo(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const id = String(formData.get("id"));
  const activar = formData.get("activar") === "1";

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: activar })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/usuarios");
}

/** Asigna rol, proceso y oficina a una cuenta. */
export async function asignar(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!ROLES.includes(role as Role)) throw new Error("Rol inválido");

  const { error } = await supabase
    .from("profiles")
    .update({
      role: role as Role,
      proceso_id: nullableId(formData.get("proceso_id")),
      oficina_id: nullableId(formData.get("oficina_id")),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/usuarios");
}
