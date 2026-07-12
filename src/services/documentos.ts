import { createClient } from "@/lib/supabase/server";
import type { Documento } from "@/lib/tipos";

/** Documento con el nombre de su serie. */
export type DocumentoListado = Documento & { serie_nombre: string | null };

type DocumentoRow = Documento & { series: { nombre: string } | null };

function mapDocumento(row: DocumentoRow): DocumentoListado {
  const { series, ...rest } = row;
  return { ...rest, serie_nombre: series?.nombre ?? null };
}

/** Documentos de una oficina. */
export async function listDocumentosPorOficina(
  oficinaId: string,
): Promise<DocumentoListado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documentos")
    .select("*, series(nombre)")
    .eq("oficina_id", oficinaId)
    .order("nombre");
  return (data as unknown as DocumentoRow[] | null)?.map(mapDocumento) ?? [];
}

/** Documentos activos de una oficina (disponibles para registrar). */
export async function listDocumentosActivos(
  oficinaId: string,
): Promise<DocumentoListado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documentos")
    .select("*, series(nombre)")
    .eq("oficina_id", oficinaId)
    .eq("estado", "activo")
    .order("nombre");
  return (data as unknown as DocumentoRow[] | null)?.map(mapDocumento) ?? [];
}

/** Un documento por id. */
export async function getDocumento(
  id: string,
): Promise<DocumentoListado | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documentos")
    .select("*, series(nombre)")
    .eq("id", id)
    .maybeSingle();
  return data ? mapDocumento(data as unknown as DocumentoRow) : null;
}
