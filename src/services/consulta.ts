import { createClient } from "@/lib/supabase/server";
import type { EstadoRegistro } from "@/lib/tipos";

/** Fila de resultado de la consulta general (registro + contexto). */
export type ResultadoConsulta = {
  id: string;
  proceso: string | null;
  dependencia: string | null;
  documento: string | null;
  fecha: string;
  estado: EstadoRegistro;
};

type ConsultaRow = {
  id: string;
  estado: EstadoRegistro;
  creado_en: string;
  documentos: { nombre: string } | null;
  oficinas: { nombre: string; unidades: { nombre: string } | null } | null;
};

/**
 * Consulta registros uniendo documento, oficina (dependencia) y proceso.
 * El filtro de texto se aplica sobre proceso, dependencia y documento.
 */
export async function buscarRegistros(
  q?: string,
): Promise<ResultadoConsulta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registros")
    .select(
      "id, estado, creado_en, documentos(nombre), oficinas(nombre, unidades(nombre))",
    )
    .order("creado_en", { ascending: false })
    .limit(500);

  const filas: ResultadoConsulta[] = (
    (data as unknown as ConsultaRow[] | null) ?? []
  ).map((r) => ({
    id: r.id,
    proceso: r.oficinas?.unidades?.nombre ?? null,
    dependencia: r.oficinas?.nombre ?? null,
    documento: r.documentos?.nombre ?? null,
    fecha: r.creado_en,
    estado: r.estado,
  }));

  const termino = q?.trim().toLowerCase();
  if (!termino) return filas;

  return filas.filter((f) =>
    [f.proceso, f.dependencia, f.documento]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(termino)),
  );
}
