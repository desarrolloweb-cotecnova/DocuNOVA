"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Eye,
  Trash2,
  Lock,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpAZ,
  ArrowDownAZ,
} from "lucide-react";
import { SubmitButton, SubmitIcon } from "@/components/ui/submit-button";
import {
  publicarDocumento,
  rechazarDocumento,
  eliminarDocumento,
} from "@/app/(app)/memoria/actions";
import {
  ESTADO_MEMORIA_LABELS,
  VISIBILIDADES_MEMORIA,
  VISIBILIDAD_MEMORIA_LABELS,
  labelDe,
  type EstadoMemoria,
  type MemoriaComponente,
  type Unidad,
} from "@/lib/tipos";
import type { MemoriaDocumentoListado } from "@/services/memoria";

const ESTADO_COLOR: Record<EstadoMemoria, string> = {
  pendiente: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  publicado: "bg-primary/10 text-primary",
  rechazado: "bg-destructive/10 text-destructive",
};

const ESTADO_ICON: Record<EstadoMemoria, typeof Clock> = {
  pendiente: Clock,
  publicado: CheckCircle2,
  rechazado: XCircle,
};

function formatoTamano(bytes: number | null): string {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Listado de documentos de una memoria con filtros (componente, visibilidad),
 * ordenamiento por título y acciones (visualizar, publicar/rechazar y eliminar).
 */
export function MemoriaLista({
  documentos,
  componentes,
  unidades,
  puedeAprobar,
  puedeEliminar,
}: {
  documentos: MemoriaDocumentoListado[];
  componentes: MemoriaComponente[];
  unidades: Unidad[];
  puedeAprobar: boolean;
  puedeEliminar: boolean;
}) {
  const [componenteId, setComponenteId] = useState("");
  const [visibilidad, setVisibilidad] = useState("");
  const [ejeId, setEjeId] = useState("");
  const [macroId, setMacroId] = useState("");
  const [procId, setProcId] = useState("");
  const [ascendente, setAscendente] = useState(true);

  const porId = useMemo(
    () => new Map(unidades.map((u) => [u.id, u] as const)),
    [unidades],
  );
  const ejes = useMemo(
    () => unidades.filter((u) => u.tipo === "eje"),
    [unidades],
  );
  const macros = useMemo(
    () => unidades.filter((u) => u.tipo === "macroproceso"),
    [unidades],
  );
  const procesos = useMemo(
    () => unidades.filter((u) => u.tipo === "proceso"),
    [unidades],
  );
  const macrosDelEje = ejeId
    ? macros.filter((m) => m.padre_id === ejeId)
    : macros;
  const procesosDelMacro = macroId
    ? procesos.filter((p) => p.padre_id === macroId)
    : procesos;

  /** Ruta jerárquica (eje/macro/proceso ids + nombre del proceso) de un documento. */
  const rutaDe = (unidadId: string | null) => {
    const proc = unidadId ? porId.get(unidadId) : undefined;
    const macro = proc?.padre_id ? porId.get(proc.padre_id) : undefined;
    const eje = macro?.padre_id ? porId.get(macro.padre_id) : undefined;
    return {
      procId: proc?.id ?? "",
      macroId: macro?.id ?? "",
      ejeId: eje?.id ?? "",
      nombre: proc?.nombre ?? null,
    };
  };

  const visibles = useMemo(() => {
    const filtrados = documentos.filter((d) => {
      const r = rutaDe(d.unidad_id);
      return (
        (componenteId === "" || d.componente_id === componenteId) &&
        (visibilidad === "" || d.visibilidad === visibilidad) &&
        (ejeId === "" || r.ejeId === ejeId) &&
        (macroId === "" || r.macroId === macroId) &&
        (procId === "" || r.procId === procId)
      );
    });
    return filtrados.sort((a, b) => {
      const cmp = a.titulo.localeCompare(b.titulo, "es", {
        sensitivity: "base",
      });
      return ascendente ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documentos,
    componenteId,
    visibilidad,
    ejeId,
    macroId,
    procId,
    ascendente,
    porId,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Componente
          <select
            value={componenteId}
            onChange={(e) => setComponenteId(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Todos</option>
            {componentes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Visibilidad
          <select
            value={visibilidad}
            onChange={(e) => setVisibilidad(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Todas</option>
            {VISIBILIDADES_MEMORIA.map((v) => (
              <option key={v} value={v}>
                {VISIBILIDAD_MEMORIA_LABELS[v]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Eje
          <select
            value={ejeId}
            onChange={(e) => {
              setEjeId(e.target.value);
              setMacroId("");
              setProcId("");
            }}
            className={SELECT_CLASS}
          >
            <option value="">Todos</option>
            {ejes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Macroproceso
          <select
            value={macroId}
            onChange={(e) => {
              setMacroId(e.target.value);
              setProcId("");
            }}
            disabled={!ejeId}
            className={`${SELECT_CLASS} disabled:opacity-60`}
          >
            <option value="">Todos</option>
            {macrosDelEje.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Proceso
          <select
            value={procId}
            onChange={(e) => setProcId(e.target.value)}
            disabled={!macroId}
            className={`${SELECT_CLASS} disabled:opacity-60`}
          >
            <option value="">Todos</option>
            {procesosDelMacro.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setAscendente((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent"
          title="Ordenar por título"
        >
          {ascendente ? (
            <ArrowUpAZ className="size-4" />
          ) : (
            <ArrowDownAZ className="size-4" />
          )}
          Título
        </button>

        <span className="ml-auto text-xs text-muted-foreground">
          {visibles.length} de {documentos.length}
        </span>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay documentos que coincidan con el filtro.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2">Documento</th>
                <th className="pb-2">Componente</th>
                <th className="pb-2">Proceso</th>
                <th className="pb-2">Visibilidad</th>
                <th className="pb-2">Cargado por</th>
                <th className="pb-2">Fecha</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibles.map((d) => {
                const EstadoIcon = ESTADO_ICON[d.estado];
                return (
                  <tr key={d.id} className="align-top">
                    <td className="py-3">
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="font-medium">{d.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="uppercase">{d.archivo_tipo}</span>
                            {d.archivo_tamano
                              ? ` · ${formatoTamano(d.archivo_tamano)}`
                              : ""}
                          </p>
                          {d.estado === "rechazado" &&
                            d.comentario_revision && (
                              <p className="text-xs text-destructive">
                                Motivo: {d.comentario_revision}
                              </p>
                            )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {d.componente_nombre ?? "—"}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {rutaDe(d.unidad_id).nombre ?? "—"}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {d.visibilidad === "privado" ? (
                          <>
                            <Lock className="size-3" /> Privado
                          </>
                        ) : (
                          <>
                            <Globe className="size-3" /> Público
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {d.cargador_nombre ?? "—"}
                    </td>
                    <td className="py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(d.creado_en).toLocaleDateString("es-CO")}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[d.estado]}`}
                      >
                        <EstadoIcon className="size-3" />
                        {labelDe(ESTADO_MEMORIA_LABELS, d.estado)}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/memoria/descargar/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent"
                          title="Visualizar"
                        >
                          <Eye className="size-3.5" />
                          Visualizar
                        </a>

                        {puedeAprobar && d.estado !== "publicado" && (
                          <form action={publicarDocumento}>
                            <input type="hidden" name="id" value={d.id} />
                            <SubmitButton
                              size="sm"
                              textoPendiente="Publicando…"
                              exito="Documento publicado."
                            >
                              Publicar
                            </SubmitButton>
                          </form>
                        )}

                        {puedeAprobar && d.estado === "pendiente" && (
                          <form action={rechazarDocumento}>
                            <input type="hidden" name="id" value={d.id} />
                            <SubmitButton
                              size="sm"
                              variant="destructive"
                              textoPendiente="Rechazando…"
                              confirmar="¿Rechazar este documento?"
                              exito="Documento rechazado."
                            >
                              Rechazar
                            </SubmitButton>
                          </form>
                        )}

                        {puedeEliminar && (
                          <form action={eliminarDocumento}>
                            <input type="hidden" name="id" value={d.id} />
                            <SubmitIcon
                              aria-label="Eliminar documento"
                              confirmar={`¿Eliminar "${d.titulo}"? Esta acción no se puede deshacer.`}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
