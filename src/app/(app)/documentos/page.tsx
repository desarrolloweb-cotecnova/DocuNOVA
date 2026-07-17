import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { apruebaTRD, elabora, gestionaUsuarios } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { listOficinas } from "@/services/oficinas";
import { listUnidades } from "@/services/unidades";
import { getPerfilActual } from "@/services/perfiles";
import { listDocumentosPorOficina } from "@/services/documentos";
import { listSeriesPorOficina } from "@/services/series";
import {
  TIPO_DOCUMENTO_LABELS,
  ESTADO_DOCUMENTO_LABELS,
  labelDe,
  type Unidad,
} from "@/lib/tipos";
import { FiltroDependencia } from "@/components/filtro-dependencia";
import { ImportadorExcel } from "@/components/importador-excel";
import { DocumentosArbol } from "@/components/documentos-arbol";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton, SubmitIcon } from "@/components/ui/submit-button";
import {
  setEstadoDocumento,
  eliminarDocumento,
  importarDocumentos,
} from "./actions";

export const metadata: Metadata = {
  title: `Documentos — ${APP_NAME}`,
};

export default async function DocumentosPage({
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
  const puedeElaborar = elabora(rol);
  const puedeAprobar = apruebaTRD(rol);

  // superadmin/rector/administrador ven todos los procesos; el resto queda
  // limitado a su propio proceso (perfil.unidad_id). Es un filtro de UI —
  // la RLS del backend sigue autorizando la escritura por rol.
  const puedeVerTodo = gestionaUsuarios(rol) || rol === "administrador";
  const procesoUsuario = perfil?.unidad_id ?? null;

  const oficinasVisibles = puedeVerTodo
    ? oficinas
    : procesoUsuario
      ? oficinas.filter((o) => o.unidad_id === procesoUsuario)
      : [];

  // Reducir el catálogo de unidades a la rama del proceso del usuario cuando no
  // ve todo (para que el filtro en cascada muestre solo su eje/macro/proceso).
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

  const [documentos, series] = oficinaId
    ? await Promise.all([
        listDocumentosPorOficina(oficinaId),
        listSeriesPorOficina(oficinaId),
      ])
    : [[], []];

  const trdAprobada = series[0]?.estado_aprobacion === "aprobado";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {puedeAprobar && (
        <ImportadorExcel
          titulo="Carga masiva de documentos"
          descripcion="Descarga la plantilla (trae los documentos actuales), edítala y súbela. Solo se agregan los documentos nuevos; los de código ya existente se omiten."
          plantillaHref="/documentos/plantilla"
          accion={importarDocumentos}
        />
      )}

      <FiltroDependencia
        unidades={unidadesVisibles}
        oficinas={oficinasVisibles}
        oficinaActual={oficinaId}
        basePath="/documentos"
      />

      {!puedeVerTodo && !procesoUsuario ? (
        <p className="text-sm text-muted-foreground">
          Aún no tienes un proceso asignado. Solicita a un administrador que te
          asocie a un proceso para poder ver y crear documentos.
        </p>
      ) : !oficinaId ? (
        <p className="text-sm text-muted-foreground">
          Elige una dependencia para ver sus documentos.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Documentos ({documentos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {documentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta dependencia no tiene documentos.
                </p>
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2">Documento</th>
                      <th className="pb-2">Tipo</th>
                      <th className="pb-2">Estado</th>
                      <th className="pb-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {documentos.map((d) => (
                      <tr key={d.id}>
                        <td className="py-3">
                          <p className="font-medium">{d.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.codigo ? `${d.codigo} · ` : ""}
                            {d.serie_nombre ?? "Sin serie"}
                            {d.es_publico ? " · Público" : ""}
                          </p>
                        </td>
                        <td className="py-3">
                          {labelDe(TIPO_DOCUMENTO_LABELS, d.tipo)}
                        </td>
                        <td className="py-3">
                          <span
                            className={
                              d.estado === "activo"
                                ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                                : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            }
                          >
                            {labelDe(ESTADO_DOCUMENTO_LABELS, d.estado)}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-2">
                            {puedeAprobar && d.estado !== "activo" && (
                              <form action={setEstadoDocumento}>
                                <input type="hidden" name="id" value={d.id} />
                                <input
                                  type="hidden"
                                  name="estado"
                                  value="activo"
                                />
                                <SubmitButton
                                  size="sm"
                                  textoPendiente="Activando…"
                                  exito="Documento activado."
                                >
                                  Activar
                                </SubmitButton>
                              </form>
                            )}
                            {puedeAprobar && d.estado === "activo" && (
                              <form action={setEstadoDocumento}>
                                <input type="hidden" name="id" value={d.id} />
                                <input
                                  type="hidden"
                                  name="estado"
                                  value="archivado"
                                />
                                <SubmitButton
                                  size="sm"
                                  variant="outline"
                                  textoPendiente="Archivando…"
                                  exito="Documento archivado."
                                >
                                  Archivar
                                </SubmitButton>
                              </form>
                            )}
                            {puedeAprobar && (
                              <form action={eliminarDocumento}>
                                <input type="hidden" name="id" value={d.id} />
                                <SubmitIcon
                                  aria-label="Eliminar documento"
                                  confirmar={`¿Eliminar el documento "${d.nombre}"? Esta acción no se puede deshacer.`}
                                  exito="Documento eliminado."
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </SubmitIcon>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {puedeElaborar && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Crear documentos desde la TRD
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentosArbol
                  oficinaId={oficinaId}
                  series={series}
                  documentos={documentos}
                  trdAprobada={trdAprobada}
                  puedeElaborar={puedeElaborar}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
