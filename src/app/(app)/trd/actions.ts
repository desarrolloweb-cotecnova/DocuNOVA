"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { apruebaTRD, elabora } from "@/lib/roles";
import { leerFilas, siNo, entero, textoONull } from "@/lib/excel";
import { fallo, type ResultadoImport } from "@/lib/importacion";
import { NIVELES_SERIE, type EstadoTrd, type NivelSerie } from "@/lib/tipos";

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
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  return s === "" ? null : Number.parseInt(s, 10);
}

function camposSerie(formData: FormData) {
  return {
    codigo: str(formData.get("codigo")),
    nombre: str(formData.get("nombre")),
    nivel: str(formData.get("nivel")) as NivelSerie,
    padre_id: nullable(formData.get("padre_id")),
    soporte_fisico: bool(formData.get("soporte_fisico")),
    soporte_digital: bool(formData.get("soporte_digital")),
    anios_gestion: intOrNull(formData.get("anios_gestion")),
    anios_central: intOrNull(formData.get("anios_central")),
    disp_conservacion: bool(formData.get("disp_conservacion")),
    disp_seleccion: bool(formData.get("disp_seleccion")),
    disp_eliminacion: bool(formData.get("disp_eliminacion")),
    disp_digital: bool(formData.get("disp_digital")),
    procedimiento: nullable(formData.get("procedimiento")),
  };
}

/** Crea una entrada de TRD (serie/subserie/tipo). */
export async function crearSerie(formData: FormData) {
  const supabase = await requireCapacidad(elabora);
  const { error } = await supabase.from("series").insert({
    oficina_id: str(formData.get("oficina_id")),
    ...camposSerie(formData),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/trd");
}

/** Actualiza una entrada de TRD. */
export async function actualizarSerie(formData: FormData) {
  const supabase = await requireCapacidad(elabora);
  const { error } = await supabase
    .from("series")
    .update(camposSerie(formData))
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/trd");
}

/** Elimina una entrada de TRD (y su subárbol). */
export async function eliminarSerie(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const { error } = await supabase
    .from("series")
    .delete()
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/trd");
}

async function cambiarEstadoTrd(
  formData: FormData,
  estado: EstadoTrd,
  puede: (rol: string | null | undefined) => boolean,
) {
  const supabase = await requireCapacidad(puede);
  const oficinaId = str(formData.get("oficina_id"));
  const comentario = nullable(formData.get("comentario"));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: e1 } = await supabase
    .from("series")
    .update({ estado_aprobacion: estado })
    .eq("oficina_id", oficinaId);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase.from("aprobaciones_trd").insert({
    oficina_id: oficinaId,
    estado,
    usuario_id: user?.id ?? null,
    comentario,
  });
  if (e2) throw new Error(e2.message);
  revalidatePath("/trd");
}

/** Envía la TRD de la oficina a revisión (quien elabora). */
export async function enviarRevision(formData: FormData) {
  await cambiarEstadoTrd(formData, "en_revision", elabora);
}

/** Aprueba la TRD de la oficina (aprobador). */
export async function aprobarTRD(formData: FormData) {
  await cambiarEstadoTrd(formData, "aprobado", apruebaTRD);
}

/** Rechaza la TRD de la oficina (aprobador). */
export async function rechazarTRD(formData: FormData) {
  await cambiarEstadoTrd(formData, "rechazado", apruebaTRD);
}

/**
 * Carga masiva de TRD desde Excel (archivo global): cada fila es una entrada
 * (serie/subserie/tipo) de una oficina identificada por su código. Hace upsert
 * por (oficina, código, nivel) y resuelve el padre por código.
 */
export async function importarTRD(
  _prev: ResultadoImport,
  formData: FormData,
): Promise<ResultadoImport> {
  let supabase: Awaited<ReturnType<typeof requireCapacidad>>;
  try {
    supabase = await requireCapacidad(elabora);
  } catch {
    return fallo("No tienes permiso para cargar la TRD.");
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

  // Resolver id de oficina por código (con caché).
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

  // Resolver id de una serie por (oficina, código) para enlazar padres.
  async function serieId(
    oficina: string,
    codigo: string,
  ): Promise<string | null> {
    const { data } = await supabase
      .from("series")
      .select("id")
      .eq("oficina_id", oficina)
      .eq("codigo", codigo)
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }

  let creados = 0;
  let actualizados = 0;
  const errores: string[] = [];

  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const linea = i + 2;
    try {
      if (!f.oficina_codigo || !f.codigo || !f.nombre || !f.nivel) {
        errores.push(`Fila ${linea}: faltan campos obligatorios.`);
        continue;
      }
      const nivel = f.nivel.toLowerCase() as NivelSerie;
      if (!NIVELES_SERIE.includes(nivel)) {
        errores.push(
          `Fila ${linea}: nivel inválido "${f.nivel}" (serie, subserie o tipo).`,
        );
        continue;
      }
      const ofId = await oficinaId(f.oficina_codigo);
      if (!ofId) {
        errores.push(
          `Fila ${linea}: no existe la oficina "${f.oficina_codigo}".`,
        );
        continue;
      }
      let padre_id: string | null = null;
      if (f.padre_codigo) {
        padre_id = await serieId(ofId, f.padre_codigo);
        if (!padre_id) {
          errores.push(
            `Fila ${linea}: no se encontró el padre "${f.padre_codigo}" en la oficina.`,
          );
          continue;
        }
      }

      const { data: existente } = await supabase
        .from("series")
        .select("id")
        .eq("oficina_id", ofId)
        .eq("codigo", f.codigo)
        .eq("nivel", nivel)
        .maybeSingle();

      const { error } = await supabase.from("series").upsert(
        {
          oficina_id: ofId,
          codigo: f.codigo,
          nombre: f.nombre,
          nivel,
          padre_id,
          soporte_fisico: siNo(f.soporte_fisico),
          soporte_digital: siNo(f.soporte_digital),
          anios_gestion: entero(f.anios_gestion),
          anios_central: entero(f.anios_central),
          disp_conservacion: siNo(f.disp_conservacion),
          disp_seleccion: siNo(f.disp_seleccion),
          disp_eliminacion: siNo(f.disp_eliminacion),
          disp_digital: siNo(f.disp_digital),
          procedimiento: textoONull(f.procedimiento),
        },
        { onConflict: "oficina_id,codigo,nivel" },
      );
      if (error) throw new Error(error.message);

      if (existente) actualizados++;
      else creados++;
    } catch (e) {
      errores.push(`Fila ${linea}: ${(e as Error).message}`);
    }
  }

  revalidatePath("/trd");
  return { ok: true, creados, actualizados, omitidos: 0, errores };
}
