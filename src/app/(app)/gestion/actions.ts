"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { gestionaUsuarios, ROLES_ASIGNABLES, type Role } from "@/lib/roles";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function nullable(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

/** Cambia el rol de un usuario. */
export async function setRol(formData: FormData) {
  const supabase = await requireCapacidad(gestionaUsuarios);
  const id = str(formData.get("id"));
  const rol = str(formData.get("rol")) as Role;
  if (!ROLES_ASIGNABLES.includes(rol)) throw new Error("Rol no válido");

  const { error } = await supabase
    .from("perfiles")
    .update({ rol })
    .eq("usuario_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
}

/** Activa o desactiva una cuenta. */
export async function setActivo(formData: FormData) {
  const supabase = await requireCapacidad(gestionaUsuarios);
  const id = str(formData.get("id"));
  const activar = str(formData.get("activar")) === "1";

  const { error } = await supabase
    .from("perfiles")
    .update({ activo: activar })
    .eq("usuario_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
}

/** Crea un pre-registro (el usuario obtendrá el rol al iniciar sesión). */
export async function crearPreRegistro(formData: FormData) {
  const supabase = await requireCapacidad(gestionaUsuarios);
  const email = str(formData.get("email")).toLowerCase();
  const nombre = str(formData.get("nombre"));
  const rol = str(formData.get("rol")) as Role;
  if (!email || !nombre) throw new Error("Correo y nombre son obligatorios");
  if (!ROLES_ASIGNABLES.includes(rol)) throw new Error("Rol no válido");

  const { error } = await supabase.from("usuarios_semilla").upsert(
    {
      email,
      nombre,
      rol,
      unidad_id: nullable(formData.get("unidad_id")),
      oficina_id: nullable(formData.get("oficina_id")),
    },
    { onConflict: "email" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
}

/** Elimina un pre-registro. */
export async function eliminarPreRegistro(formData: FormData) {
  const supabase = await requireCapacidad(gestionaUsuarios);
  const email = str(formData.get("email"));
  const { error } = await supabase
    .from("usuarios_semilla")
    .delete()
    .eq("email", email);
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
}
