import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { gestionaUsuarios } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { buscarRegistros } from "@/services/consulta";
import { listOficinas } from "@/services/oficinas";
import { listUnidades } from "@/services/unidades";
import { getPerfilActual } from "@/services/perfiles";
import { type Unidad } from "@/lib/tipos";
import { FiltroDependencia } from "@/components/filtro-dependencia";
import { TablaConsulta } from "@/components/tabla-consulta";

export const metadata: Metadata = {
  title: `Consulta — ${APP_NAME}`,
};

export default async function ConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{ oficina?: string }>;
}) {
  const { oficina } = await searchParams;
  const [rol, perfil, oficinas, unidades] = await Promise.all([
    rolDelUsuario(),
    getPerfilActual(),
    listOficinas(),
    listUnidades(),
  ]);

  // Restricción por proceso del usuario (mismo criterio que Documentos):
  // superadmin/rector/administrador ven todo; los demás quedan limitados a
  // su propio proceso (perfil.unidad_id).
  const puedeVerTodo = gestionaUsuarios(rol) || rol === "administrador";
  const procesoUsuario = perfil?.unidad_id ?? null;

  const oficinasVisibles = puedeVerTodo
    ? oficinas
    : procesoUsuario
      ? oficinas.filter((o) => o.unidad_id === procesoUsuario)
      : [];

  const unidadesVisibles: Unidad[] = (() => {
    if (puedeVerTodo || !procesoUsuario) return unidades;
    const porId = new Map(unidades.map((u) => [u.id, u] as const));
    const proceso = porId.get(procesoUsuario);
    const macro = proceso?.padre_id ? porId.get(proceso.padre_id) : undefined;
    const eje = macro?.padre_id ? porId.get(macro.padre_id) : undefined;
    return [eje, macro, proceso].filter((u): u is Unidad => Boolean(u));
  })();

  const oficinaId =
    oficina && oficinasVisibles.some((o) => o.id === oficina) ? oficina : null;

  const resultados =
    !puedeVerTodo && !procesoUsuario
      ? []
      : await buscarRegistros({
          oficinaId,
          oficinasVisibles: puedeVerTodo
            ? null
            : oficinasVisibles.map((o) => o.id),
        });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <FiltroDependencia
        unidades={unidadesVisibles}
        oficinas={oficinasVisibles}
        oficinaActual={oficinaId}
        basePath="/consulta"
      />

      {!puedeVerTodo && !procesoUsuario ? (
        <p className="text-sm text-muted-foreground">
          Aún no tienes un proceso asignado. Solicita a un administrador que te
          asocie a un proceso para poder consultar registros.
        </p>
      ) : (
        <TablaConsulta resultados={resultados} />
      )}
    </div>
  );
}
