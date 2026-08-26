"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Info, Pencil, ExternalLink } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS, formatoTamano } from "@/components/memoria-campos";
import {
  actualizarDocumento,
  type ResultadoCarga,
} from "@/app/(app)/memoria/actions";
import {
  CATEGORIA_MEMORIA_LABELS,
  ESTADO_MEMORIA_LABELS,
  VISIBILIDADES_MEMORIA,
  VISIBILIDAD_MEMORIA_LABELS,
  labelDe,
  type MemoriaComponente,
} from "@/lib/tipos";
import type { MemoriaDocumentoListado } from "@/services/memoria";

const BOTON =
  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent";

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

/** Fila "etiqueta / valor" de la ficha de detalle. */
function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="text-xs text-muted-foreground sm:w-44 sm:shrink-0">
        {etiqueta}
      </dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  );
}

/**
 * Acciones de un documento de Memoria Corporativa: visualizar el archivo, ver
 * la ficha completa del registro y editar sus datos. Se usa en las cuatro
 * memorias (histórica, gobierno, activa y banco de proyectos).
 */
export function MemoriaAcciones({
  doc,
  componentes,
  procesos,
  rutaProceso,
  puedeEditar,
}: {
  doc: MemoriaDocumentoListado;
  componentes: MemoriaComponente[];
  procesos: { id: string; ruta: string }[];
  rutaProceso: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<"detalle" | "editar" | null>(null);
  const [estado, setEstado] = useState<ResultadoCarga | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setGuardando(true);
    const resultado = await actualizarDocumento(
      { ok: false, mensaje: "" },
      datos,
    );
    setGuardando(false);
    setEstado(resultado);
    if (resultado.ok) {
      router.refresh();
      setAbierto(null);
    }
  }

  return (
    <>
      <a
        href={`/memoria/descargar/${doc.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className={BOTON}
        title="Abrir el archivo"
      >
        <Eye className="size-3.5" />
        Visualizar
      </a>

      <button
        type="button"
        onClick={() => setAbierto("detalle")}
        className={BOTON}
        title="Ver toda la información del registro"
      >
        <Info className="size-3.5" />
        Detalle
      </button>

      {puedeEditar && (
        <button
          type="button"
          onClick={() => {
            setEstado(null);
            setAbierto("editar");
          }}
          className={BOTON}
          title="Editar los datos del documento"
        >
          <Pencil className="size-3.5" />
          Editar
        </button>
      )}

      {abierto === "detalle" && (
        <Modal titulo={doc.titulo} onCerrar={() => setAbierto(null)}>
          <dl className="flex flex-col">
            <Dato etiqueta="Título">{doc.titulo}</Dato>
            <Dato etiqueta="Descripción">{doc.descripcion ?? "—"}</Dato>
            <Dato etiqueta="Memoria">
              {CATEGORIA_MEMORIA_LABELS[doc.categoria]}
            </Dato>
            <Dato etiqueta="Componente">{doc.componente_nombre ?? "—"}</Dato>
            <Dato etiqueta="Proceso">{rutaProceso ?? "—"}</Dato>
            <Dato etiqueta="Visibilidad">
              {VISIBILIDAD_MEMORIA_LABELS[doc.visibilidad]}
            </Dato>
            <Dato etiqueta="Estado">
              {labelDe(ESTADO_MEMORIA_LABELS, doc.estado)}
            </Dato>
            {doc.comentario_revision && (
              <Dato etiqueta="Motivo del rechazo">
                {doc.comentario_revision}
              </Dato>
            )}
            <Dato etiqueta="Archivo">{doc.archivo_nombre}</Dato>
            <Dato etiqueta="Formato">
              <span className="uppercase">{doc.archivo_tipo ?? "—"}</span>
              {" · "}
              {formatoTamano(doc.archivo_tamano) || "—"}
            </Dato>
            <Dato etiqueta="Almacenamiento">
              {doc.drive_file_id ? (
                <span className="inline-flex items-center gap-2">
                  Google Drive institucional
                  {doc.drive_enlace && (
                    <a
                      href={doc.drive_enlace}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Abrir en Drive <ExternalLink className="size-3" />
                    </a>
                  )}
                </span>
              ) : (
                "Supabase Storage (bucket «memoria»)"
              )}
            </Dato>
            <Dato etiqueta="Cargado por">{doc.cargador_nombre ?? "—"}</Dato>
            <Dato etiqueta="Fecha de carga">{fechaLarga(doc.creado_en)}</Dato>
            <Dato etiqueta="Revisado por">{doc.aprobador_nombre ?? "—"}</Dato>
            <Dato etiqueta="Última actualización">
              {fechaLarga(doc.actualizado_en)}
            </Dato>
            <Dato etiqueta="Identificador">
              <code className="text-xs">{doc.id}</code>
            </Dato>
          </dl>

          <div className="mt-4 flex justify-end gap-2">
            <a
              href={`/memoria/descargar/${doc.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={BOTON}
            >
              <Eye className="size-3.5" />
              Visualizar
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAbierto(null)}
            >
              Cerrar
            </Button>
          </div>
        </Modal>
      )}

      {abierto === "editar" && (
        <Modal
          titulo={`Editar «${doc.titulo}»`}
          onCerrar={() => setAbierto(null)}
        >
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={doc.id} />
            <input type="hidden" name="categoria" value={doc.categoria} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`ed-titulo-${doc.id}`}>Título</Label>
              <Input
                id={`ed-titulo-${doc.id}`}
                name="titulo"
                required
                maxLength={200}
                defaultValue={doc.titulo}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`ed-desc-${doc.id}`}>Descripción</Label>
              <textarea
                id={`ed-desc-${doc.id}`}
                name="descripcion"
                rows={3}
                maxLength={500}
                defaultValue={doc.descripcion ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`ed-comp-${doc.id}`}>Componente</Label>
              <select
                id={`ed-comp-${doc.id}`}
                name="componente_id"
                required
                defaultValue={doc.componente_id ?? ""}
                className={`${SELECT_CLASS} w-full px-3`}
              >
                <option value="" disabled>
                  Selecciona un componente…
                </option>
                {componentes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`ed-proc-${doc.id}`}>Proceso</Label>
              <select
                id={`ed-proc-${doc.id}`}
                name="unidad_id"
                required
                defaultValue={doc.unidad_id ?? ""}
                className={`${SELECT_CLASS} w-full px-3`}
              >
                <option value="" disabled>
                  Selecciona el proceso…
                </option>
                {procesos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ruta}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`ed-vis-${doc.id}`}>Visibilidad</Label>
              <select
                id={`ed-vis-${doc.id}`}
                name="visibilidad"
                defaultValue={doc.visibilidad}
                className={`${SELECT_CLASS} w-full px-3`}
              >
                {VISIBILIDADES_MEMORIA.map((v) => (
                  <option key={v} value={v}>
                    {VISIBILIDAD_MEMORIA_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-muted-foreground">
              El archivo cargado no se modifica. Para reemplazarlo, carga un
              documento nuevo y elimina este.
            </p>

            {estado && !estado.ok && estado.mensaje && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                {estado.mensaje}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAbierto(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
