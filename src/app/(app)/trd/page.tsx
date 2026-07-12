import type { Metadata } from "next";
import { Pencil, Trash2, History } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { apruebaTRD, elabora } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { listOficinas } from "@/services/oficinas";
import { listSeriesPorOficina, listAprobaciones } from "@/services/series";
import {
  ESTADO_TRD_LABELS,
  NIVELES_SERIE,
  NIVEL_SERIE_ICON,
  NIVEL_SERIE_LABELS,
  labelDe,
  type EstadoTrd,
  type Serie,
} from "@/lib/tipos";
import { OficinaSelector } from "@/components/oficina-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  crearSerie,
  actualizarSerie,
  eliminarSerie,
  enviarRevision,
  aprobarTRD,
  rechazarTRD,
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

export default async function TrdPage({
  searchParams,
}: {
  searchParams: Promise<{ oficina?: string }>;
}) {
  const { oficina } = await searchParams;
  const [rol, oficinas] = await Promise.all([rolDelUsuario(), listOficinas()]);
  const puedeElaborar = elabora(rol);
  const puedeAprobar = apruebaTRD(rol);

  const oficinaId =
    oficina && oficinas.some((o) => o.id === oficina) ? oficina : null;

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
      <div>
        <h1 className="text-xl font-semibold">
          Tablas de Retención Documental
        </h1>
        <p className="text-sm text-muted-foreground">
          Selecciona una dependencia para ver y elaborar su TRD.
        </p>
      </div>

      <OficinaSelector oficinas={oficinas} actual={oficinaId} basePath="/trd" />

      {!oficinaId ? (
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

          {/* Árbol de series */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Series documentales ({series.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {series.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta dependencia aún no tiene entradas de TRD.
                </p>
              ) : (
                series.map((s) => (
                  <div key={s.id} className="rounded-md border">
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <span
                        className="text-sm"
                        style={{
                          paddingLeft:
                            s.nivel === "subserie"
                              ? 16
                              : s.nivel === "tipo"
                                ? 32
                                : 0,
                        }}
                      >
                        {NIVEL_SERIE_ICON[s.nivel]}{" "}
                        <span className="font-medium">{s.codigo}</span>{" "}
                        {s.nombre}
                      </span>
                      {puedeAprobar && (
                        <form action={eliminarSerie}>
                          <input type="hidden" name="id" value={s.id} />
                          <button
                            type="submit"
                            aria-label="Eliminar entrada"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </form>
                      )}
                    </div>
                    {puedeElaborar && (
                      <details className="border-t px-3 py-2 text-sm">
                        <summary className="flex cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-foreground">
                          <Pencil className="size-3.5" />
                          Editar
                        </summary>
                        <div className="mt-3">
                          <FormularioSerie
                            oficinaId={oficinaId}
                            accion={actualizarSerie}
                            serie={s}
                          />
                        </div>
                      </details>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Nueva entrada */}
          {puedeElaborar && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Nueva entrada de TRD
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormularioSerie oficinaId={oficinaId} accion={crearSerie} />
              </CardContent>
            </Card>
          )}

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

function FormularioSerie({
  oficinaId,
  accion,
  serie,
}: {
  oficinaId: string;
  accion: (formData: FormData) => void;
  serie?: Serie;
}) {
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="oficina_id" value={oficinaId} />
      {serie && <input type="hidden" name="id" value={serie.id} />}
      <div className="flex flex-col gap-1">
        <Label>Código</Label>
        <Input name="codigo" defaultValue={serie?.codigo ?? ""} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Nivel</Label>
        <select
          name="nivel"
          defaultValue={serie?.nivel ?? "serie"}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {NIVELES_SERIE.map((n) => (
            <option key={n} value={n}>
              {NIVEL_SERIE_LABELS[n]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label>Nombre</Label>
        <Input name="nombre" defaultValue={serie?.nombre ?? ""} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Años en gestión</Label>
        <Input
          name="anios_gestion"
          type="number"
          min="0"
          defaultValue={serie?.anios_gestion ?? ""}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Años en central</Label>
        <Input
          name="anios_central"
          type="number"
          min="0"
          defaultValue={serie?.anios_central ?? ""}
        />
      </div>
      <fieldset className="flex flex-wrap gap-3 sm:col-span-2">
        <Casilla
          name="soporte_fisico"
          label="Soporte físico"
          on={serie?.soporte_fisico}
        />
        <Casilla
          name="soporte_digital"
          label="Soporte digital"
          on={serie?.soporte_digital}
        />
        <Casilla
          name="disp_conservacion"
          label="Conservación"
          on={serie?.disp_conservacion}
        />
        <Casilla
          name="disp_seleccion"
          label="Selección"
          on={serie?.disp_seleccion}
        />
        <Casilla
          name="disp_eliminacion"
          label="Eliminación"
          on={serie?.disp_eliminacion}
        />
        <Casilla
          name="disp_digital"
          label="Digitalización"
          on={serie?.disp_digital}
        />
      </fieldset>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label>Procedimiento</Label>
        <textarea
          name="procedimiento"
          defaultValue={serie?.procedimiento ?? ""}
          rows={2}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">
          {serie ? "Guardar cambios" : "Crear entrada"}
        </Button>
      </div>
    </form>
  );
}

function Casilla({
  name,
  label,
  on,
}: {
  name: string;
  label: string;
  on?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <input type="checkbox" name={name} value="1" defaultChecked={on} />
      {label}
    </label>
  );
}
