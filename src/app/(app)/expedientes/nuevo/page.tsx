import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { ESTADOS_EXPEDIENTE, estadoExpedienteLabel } from "@/lib/documentos";
import { loadSubserieOptions } from "../subserie-options";
import { crearExpediente } from "../actions";

export const metadata: Metadata = {
  title: `Nuevo expediente — ${APP_NAME}`,
};

export default async function NuevoExpedientePage() {
  const opciones = await loadSubserieOptions();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/expedientes"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Expedientes
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo expediente</h1>
        <p className="text-muted-foreground">
          El proceso y la oficina se asignan automáticamente según la subserie.
        </p>
      </div>

      {opciones.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No hay subseries de la TRD disponibles para tu proceso. Pide al
          administrador de archivo que configure la clasificación documental de
          tu proceso.
        </p>
      ) : (
        <form action={crearExpediente} className="space-y-4">
          <Campo label="Título" htmlFor="titulo">
            <input
              id="titulo"
              name="titulo"
              required
              className={inputCls}
              placeholder="Ej. Contratos de prestación de servicios 2026"
            />
          </Campo>

          <Campo label="Subserie (TRD)" htmlFor="subserie_id">
            <select
              id="subserie_id"
              name="subserie_id"
              required
              className={inputCls}
            >
              <option value="">Selecciona una subserie…</option>
              {opciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Estado" htmlFor="estado">
            <select id="estado" name="estado" className={inputCls}>
              {ESTADOS_EXPEDIENTE.map((e) => (
                <option key={e} value={e}>
                  {estadoExpedienteLabel(e)}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Descripción (opcional)" htmlFor="descripcion">
            <textarea
              id="descripcion"
              name="descripcion"
              rows={3}
              className={inputCls}
            />
          </Campo>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:opacity-90"
            >
              Crear expediente
            </button>
            <Link
              href="/expedientes"
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Campo({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
