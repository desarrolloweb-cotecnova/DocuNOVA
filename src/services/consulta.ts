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
  oficina_id: string | null;
  estado: EstadoRegistro;
  creado_en: string;
  documentos: { nombre: string } | null;
  oficinas: { nombre: string; unidades: { nombre: string } | null } | null;
};

/**
 * Consulta registros uniendo documento, oficina (dependencia) y proceso.
 * Filtros opcionales:
 *  - `oficinaId`: restringe a una dependencia concreta.
 *  - `oficinasVisibles`: lista blanca de ids de oficinas (para restringir por
 *    proceso del usuario cuando no ve todo).
 *  - `q`: texto que se busca en proceso, dependencia o documento.
 */
export async function buscarRegistros(
  opciones: {
    q?: string;
    oficinaId?: string | null;
    oficinasVisibles?: string[] | null;
  } = {},
): Promise<ResultadoConsulta[]> {
  const supabase = await createClient();

  let query = supabase
    .from("registros")
    .select(
      "id, oficina_id, estado, creado_en, documentos(nombre), oficinas(nombre, unidades(nombre))",
    )
    .order("creado_en", { ascending: false })
    .limit(500);

  if (opciones.oficinaId) {
    query = query.eq("oficina_id", opciones.oficinaId);
  } else if (opciones.oficinasVisibles) {
    if (opciones.oficinasVisibles.length === 0) return [];
    query = query.in("oficina_id", opciones.oficinasVisibles);
  }

  const { data } = await query;

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

  const termino = opciones.q?.trim().toLowerCase();
  if (!termino) return filas;

  return filas.filter((f) =>
    [f.proceso, f.dependencia, f.documento]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(termino)),
  );
}
