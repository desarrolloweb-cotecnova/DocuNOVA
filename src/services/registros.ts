import { createClient } from "@/lib/supabase/server";
import type { EstadoRegistro } from "@/lib/tipos";

/** Registro con el nombre de su documento y oficina. */
export type RegistroListado = {
  id: string;
  documento_id: string;
  usuario_id: string;
  oficina_id: string | null;
  url_archivo: string | null;
  estado: EstadoRegistro;
  creado_en: string;
  documento_nombre: string | null;
  oficina_nombre: string | null;
};

type RegistroRow = Omit<
  RegistroListado,
  "documento_nombre" | "oficina_nombre"
> & {
  documentos: { nombre: string } | null;
  oficinas: { nombre: string } | null;
};

function mapRegistro(row: RegistroRow): RegistroListado {
  const { documentos, oficinas, ...rest } = row;
  return {
    ...rest,
    documento_nombre: documentos?.nombre ?? null,
    oficina_nombre: oficinas?.nombre ?? null,
  };
}

const SELECT =
  "id, documento_id, usuario_id, oficina_id, url_archivo, estado, creado_en, documentos(nombre), oficinas(nombre)";

/** Registros creados por el usuario autenticado. */
export async function listRegistrosDelUsuario(): Promise<RegistroListado[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("registros")
    .select(SELECT)
    .eq("usuario_id", user.id)
    .order("creado_en", { ascending: false });
  return (data as unknown as RegistroRow[] | null)?.map(mapRegistro) ?? [];
}

/** Registros de una oficina (la RLS decide qué filas ve cada rol). */
export async function listRegistrosPorOficina(
  oficinaId: string,
): Promise<RegistroListado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registros")
    .select(SELECT)
    .eq("oficina_id", oficinaId)
    .order("creado_en", { ascending: false });
  return (data as unknown as RegistroRow[] | null)?.map(mapRegistro) ?? [];
}

/** Últimos N registros del usuario (para el panel). */
export async function listRegistrosRecientes(
  limite = 5,
): Promise<RegistroListado[]> {
  const todos = await listRegistrosDelUsuario();
  return todos.slice(0, limite);
}
