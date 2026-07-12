import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

/** Perfil con el nombre de su unidad (proceso), para listados de gestión. */
export type PerfilListado = {
  usuario_id: string;
  email: string;
  nombre_completo: string | null;
  titulo_cargo: string | null;
  rol: Role;
  activo: boolean;
  es_responsable: boolean;
  unidad_id: string | null;
  unidad_nombre: string | null;
};

type PerfilRow = Omit<PerfilListado, "unidad_nombre"> & {
  unidades: { nombre: string } | null;
};

function mapPerfil(row: PerfilRow): PerfilListado {
  const { unidades, ...rest } = row;
  return { ...rest, unidad_nombre: unidades?.nombre ?? null };
}

/** Perfil del usuario autenticado (o null si aún no existe). */
export async function getPerfilActual(): Promise<PerfilListado | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfiles")
    .select(
      "usuario_id, email, nombre_completo, titulo_cargo, rol, activo, es_responsable, unidad_id, unidades(nombre)",
    )
    .eq("usuario_id", user.id)
    .maybeSingle();

  return data ? mapPerfil(data as unknown as PerfilRow) : null;
}

/** Todos los perfiles (la RLS los limita a quien pueda verlos). */
export async function listPerfiles(): Promise<PerfilListado[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfiles")
    .select(
      "usuario_id, email, nombre_completo, titulo_cargo, rol, activo, es_responsable, unidad_id, unidades(nombre)",
    )
    .order("email");

  return (data as unknown as PerfilRow[] | null)?.map(mapPerfil) ?? [];
}

/** Número de documento del usuario (dato reservado; la RLS lo protege). */
export async function getNumeroDocumento(
  usuarioId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("datos_personales")
    .select("numero_documento")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  return data?.numero_documento ?? null;
}

/** Perfiles mínimos para selectores (asignar responsables, supervisor, etc.). */
export async function listPerfilesMinimos(): Promise<
  { usuario_id: string; nombre_completo: string | null; email: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfiles")
    .select("usuario_id, nombre_completo, email")
    .order("email");
  return data ?? [];
}

/** Pre-registro de un usuario (aún sin cuenta). */
export type PreRegistro = {
  email: string;
  nombre: string;
  rol: Role;
  unidad_id: string | null;
  oficina_id: string | null;
  notas: string | null;
};

/** Lista de pre-registros (usuarios_semilla). Solo visible para admin. */
export async function listPreRegistros(): Promise<PreRegistro[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuarios_semilla")
    .select("email, nombre, rol, unidad_id, oficina_id, notas")
    .order("email");
  return (data as PreRegistro[] | null) ?? [];
}
