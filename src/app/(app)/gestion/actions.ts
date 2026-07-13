"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import {
  apruebaTRD,
  gestionaUsuarios,
  ROLES_ASIGNABLES,
  type Role,
} from "@/lib/roles";
import type { TipoUnidad } from "@/lib/tipos";

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

// ---------------------------------------------------------------------------
// Estructura organizacional (unidades: eje / macroproceso / proceso)
// La RLS de `unidades` exige puede_aprobar_trd; en la interfaz solo se expone
// dentro de Gestión (superadmin/rector).
// ---------------------------------------------------------------------------

/** Crea una unidad organizacional (eje, macroproceso o proceso). */
export async function crearUnidad(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const tipo = str(formData.get("tipo")) as TipoUnidad;
  const padre_id = nullable(formData.get("padre_id"));
  if (tipo !== "eje" && !padre_id) {
    throw new Error("Un macroproceso o proceso requiere una unidad padre");
  }
  const { error } = await supabase.from("unidades").insert({
    tipo,
    codigo: str(formData.get("codigo")),
    nombre: str(formData.get("nombre")),
    padre_id: tipo === "eje" ? null : padre_id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
  revalidatePath("/dependencias");
}

/** Actualiza el código y el nombre de una unidad organizacional. */
export async function actualizarUnidad(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("unidades")
    .update({
      codigo: str(formData.get("codigo")),
      nombre: str(formData.get("nombre")),
    })
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
  revalidatePath("/dependencias");
}

/** Elimina una unidad organizacional. */
export async function eliminarUnidad(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("unidades")
    .delete()
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/gestion");
  revalidatePath("/dependencias");
}
