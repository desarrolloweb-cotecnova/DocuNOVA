import { createClient } from "@/lib/supabase/server";
import type { TipoUnidad, Unidad } from "@/lib/tipos";

/** Todas las unidades ordenadas por código. */
export async function listUnidades(): Promise<Unidad[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("unidades").select("*").order("codigo");
  return (data as Unidad[] | null) ?? [];
}

/** Unidades de un tipo concreto (eje, macroproceso o proceso). */
export async function listUnidadesPorTipo(tipo: TipoUnidad): Promise<Unidad[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("unidades")
    .select("*")
    .eq("tipo", tipo)
    .order("codigo");
  return (data as Unidad[] | null) ?? [];
}

/** Procesos (hojas del árbol) para asociar oficinas y perfiles. */
export function listProcesos(): Promise<Unidad[]> {
  return listUnidadesPorTipo("proceso");
}
