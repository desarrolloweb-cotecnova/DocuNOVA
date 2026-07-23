import { createClient } from "@/lib/supabase/server";
import type { MemoriaDocumento, MemoriaComponente } from "@/lib/tipos";

/** Documento de Memoria Corporativa con el nombre de quien lo cargó y su componente. */
export type MemoriaDocumentoListado = MemoriaDocumento & {
  cargador_nombre: string | null;
  componente_nombre: string | null;
};

type MemoriaRow = MemoriaDocumento & {
  cargador: { nombre_completo: string | null } | null;
  componente: { nombre: string } | null;
};

function mapDocumento(row: MemoriaRow): MemoriaDocumentoListado {
  const { cargador, componente, ...rest } = row;
  return {
    ...rest,
    cargador_nombre: cargador?.nombre_completo ?? null,
    componente_nombre: componente?.nombre ?? null,
  };
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
    .select(
      "*, cargador:perfiles!cargado_por(nombre_completo), componente:memoria_componentes(nombre)",
    )
    .order("creado_en", { ascending: false });
  return (data as unknown as MemoriaRow[] | null)?.map(mapDocumento) ?? [];
}

/** Todos los componentes (para la gestión en el módulo Gestión). */
export async function listComponentes(): Promise<MemoriaComponente[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memoria_componentes")
    .select("*")
    .order("categoria")
    .order("orden");
  return (data as MemoriaComponente[] | null) ?? [];
}

/** Componentes activos (para el desplegable de carga y el filtro del listado). */
export async function listComponentesActivos(): Promise<MemoriaComponente[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memoria_componentes")
    .select("*")
    .eq("activo", true)
    .order("categoria")
    .order("orden");
  return (data as MemoriaComponente[] | null) ?? [];
}
