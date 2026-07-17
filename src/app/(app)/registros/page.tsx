import type { Metadata } from "next";
import { Plus, FileStack } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { creaRegistros, gestionaUsuarios } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { listOficinas } from "@/services/oficinas";
import { listUnidades } from "@/services/unidades";
import { getPerfilActual } from "@/services/perfiles";
import { listDocumentosActivos } from "@/services/documentos";
import { listRegistrosPorOficina } from "@/services/registros";
import { TIPO_DOCUMENTO_LABELS, labelDe, type Unidad } from "@/lib/tipos";
import { FiltroDependencia } from "@/components/filtro-dependencia";
import { TablaRegistros } from "@/components/tabla-registros";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { crearRegistro } from "./actions";

export const metadata: Metadata = {
  title: `Registros — ${APP_NAME}`,
};

export default async function RegistrosPage({
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
  const puedeRegistrar = creaRegistros(rol);

  // Mismo criterio de proceso propio que Documentos/Consulta.
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

  const [documentos, registros] = oficinaId
    ? await Promise.all([
        listDocumentosActivos(oficinaId),
        listRegistrosPorOficina(oficinaId),
      ])
    : [[], []];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <FiltroDependencia
        unidades={unidadesVisibles}
        oficinas={oficinasVisibles}
        oficinaActual={oficinaId}
        basePath="/registros"
      />

      {!puedeVerTodo && !procesoUsuario ? (
        <p className="text-sm text-muted-foreground">
          Aún no tienes un proceso asignado. Solicita a un administrador que te
          asocie a un proceso para poder ver y crear registros.
        </p>
      ) : !oficinaId ? (
        <p className="text-sm text-muted-foreground">
          Elige una dependencia para ver sus registros.
        </p>
      ) : (
        <>
          {/* Documentos disponibles para crear registros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Documentos disponibles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay documentos activos en esta dependencia.
                </p>
              ) : (
                <ul className="divide-y">
                  {documentos.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium">
                          <FileStack className="size-4 text-muted-foreground" />
                          {d.nombre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {labelDe(TIPO_DOCUMENTO_LABELS, d.tipo)}
                        </span>
                      </span>
                      {puedeRegistrar && (
                        <form action={crearRegistro}>
                          <input
                            type="hidden"
                            name="documento_id"
                            value={d.id}
                          />
                          <input
                            type="hidden"
                            name="oficina_id"
                            value={oficinaId}
                          />
                          <SubmitButton
                            size="sm"
                            textoPendiente="Registrando…"
                            exito="Registro creado."
                          >
                            <Plus className="size-4" />
                            Registrar
                          </SubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Tabla de registros con búsqueda */}
          <TablaRegistros registros={registros} puedeActuar={puedeRegistrar} />
        </>
      )}
    </div>
  );
}
