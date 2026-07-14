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

  // Reutiliza la unidad si su código ya existe (no la modifica); si no, la crea.
  const cacheUnidad = new Map<string, string>();
  async function obtenerOCrearUnidad(
    tipo: TipoUnidad,
    codigo: string,
    nombre: string,
    padre_id: string | null,
  ): Promise<string> {
    const cacheada = cacheUnidad.get(codigo);
    if (cacheada) return cacheada;
    const { data: existente } = await supabase
      .from("unidades")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();
    let id: string;
    if (existente) {
      id = existente.id;
    } else {
      const { data, error } = await supabase
        .from("unidades")
        .insert({ tipo, codigo, nombre, padre_id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = data.id;
    }
    cacheUnidad.set(codigo, id);
    return id;
  }

  let creados = 0;
  let omitidos = 0;
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
      const ejeId = await obtenerOCrearUnidad(
        "eje",
        f.eje_codigo,
        f.eje_nombre || f.eje_codigo,
        null,
      );
      const macroId = await obtenerOCrearUnidad(
        "macroproceso",
        f.macro_codigo,
        f.macro_nombre || f.macro_codigo,
        ejeId,
      );
      const procId = await obtenerOCrearUnidad(
        "proceso",
        f.proceso_codigo,
        f.proceso_nombre || f.proceso_codigo,
        macroId,
      );

      // Solo se agregan oficinas nuevas: si el código ya existe, se omite.
      const { data: existente } = await supabase
        .from("oficinas")
        .select("id")
        .eq("codigo", f.oficina_codigo)
        .maybeSingle();
      if (existente) {
        omitidos++;
        continue;
      }

      const { error } = await supabase.from("oficinas").insert({
        unidad_id: procId,
        codigo: f.oficina_codigo,
        nombre: f.oficina_nombre || f.oficina_codigo,
        ubicacion_fisica: textoONull(f.ubicacion_fisica),
        ubicacion_digital: textoONull(f.ubicacion_digital),
      });
      if (error) throw new Error(error.message);
      creados++;
    } catch (e) {
      errores.push(`Fila ${linea}: ${(e as Error).message}`);
    }
  }

  revalidatePath("/dependencias");
  return { ok: true, creados, actualizados: 0, omitidos, errores };
}
