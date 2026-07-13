"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { apruebaTRD, elabora } from "@/lib/roles";
import { leerFilas, siNo, textoONull } from "@/lib/excel";
import { fallo, type ResultadoImport } from "@/lib/importacion";
import {
  ESTADOS_DOCUMENTO,
  TIPOS_DOCUMENTO,
  type EstadoDocumento,
  type TipoDocumento,
} from "@/lib/tipos";

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

/** Crea un documento (definición) en estado borrador. */
export async function crearDocumento(formData: FormData) {
  const supabase = await requireCapacidad(elabora);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("documentos").insert({
    oficina_id: str(formData.get("oficina_id")),
    serie_id: nullable(formData.get("serie_id")),
    codigo: nullable(formData.get("codigo")),
    nombre: str(formData.get("nombre")),
    tipo: str(formData.get("tipo")) as TipoDocumento,
    es_publico: bool(formData.get("es_publico")),
    requiere_descarga: bool(formData.get("requiere_descarga")),
    url_plantilla: nullable(formData.get("url_plantilla")),
    creado_por: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}

/** Cambia el estado de un documento (activar/archivar) — solo aprobador. */
export async function setEstadoDocumento(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const estado = str(formData.get("estado")) as EstadoDocumento;
  const { error } = await supabase
    .from("documentos")
    .update({ estado })
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}

/** Elimina un documento — solo aprobador. */
export async function eliminarDocumento(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("documentos")
    .delete()
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}

/**
 * Carga masiva de documentos desde Excel (archivo global): cada fila es un
 * documento de una oficina identificada por su código. Hace upsert por
 * (oficina, código); si el código va vacío, siempre inserta uno nuevo.
 */
export async function importarDocumentos(
  _prev: ResultadoImport,
  formData: FormData,
): Promise<ResultadoImport> {
  let supabase: Awaited<ReturnType<typeof requireCapacidad>>;
  try {
    supabase = await requireCapacidad(elabora);
  } catch {
    return fallo("No tienes permiso para cargar documentos.");
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cacheOficina = new Map<string, string | null>();
  async function oficinaId(codigo: string): Promise<string | null> {
    if (cacheOficina.has(codigo)) return cacheOficina.get(codigo)!;
    const { data } = await supabase
      .from("oficinas")
      .select("id")
      .eq("codigo", codigo)
      .maybeSingle();
    const id = data?.id ?? null;
    cacheOficina.set(codigo, id);
    return id;
  }

  let creados = 0;
  let actualizados = 0;
  const errores: string[] = [];

  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const linea = i + 2;
    try {
      if (!f.oficina_codigo || !f.nombre || !f.tipo) {
        errores.push(`Fila ${linea}: faltan campos obligatorios.`);
        continue;
      }
      const tipo = f.tipo.toLowerCase() as TipoDocumento;
      if (!TIPOS_DOCUMENTO.includes(tipo)) {
        errores.push(
          `Fila ${linea}: tipo inválido "${f.tipo}" (ruta_cargue o diligenciable).`,
        );
        continue;
      }
      const estado = (f.estado?.toLowerCase() || "borrador") as EstadoDocumento;
      if (!ESTADOS_DOCUMENTO.includes(estado)) {
        errores.push(`Fila ${linea}: estado inválido "${f.estado}".`);
        continue;
      }
      const ofId = await oficinaId(f.oficina_codigo);
      if (!ofId) {
        errores.push(
          `Fila ${linea}: no existe la oficina "${f.oficina_codigo}".`,
        );
        continue;
      }

      let serie_id: string | null = null;
      if (f.serie_codigo) {
        const { data: serie } = await supabase
          .from("series")
          .select("id")
          .eq("oficina_id", ofId)
          .eq("codigo", f.serie_codigo)
          .limit(1)
          .maybeSingle();
        if (!serie) {
          errores.push(
            `Fila ${linea}: no se encontró la serie "${f.serie_codigo}" en la oficina.`,
          );
          continue;
        }
        serie_id = serie.id;
      }

      const fila = {
        oficina_id: ofId,
        serie_id,
        codigo: textoONull(f.codigo),
        nombre: f.nombre,
        tipo,
        es_publico: siNo(f.es_publico),
        estado,
        url_plantilla: textoONull(f.url_plantilla),
        requiere_descarga: siNo(f.requiere_descarga),
        creado_por: user?.id ?? null,
      };

      if (fila.codigo) {
        const { data: existente } = await supabase
          .from("documentos")
          .select("id")
          .eq("oficina_id", ofId)
          .eq("codigo", fila.codigo)
          .maybeSingle();
        const { error } = await supabase
          .from("documentos")
          .upsert(fila, { onConflict: "oficina_id,codigo" });
        if (error) throw new Error(error.message);
        if (existente) actualizados++;
        else creados++;
      } else {
        const { error } = await supabase.from("documentos").insert(fila);
        if (error) throw new Error(error.message);
        creados++;
      }
    } catch (e) {
      errores.push(`Fila ${linea}: ${(e as Error).message}`);
    }
  }

  revalidatePath("/documentos");
  return { ok: true, creados, actualizados, omitidos: 0, errores };
}
