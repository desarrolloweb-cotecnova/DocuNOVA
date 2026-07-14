import { Plus, Pencil, Trash2 } from "lucide-react";
import { SubmitButton, SubmitIcon } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Serie } from "@/lib/tipos";
import { EtiquetaNivel } from "@/components/nivel-serie";

/** Etiquetas de disposición final en el orden en que se muestran. */
const DISPOSICIONES: { campo: keyof Serie; label: string }[] = [
  { campo: "disp_conservacion", label: "Conservación" },
  { campo: "disp_seleccion", label: "Selección" },
  { campo: "disp_eliminacion", label: "Eliminación" },
  { campo: "disp_digital", label: "Digitalización" },
];
import {
  crearSerie,
  actualizarSerie,
  eliminarSerie,
} from "@/app/(app)/trd/actions";

/**
 * Árbol jerárquico de la TRD de una oficina: serie → subserie → tipo
 * documental, con acciones "Agregar" contextuales en cada nivel y "Editar"
 * por nodo. Sigue el patrón de EstructuraGestion (Server Component, sin
 * estado de cliente; formularios <details> + <form action={serverAction}>).
 *
 * Reusa las server actions actuales; el nivel y el padre_id viajan por
 * <input type="hidden"> según el contexto del formulario, así el select de
 * nivel del anterior "Nueva entrada de TRD" desaparece.
 */
export function TrdJerarquia({
  oficinaId,
  oficinaCodigo,
  series,
  puedeElaborar,
  puedeAprobar,
}: {
  oficinaId: string;
  oficinaCodigo: string;
  series: Serie[];
  puedeElaborar: boolean;
  puedeAprobar: boolean;
}) {
  const orden = (a: Serie, b: Serie) => a.codigo.localeCompare(b.codigo);
  const seriesRaiz = series.filter((s) => s.nivel === "serie").sort(orden);
  const subseries = series.filter((s) => s.nivel === "subserie");
  const tipos = series.filter((s) => s.nivel === "tipo");

  return (
    <div className="flex flex-col gap-4">
      {puedeElaborar && (
        <details>
          <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <Plus className="size-4" />
            Agregar serie
          </summary>
          <div className="mt-2">
            <FormNodoTRD
              oficinaId={oficinaId}
              nivel="serie"
              codigoSugerido={`${oficinaCodigo}.`}
            />
          </div>
        </details>
      )}

      {seriesRaiz.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Esta dependencia aún no tiene entradas de TRD. Usa «Agregar serie»
          para empezar.
        </p>
      )}

      {seriesRaiz.map((serie) => (
        <div
          key={serie.id}
          className="rounded-lg border border-primary/30 bg-primary/10"
        >
          <Nodo
            unidad={serie}
            oficinaId={oficinaId}
            puedeElaborar={puedeElaborar}
            puedeAprobar={puedeAprobar}
          />

          <div className="space-y-2 border-t border-primary/25 bg-primary/5 p-3 pl-6">
            {subseries
              .filter((s) => s.padre_id === serie.id)
              .sort(orden)
              .map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-md border border-primary/25 bg-card"
                >
                  <Nodo
                    unidad={sub}
                    oficinaId={oficinaId}
                    puedeElaborar={puedeElaborar}
                    puedeAprobar={puedeAprobar}
                  />

                  <div className="space-y-2 border-t border-primary/20 bg-primary/[0.04] p-3 pl-6">
                    {tipos
                      .filter((t) => t.padre_id === sub.id)
                      .sort(orden)
                      .map((tipo) => (
                        <div
                          key={tipo.id}
                          className="rounded-md border border-primary/20 bg-card"
                        >
                          <Nodo
                            unidad={tipo}
                            oficinaId={oficinaId}
                            puedeElaborar={puedeElaborar}
                            puedeAprobar={puedeAprobar}
                          />
                        </div>
                      ))}
                    {puedeElaborar && (
                      <details>
                        <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                          <Plus className="size-3.5" />
                          Agregar tipo documental
                        </summary>
                        <div className="mt-2">
                          <FormNodoTRD
                            oficinaId={oficinaId}
                            nivel="tipo"
                            padreId={sub.id}
                            codigoSugerido={`${sub.codigo}.`}
                          />
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            {puedeElaborar && (
              <details>
                <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <Plus className="size-3.5" />
                  Agregar subserie
                </summary>
                <div className="mt-2">
                  <FormNodoTRD
                    oficinaId={oficinaId}
                    nivel="subserie"
                    padreId={serie.id}
                    codigoSugerido={`${serie.codigo}.`}
                  />
                </div>
              </details>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Nodo({
  unidad,
  oficinaId,
  puedeElaborar,
  puedeAprobar,
}: {
  unidad: Serie;
  oficinaId: string;
  puedeElaborar: boolean;
  puedeAprobar: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <EtiquetaNivel nivel={unidad.nivel} />
          <span>
            <span className="font-medium">{unidad.codigo}</span> ·{" "}
            {unidad.nombre}
          </span>
        </span>
        {puedeAprobar && (
          <form action={eliminarSerie}>
            <input type="hidden" name="id" value={unidad.id} />
            <SubmitIcon
              aria-label="Eliminar entrada"
              title={
                unidad.nivel === "tipo"
                  ? "Eliminar este tipo documental"
                  : "Elimina también sus subseries y tipos documentales"
              }
              confirmar={
                unidad.nivel === "tipo"
                  ? `¿Eliminar "${unidad.codigo} · ${unidad.nombre}"?`
                  : `¿Eliminar "${unidad.codigo} · ${unidad.nombre}" y todas sus subseries y tipos documentales?`
              }
              exito="Entrada eliminada."
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </SubmitIcon>
          </form>
        )}
      </div>

      {unidad.nivel === "subserie" && <ResumenTRD unidad={unidad} />}

      {puedeElaborar && (
        <details className="text-sm">
          <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Pencil className="size-3.5" />
            Editar
          </summary>
          <div className="mt-2">
            <FormNodoTRD
              oficinaId={oficinaId}
              nivel={unidad.nivel}
              padreId={unidad.padre_id ?? undefined}
              serie={unidad}
            />
          </div>
        </details>
      )}
    </div>
  );
}

function FormNodoTRD({
  oficinaId,
  nivel,
  padreId,
  serie,
  codigoSugerido,
}: {
  oficinaId: string;
  nivel: Serie["nivel"];
  padreId?: string;
  serie?: Serie;
  codigoSugerido?: string;
}) {
  // La retención, el soporte y la disposición se diligencian a nivel de
  // subserie; series y tipos documentales solo llevan código y nombre.
  const esSubserie = nivel === "subserie";
  return (
    <form
      action={serie ? actualizarSerie : crearSerie}
      className="grid gap-3 rounded-md border border-primary/20 bg-background p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="oficina_id" value={oficinaId} />
      <input type="hidden" name="nivel" value={nivel} />
      {padreId ? <input type="hidden" name="padre_id" value={padreId} /> : null}
      {serie && <input type="hidden" name="id" value={serie.id} />}

      <div className="flex flex-col gap-1">
        <Label>Código</Label>
        <Input
          name="codigo"
          defaultValue={serie?.codigo ?? codigoSugerido ?? ""}
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Nombre</Label>
        <Input name="nombre" defaultValue={serie?.nombre ?? ""} required />
      </div>

      {esSubserie && (
        <>
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
          <fieldset className="flex flex-wrap gap-3 rounded-md border border-input p-3 sm:col-span-2">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Tipo de soporte
            </legend>
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
          </fieldset>
          <fieldset className="flex flex-wrap gap-3 rounded-md border border-input p-3 sm:col-span-2">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Disposición final
            </legend>
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
        </>
      )}
      <div className="sm:col-span-2">
        <SubmitButton
          size="sm"
          textoPendiente="Guardando…"
          exito={serie ? "Entrada actualizada." : "Entrada agregada."}
        >
          {serie ? "Guardar cambios" : "Agregar"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Resumen de retención, soporte y disposición de una subserie o tipo. */
function ResumenTRD({ unidad }: { unidad: Serie }) {
  const soportes = [
    unidad.soporte_fisico && "Físico",
    unidad.soporte_digital && "Digital",
  ].filter(Boolean);
  const disposiciones = DISPOSICIONES.filter((d) => unidad[d.campo]).map(
    (d) => d.label,
  );
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <div className="flex gap-1">
        <dt className="font-medium">Años en gestión:</dt>
        <dd>{unidad.anios_gestion ?? "—"}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="font-medium">Años en central:</dt>
        <dd>{unidad.anios_central ?? "—"}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="font-medium">Soporte:</dt>
        <dd>{soportes.length ? soportes.join(", ") : "—"}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="font-medium">Disposición final:</dt>
        <dd>{disposiciones.length ? disposiciones.join(", ") : "—"}</dd>
      </div>
    </dl>
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
