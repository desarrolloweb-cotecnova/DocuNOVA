"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/roles";

// Solo estas tablas del catálogo organizacional pueden editarse desde aquí.
const TABLAS = [
  "ejes",
  "macroprocesos",
  "procesos",
  "oficinas_productoras",
] as const;
type Tabla = (typeof TABLAS)[number];

// La columna booleana de "activo" difiere entre tablas.
const COL_ACTIVO: Record<Tabla, string> = {
  ejes: "activo",
  macroprocesos: "activo",
  procesos: "activo",
  oficinas_productoras: "activo",
};

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

function tablaValida(t: string): t is Tabla {
  return (TABLAS as readonly string[]).includes(t);
}

/** Renombra un nodo del catálogo. */
export async function renombrar(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const tabla = String(formData.get("tabla"));
  const id = String(formData.get("id"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!tablaValida(tabla)) throw new Error("Tabla inválida");
  if (nombre === "") throw new Error("El nombre no puede estar vacío");

  const { error } = await supabase.from(tabla).update({ nombre }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/estructura");
}

/** Activa o inactiva un nodo del catálogo. */
export async function toggleActivo(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const tabla = String(formData.get("tabla"));
  const id = String(formData.get("id"));
  const activo = formData.get("activo") === "1";
  if (!tablaValida(tabla)) throw new Error("Tabla inválida");

  const { error } = await supabase
    .from(tabla)
    .update({ [COL_ACTIVO[tabla]]: activo })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/estructura");
}
