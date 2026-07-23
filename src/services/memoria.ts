import { createClient } from "@/lib/supabase/server";
import type { MemoriaDocumento } from "@/lib/tipos";

/** Documento de Memoria Corporativa con el nombre de quien lo cargó. */
export type MemoriaDocumentoListado = MemoriaDocumento & {
  cargador_nombre: string | null;
};

type MemoriaRow = MemoriaDocumento & {
  cargador: { nombre_completo: string | null } | null;
};

function mapDocumento(row: MemoriaRow): MemoriaDocumentoListado {
  const { cargador, ...rest } = row;
  return { ...rest, cargador_nombre: cargador?.nombre_completo ?? null };
}

/**
 * Documentos de Memoria Corporativa visibles para el usuario actual. La RLS
 * decide qué filas devuelve (públicos publicados a cualquier rol; privados a
 * gestor+; pendientes al autor o a los aprobadores). Se agrupan por categoría
 * en la página.
 */
export async function listMemoria(): Promise<MemoriaDocumentoListado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memoria_documentos")
    .select("*, cargador:perfiles!cargado_por(nombre_completo)")
    .order("creado_en", { ascending: false });
  return (data as unknown as MemoriaRow[] | null)?.map(mapDocumento) ?? [];
}
