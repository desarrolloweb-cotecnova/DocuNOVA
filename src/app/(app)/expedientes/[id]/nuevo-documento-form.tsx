"use client";

import { useState } from "react";
import type { TipoDocumento } from "@/lib/documentos";
import { crearDocumento } from "./actions";

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

/**
 * Formulario para agregar un documento a un expediente. Alterna entre los
 * campos de ubicación física y el contenido electrónico según el tipo elegido.
 */
export function NuevoDocumentoForm({ expedienteId }: { expedienteId: string }) {
  const [tipo, setTipo] = useState<TipoDocumento>("fisico");

  return (
    <form action={crearDocumento} className="space-y-4">
      <input type="hidden" name="expediente_id" value={expedienteId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tipo
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoDocumento)}
            className={inputCls}
          >
            <option value="fisico">Físico</option>
            <option value="electronico">Electrónico</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Fecha del documento
          <input type="date" name="fecha_documento" className={inputCls} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Título
        <input name="titulo" required className={inputCls} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Descripción
        <textarea name="descripcion" rows={2} className={inputCls} />
      </label>

      {tipo === "fisico" ? (
        <fieldset className="space-y-4 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Ubicación física</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              Caja
              <input name="caja" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Estante
              <input name="estante" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Carpeta
              <input name="carpeta" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Folio inicial
              <input
                type="number"
                name="folio_inicial"
                min={1}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Folio final
              <input
                type="number"
                name="folio_final"
                min={1}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Estado de conservación
              <input name="estado_conservacion" className={inputCls} />
            </label>
          </div>
        </fieldset>
      ) : (
        <fieldset className="space-y-2 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">
            Contenido electrónico
          </legend>
          <textarea
            name="contenido"
            rows={6}
            className={inputCls}
            placeholder="Escribe aquí el contenido del documento. Será buscable por texto."
          />
        </fieldset>
      )}

      <button
        type="submit"
        className="rounded-md bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:opacity-90"
      >
        Agregar documento
      </button>
    </form>
  );
}
