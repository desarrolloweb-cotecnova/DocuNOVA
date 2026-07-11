import { createClient } from "@/lib/supabase/server";
import { isArchivoAdmin } from "@/lib/roles";

export type SubserieOption = {
  id: string;
  label: string;
  procesoId: string | null;
};

type Fila = {
  id: string;
  nombre: string;
  series: {
    nombre: string;
    oficinas_productoras: {
      codigo: string;
      proceso_id: string | null;
    } | null;
  } | null;
};

/**
 * Carga las subseries de la TRD como opciones para clasificar un expediente,
 * etiquetadas "Oficina · Serie › Subserie". Para roles no administrativos se
 * limitan a las del proceso del usuario; los administradores de archivo ven
 * todas.
 */
export async function loadSubserieOptions(): Promise<SubserieOption[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, proceso_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data } = await supabase
    .from("subseries")
    .select(
      "id, nombre, series!inner(nombre, oficinas_productoras!inner(codigo, proceso_id))",
    )
    .order("nombre");

  const filas = (data ?? []) as unknown as Fila[];
  const admin = isArchivoAdmin(profile?.role);
  const procesoUsuario = profile?.proceso_id ?? null;

  return filas
    .filter((f) => {
      const procesoId = f.series?.oficinas_productoras?.proceso_id ?? null;
      return admin || (procesoUsuario != null && procesoId === procesoUsuario);
    })
    .map((f) => {
      const ofi = f.series?.oficinas_productoras;
      const serie = f.series?.nombre ?? "";
      return {
        id: f.id,
        label: `${ofi?.codigo ?? ""} · ${serie} › ${f.nombre}`,
        procesoId: ofi?.proceso_id ?? null,
      };
    });
}
