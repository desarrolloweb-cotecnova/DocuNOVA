import { createClient } from "@/lib/supabase/server";
import type { Oficina } from "@/lib/tipos";

/** Oficina con el nombre de su proceso (unidad). */
export type OficinaListado = Oficina & { unidad_nombre: string | null };

type OficinaRow = Oficina & { unidades: { nombre: string } | null };

function mapOficina(row: OficinaRow): OficinaListado {
  const { unidades, ...rest } = row;
  return { ...rest, unidad_nombre: unidades?.nombre ?? null };
}

/** Todas las oficinas con su proceso, ordenadas por código. */
export async function listOficinas(): Promise<OficinaListado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("oficinas")
    .select("*, unidades(nombre)")
    .order("codigo");
  return (data as unknown as OficinaRow[] | null)?.map(mapOficina) ?? [];
}

/** Una oficina por id. */
export async function getOficina(id: string): Promise<OficinaListado | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("oficinas")
    .select("*, unidades(nombre)")
    .eq("id", id)
    .maybeSingle();
  return data ? mapOficina(data as unknown as OficinaRow) : null;
}

/** Responsable de una oficina, con datos del perfil. */
export type ResponsableListado = {
  id: string;
  usuario_id: string;
  es_principal: boolean;
  nombre_completo: string | null;
  email: string;
};

type ResponsableRow = {
  id: string;
  usuario_id: string;
  es_principal: boolean;
  perfiles: { nombre_completo: string | null; email: string } | null;
};

function mapResponsable(r: ResponsableRow): ResponsableListado {
  return {
    id: r.id,
    usuario_id: r.usuario_id,
    es_principal: r.es_principal,
    nombre_completo: r.perfiles?.nombre_completo ?? null,
    email: r.perfiles?.email ?? "",
  };
}

/** Responsables asignados a una oficina. */
export async function listResponsables(
  oficinaId: string,
): Promise<ResponsableListado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("responsables_oficina")
    .select("id, usuario_id, es_principal, perfiles(nombre_completo, email)")
    .eq("oficina_id", oficinaId)
    .order("es_principal", { ascending: false });

  return (
    (data as unknown as ResponsableRow[] | null)?.map(mapResponsable) ?? []
  );
}

/** Todos los responsables, agrupados por oficina (para listados). */
export async function listResponsablesPorOficina(): Promise<
  Record<string, ResponsableListado[]>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("responsables_oficina")
    .select(
      "id, oficina_id, usuario_id, es_principal, perfiles(nombre_completo, email)",
    )
    .order("es_principal", { ascending: false });

  const mapa: Record<string, ResponsableListado[]> = {};
  for (const row of (data as unknown as (ResponsableRow & {
    oficina_id: string;
  })[]) ?? []) {
    (mapa[row.oficina_id] ??= []).push(mapResponsable(row));
  }
  return mapa;
}
