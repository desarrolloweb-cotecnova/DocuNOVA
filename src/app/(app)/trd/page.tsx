import type { Metadata } from "next";
import Link from "next/link";
import { History, Printer, CheckCircle2 } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { apruebaTRD, elabora, gestionaUsuarios } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { listOficinas } from "@/services/oficinas";
import { listUnidades } from "@/services/unidades";
import { getPerfilActual } from "@/services/perfiles";
import { listSeriesPorOficina, listAprobaciones } from "@/services/series";
import {
  ESTADO_TRD_LABELS,
  labelDe,
  type EstadoTrd,
  type Unidad,
} from "@/lib/tipos";
import { FiltroDependencia } from "@/components/filtro-dependencia";
import { ImportadorExcel } from "@/components/importador-excel";
import { TrdJerarquia } from "@/components/trd-jerarquia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  enviarRevision,
  aprobarTRD,
  rechazarTRD,
  importarTRD,
} from "./actions";

export const metadata: Metadata = {
  title: `Tablas de Retención (TRD) — ${APP_NAME}`,
};

const ESTADO_COLOR: Record<EstadoTrd, string> = {
  borrador: "bg-muted text-muted-foreground",
  en_revision: "bg-secondary/15 text-secondary",
  aprobado: "bg-primary/10 text-primary",
  rechazado: "bg-destructive/10 text-destructive",
};

const MSG_CONFIRMACION: Record<string, string> = {
  en_revision: "La TRD fue enviada a revisión.",
  aprobado: "La TRD fue aprobada.",
  rechazado: "La TRD fue rechazada.",
};

export default async function TrdPage({
  searchParams,
}: {
  searchParams: Promise<{ oficina?: string; msg?: string }>;
}) {
  const { oficina, msg } = await searchParams;
  const [rol, perfil, oficinas, unidades] = await Promise.all([
    rolDelUsuario(),
    getPerfilActual(),
    listOficinas(),
    listUnidades(),
  ]);
  const puedeElaborar = elabora(rol);
  const puedeAprobar = apruebaTRD(rol);
  const confirmacion = msg ? MSG_CONFIRMACION[msg] : null;

  // superadmin/rector/administrador ven todos los procesos; el resto queda
  // limitado a su propio proceso (perfil.unidad_id). Es un filtro de UI — la
  // RLS del backend sigue autorizando la escritura por rol.
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
  const oficinaCodigo =
    oficinas.find((o) => o.id === oficinaId)?.codigo ?? "";

  const [series, aprobaciones] = oficinaId
    ? await Promise.all([
        listSeriesPorOficina(oficinaId),
        listAprobaciones(oficinaId),
      ])
    : [[], []];

  const estado: EstadoTrd =
    aprobaciones[0]?.estado ?? series[0]?.estado_aprobacion ?? "borrador";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Tablas de Retención Documental
          </h1>
          <p className="text-sm text-muted-foreground">
            Filtra por Eje → Macroproceso → Proceso → Dependencia para ver y
            elaborar su TRD.
          </p>
        </div>
        {oficinaId && (
          <Link
            href={`/trd/imprimir?oficina=${oficinaId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Printer className="size-4" />
            Exportar PDF
          </Link>
        )}
      </div>

      {puedeElaborar && (
        <ImportadorExcel
          titulo="Carga masiva de TRD"
          descripcion="Sube un Excel con las series/subseries/tipos de una o varias dependencias (cada fila indica el código de su oficina)."
          plantillaHref="/trd/plantilla"
          accion={importarTRD}
        />
      )}

      {confirmacion && (
        <p className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm font-medium text-primary">
          <CheckCircle2 className="size-4" />
          {confirmacion}
        </p>
      )}

      <FiltroDependencia
        unidades={unidadesVisibles}
        oficinas={oficinasVisibles}
        oficinaActual={oficinaId}
        basePath="/trd"
      />

      {!puedeVerTodo && !procesoUsuario ? (
        <p className="text-sm text-muted-foreground">
          Aún no tienes un proceso asignado. Solicita a un administrador que te
          asocie a un proceso para poder ver y elaborar su TRD.
        </p>
      ) : !oficinaId ? (
        <p className="text-sm text-muted-foreground">
          Elige una dependencia para comenzar.
        </p>
      ) : (
        <>
          {/* Barra de aprobación */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Estado de la TRD:</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_COLOR[estado]}`}
              >
                {labelDe(ESTADO_TRD_LABELS, estado)}
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {puedeElaborar && (
                  <form action={enviarRevision}>
                    <input type="hidden" name="oficina_id" value={oficinaId} />
                    <Button type="submit" size="sm" variant="secondary">
                      Enviar a revisión
                    </Button>
                  </form>
                )}
                {puedeAprobar && (
                  <>
                    <form action={aprobarTRD}>
                      <input
                        type="hidden"
                        name="oficina_id"
                        value={oficinaId}
                      />
                      <Button type="submit" size="sm">
                        Aprobar
                      </Button>
                    </form>
                    <form action={rechazarTRD}>
                      <input
                        type="hidden"
                        name="oficina_id"
                        value={oficinaId}
                      />
                      <Button type="submit" size="sm" variant="destructive">
                        Rechazar
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Árbol jerárquico serie → subserie → tipo documental */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Series, subseries y tipos documentales ({series.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrdJerarquia
                oficinaId={oficinaId}
                oficinaCodigo={oficinaCodigo}
                series={series}
                puedeElaborar={puedeElaborar}
                puedeAprobar={puedeAprobar}
              />
            </CardContent>
          </Card>

          {/* Historial */}
          {aprobaciones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="size-4" />
                  Historial de aprobación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {aprobaciones.map((a) => (
                    <li key={a.id} className="flex flex-col gap-0.5 py-2">
                      <span className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[a.estado]}`}
                        >
                          {labelDe(ESTADO_TRD_LABELS, a.estado)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.creado_en).toLocaleString("es-CO")} ·{" "}
                          {a.autor ?? "—"}
                        </span>
                      </span>
                      {a.comentario && (
                        <span className="text-muted-foreground">
                          {a.comentario}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
