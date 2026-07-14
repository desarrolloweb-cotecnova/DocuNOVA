import { createClient } from "@/lib/supabase/server";
import type { NivelSerie } from "@/lib/tipos";

/**
 * Construye las filas de datos actuales para las plantillas de carga masiva
 * (Dependencias, TRD, Documentos). Cada función devuelve filas con las mismas
 * columnas que la plantilla, listas para descargar, editar y volver a subir.
 * La RLS del cliente gobierna qué filas se ven (estas descargas son solo para
 * administradores, que las ven todas).
 */

type Fila = Record<string, string | number>;

const siNo = (b: boolean): string => (b ? "Sí" : "No");
const num = (n: number | null): string | number => (n == null ? "" : n);
const txt = (s: string | null): string => s ?? "";

const ORDEN_NIVEL: Record<NivelSerie, number> = {
  serie: 0,
  subserie: 1,
  tipo: 2,
};

/** Una fila por oficina, con toda su ruta eje → macro → proceso. */
export async function filasDependencias(): Promise<Fila[]> {
  const supabase = await createClient();
  const [{ data: unidades }, { data: oficinas }] = await Promise.all([
    supabase.from("unidades").select("id, codigo, nombre, padre_id"),
    supabase
      .from("oficinas")
      .select("codigo, nombre, unidad_id, ubicacion_fisica, ubicacion_digital")
      .order("codigo"),
  ]);

  const porId = new Map((unidades ?? []).map((u) => [u.id, u]));

  return (oficinas ?? []).map((o) => {
    const proc = o.unidad_id ? porId.get(o.unidad_id) : undefined;
    const macro = proc?.padre_id ? porId.get(proc.padre_id) : undefined;
    const eje = macro?.padre_id ? porId.get(macro.padre_id) : undefined;
    return {
      eje_codigo: eje?.codigo ?? "",
      eje_nombre: eje?.nombre ?? "",
      macro_codigo: macro?.codigo ?? "",
      macro_nombre: macro?.nombre ?? "",
      proceso_codigo: proc?.codigo ?? "",
      proceso_nombre: proc?.nombre ?? "",
      oficina_codigo: o.codigo,
      oficina_nombre: o.nombre,
      ubicacion_fisica: txt(o.ubicacion_fisica),
      ubicacion_digital: txt(o.ubicacion_digital),
    };
  });
}

/** Una fila por entrada de TRD (serie/subserie/tipo), ordenada padre → hijo. */
export async function filasTRD(): Promise<Fila[]> {
  const supabase = await createClient();
  const [{ data: oficinas }, { data: series }] = await Promise.all([
    supabase.from("oficinas").select("id, codigo"),
    supabase
      .from("series")
      .select(
        "id, oficina_id, padre_id, codigo, nombre, nivel, soporte_fisico, soporte_digital, anios_gestion, anios_central, disp_conservacion, disp_seleccion, disp_eliminacion, disp_digital, procedimiento",
      ),
  ]);

  const ofCodigo = new Map((oficinas ?? []).map((o) => [o.id, o.codigo]));
  const codigoPorId = new Map((series ?? []).map((s) => [s.id, s.codigo]));

  const ordenadas = [...(series ?? [])].sort((a, b) => {
    const oa = ofCodigo.get(a.oficina_id) ?? "";
    const ob = ofCodigo.get(b.oficina_id) ?? "";
    if (oa !== ob) return oa.localeCompare(ob);
    const na = ORDEN_NIVEL[a.nivel as NivelSerie] ?? 9;
    const nb = ORDEN_NIVEL[b.nivel as NivelSerie] ?? 9;
    if (na !== nb) return na - nb;
    return a.codigo.localeCompare(b.codigo);
  });

  return ordenadas.map((s) => ({
    oficina_codigo: ofCodigo.get(s.oficina_id) ?? "",
    codigo: s.codigo,
    nombre: s.nombre,
    nivel: s.nivel,
    padre_codigo: s.padre_id ? (codigoPorId.get(s.padre_id) ?? "") : "",
    soporte_fisico: siNo(s.soporte_fisico),
    soporte_digital: siNo(s.soporte_digital),
    anios_gestion: num(s.anios_gestion),
    anios_central: num(s.anios_central),
    disp_conservacion: siNo(s.disp_conservacion),
    disp_seleccion: siNo(s.disp_seleccion),
    disp_eliminacion: siNo(s.disp_eliminacion),
    disp_digital: siNo(s.disp_digital),
    procedimiento: txt(s.procedimiento),
  }));
}

/** Una fila por documento. */
export async function filasDocumentos(): Promise<Fila[]> {
  const supabase = await createClient();
  const [{ data: oficinas }, { data: series }, { data: documentos }] =
    await Promise.all([
      supabase.from("oficinas").select("id, codigo"),
      supabase.from("series").select("id, codigo"),
      supabase
        .from("documentos")
        .select(
          "oficina_id, serie_id, codigo, nombre, tipo, es_publico, estado, url_plantilla, requiere_descarga",
        )
        .order("nombre"),
    ]);

  const ofCodigo = new Map((oficinas ?? []).map((o) => [o.id, o.codigo]));
  const serieCodigo = new Map((series ?? []).map((s) => [s.id, s.codigo]));

  const ordenados = [...(documentos ?? [])].sort((a, b) => {
    const oa = ofCodigo.get(a.oficina_id) ?? "";
    const ob = ofCodigo.get(b.oficina_id) ?? "";
    if (oa !== ob) return oa.localeCompare(ob);
    return (a.nombre ?? "").localeCompare(b.nombre ?? "");
  });

  return ordenados.map((d) => ({
    oficina_codigo: ofCodigo.get(d.oficina_id) ?? "",
    serie_codigo: d.serie_id ? (serieCodigo.get(d.serie_id) ?? "") : "",
    codigo: txt(d.codigo),
    nombre: d.nombre,
    tipo: d.tipo,
    es_publico: siNo(d.es_publico),
    estado: d.estado,
    url_plantilla: txt(d.url_plantilla),
    requiere_descarga: siNo(d.requiere_descarga),
  }));
}
