import { createClient } from "@/lib/supabase/server";
import type { AprobacionTrd, Serie } from "@/lib/tipos";

/** Series de una oficina, ordenadas por código (árbol serie/subserie/tipo). */
export async function listSeriesPorOficina(
  oficinaId: string,
): Promise<Serie[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("series")
    .select("*")
    .eq("oficina_id", oficinaId)
    .order("codigo");
  return (data as Serie[] | null) ?? [];
}

/** Una serie por id. */
export async function getSerie(id: string): Promise<Serie | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("series")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Serie | null) ?? null;
}

/** Historial de aprobación de la TRD de una oficina, con el autor. */
export type AprobacionListado = AprobacionTrd & { autor: string | null };

type AprobacionRow = AprobacionTrd & {
  perfiles: { nombre_completo: string | null; email: string } | null;
};

export async function listAprobaciones(
  oficinaId: string,
): Promise<AprobacionListado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aprobaciones_trd")
    .select("*, perfiles(nombre_completo, email)")
    .eq("oficina_id", oficinaId)
    .order("creado_en", { ascending: false });

  return (
    (data as unknown as AprobacionRow[] | null)?.map((a) => {
      const { perfiles, ...rest } = a;
      return {
        ...rest,
        autor: perfiles?.nombre_completo ?? perfiles?.email ?? null,
      };
    }) ?? []
  );
}
