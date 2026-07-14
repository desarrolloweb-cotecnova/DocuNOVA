import { Plus, FileText } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TIPOS_DOCUMENTO,
  TIPO_DOCUMENTO_LABELS,
  ESTADO_DOCUMENTO_LABELS,
  labelDe,
  type Serie,
} from "@/lib/tipos";
import type { DocumentoListado } from "@/services/documentos";
import { EtiquetaNivel } from "@/components/nivel-serie";
import { crearDocumento } from "@/app/(app)/documentos/actions";

/**
 * Árbol de la TRD (serie → subserie → tipo) del módulo de Documentos. Frente a
 * cada subserie y tipo ofrece «Agregar documento» para crear un documento ya
 * asociado a ese nodo. La creación solo se habilita si la TRD de la dependencia
 * está aprobada. Server Component (sin estado de cliente; <details> + <form>).
 */
export function DocumentosArbol({
  oficinaId,
  series,
  documentos,
  trdAprobada,
  puedeElaborar,
}: {
  oficinaId: string;
  series: Serie[];
  documentos: DocumentoListado[];
  trdAprobada: boolean;
  puedeElaborar: boolean;
}) {
  const orden = (a: Serie, b: Serie) => a.codigo.localeCompare(b.codigo);
  const seriesRaiz = series.filter((s) => s.nivel === "serie").sort(orden);
  const subseries = series.filter((s) => s.nivel === "subserie");
  const tipos = series.filter((s) => s.nivel === "tipo");
  const docsDe = (serieId: string) =>
    documentos.filter((d) => d.serie_id === serieId);
  const puedeCrear = puedeElaborar && trdAprobada;

  if (seriesRaiz.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta dependencia aún no tiene series en su TRD.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!trdAprobada && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          La TRD de esta dependencia debe estar <strong>aprobada</strong> para
          poder crear documentos asociados.
        </p>
      )}

      {seriesRaiz.map((serie) => (
        <div
          key={serie.id}
          className="rounded-lg border border-primary/30 bg-primary/10"
        >
          <NodoDoc unidad={serie} docs={docsDe(serie.id)} />

          <div className="space-y-2 border-t border-primary/25 bg-primary/5 p-3 pl-6">
            {subseries
              .filter((s) => s.padre_id === serie.id)
              .sort(orden)
              .map((sub) => (
                <div
                  key={sub.id}
                  className="rounded-md border border-primary/25 bg-card"
                >
                  <NodoDoc
                    unidad={sub}
                    docs={docsDe(sub.id)}
                    oficinaId={oficinaId}
                    puedeCrear={puedeCrear}
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
                          <NodoDoc
                            unidad={tipo}
                            docs={docsDe(tipo.id)}
                            oficinaId={oficinaId}
                            puedeCrear={puedeCrear}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NodoDoc({
  unidad,
  docs,
  oficinaId,
  puedeCrear,
}: {
  unidad: Serie;
  docs: DocumentoListado[];
  oficinaId?: string;
  puedeCrear?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <EtiquetaNivel nivel={unidad.nivel} />
        <span>
          <span className="font-medium">{unidad.codigo}</span> · {unidad.nombre}
        </span>
      </span>

      {docs.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-1.5">
              <FileText className="size-3.5 shrink-0" />
              <span>{d.nombre}</span>
              <span className="text-[10px]">
                · {labelDe(ESTADO_DOCUMENTO_LABELS, d.estado)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {oficinaId && puedeCrear && (
        <details className="text-sm">
          <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <Plus className="size-3.5" />
            Agregar documento
          </summary>
          <FormDocumento oficinaId={oficinaId} serieId={unidad.id} />
        </details>
      )}
    </div>
  );
}

function FormDocumento({
  oficinaId,
  serieId,
}: {
  oficinaId: string;
  serieId: string;
}) {
  return (
    <form action={crearDocumento} className="mt-2 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="oficina_id" value={oficinaId} />
      <input type="hidden" name="serie_id" value={serieId} />
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label>Nombre</Label>
        <Input name="nombre" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Código</Label>
        <Input name="codigo" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Tipo</Label>
        <select
          name="tipo"
          defaultValue="diligenciable"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t} value={t}>
              {TIPO_DOCUMENTO_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label>URL de plantilla</Label>
        <Input name="url_plantilla" placeholder="https://…" />
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="es_publico" value="1" />
          Público
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="requiere_descarga" value="1" />
          Requiere descarga
        </label>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton size="sm" textoPendiente="Creando…" exito="Documento creado.">
          Crear documento
        </SubmitButton>
      </div>
    </form>
  );
}
