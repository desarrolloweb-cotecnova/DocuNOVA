"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { apruebaTRD } from "@/lib/roles";
import { leerFilas, textoONull } from "@/lib/excel";
import { fallo, type ResultadoImport } from "@/lib/importacion";
import type { TipoUnidad } from "@/lib/tipos";

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
  revalidatePath("/dependencias");
}

/**
 * Carga masiva de dependencias desde Excel: por cada fila hace upsert de
 * eje → macroproceso → proceso → oficina (resolviendo padres por código).
 */
export async function importarDependencias(
  _prev: ResultadoImport,
  formData: FormData,
): Promise<ResultadoImport> {
  let supabase: Awaited<ReturnType<typeof requireCapacidad>>;
  try {
    supabase = await requireCapacidad(apruebaTRD);
  } catch {
    return fallo("No tienes permiso para cargar dependencias.");
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return fallo("No se recibió ningún archivo.");
  }

  let filas: Record<string, string>[];
  try {
    filas = await leerFilas(archivo);
  } catch {
    return fallo("No se pudo leer el archivo. ¿Es un Excel válido?");
  }
  if (filas.length === 0) return fallo("El archivo no tiene filas de datos.");

  const cacheUnidad = new Map<string, string>();
  async function upsertUnidad(
    tipo: TipoUnidad,
    codigo: string,
    nombre: string,
    padre_id: string | null,
  ): Promise<string> {
    const cacheada = cacheUnidad.get(codigo);
    if (cacheada) return cacheada;
    const { data, error } = await supabase
      .from("unidades")
      .upsert({ tipo, codigo, nombre, padre_id }, { onConflict: "codigo" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    cacheUnidad.set(codigo, data.id);
    return data.id;
  }

  let creados = 0;
  let actualizados = 0;
  const errores: string[] = [];

  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const linea = i + 2; // +1 encabezado, +1 base 1
    try {
      if (
        !f.eje_codigo ||
        !f.macro_codigo ||
        !f.proceso_codigo ||
        !f.oficina_codigo
      ) {
        errores.push(`Fila ${linea}: faltan códigos obligatorios.`);
        continue;
      }
      const ejeId = await upsertUnidad(
        "eje",
        f.eje_codigo,
        f.eje_nombre || f.eje_codigo,
        null,
      );
      const macroId = await upsertUnidad(
        "macroproceso",
        f.macro_codigo,
        f.macro_nombre || f.macro_codigo,
        ejeId,
      );
      const procId = await upsertUnidad(
        "proceso",
        f.proceso_codigo,
        f.proceso_nombre || f.proceso_codigo,
        macroId,
      );

      const { data: existente } = await supabase
        .from("oficinas")
        .select("id")
        .eq("codigo", f.oficina_codigo)
        .maybeSingle();

      const { error } = await supabase.from("oficinas").upsert(
        {
          unidad_id: procId,
          codigo: f.oficina_codigo,
          nombre: f.oficina_nombre || f.oficina_codigo,
          ubicacion_fisica: textoONull(f.ubicacion_fisica),
          ubicacion_digital: textoONull(f.ubicacion_digital),
        },
        { onConflict: "codigo" },
      );
      if (error) throw new Error(error.message);

      if (existente) actualizados++;
      else creados++;
    } catch (e) {
      errores.push(`Fila ${linea}: ${(e as Error).message}`);
    }
  }

  revalidatePath("/dependencias");
  return { ok: true, creados, actualizados, omitidos: 0, errores };
}
