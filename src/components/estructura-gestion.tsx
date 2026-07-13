import { Trash2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Unidad } from "@/lib/tipos";
import {
  crearUnidad,
  actualizarUnidad,
  eliminarUnidad,
} from "@/app/(app)/gestion/actions";

/**
 * Árbol de la estructura organizacional (eje → macroproceso → proceso) con CRUD.
 * Componente de servidor: usa <details> + <form action={serverAction}>, sin
 * estado de cliente. La edición cambia código y nombre.
 */
export function EstructuraGestion({
  unidades,
  unidadesConOficina,
}: {
  unidades: Unidad[];
  unidadesConOficina: string[];
}) {
  const orden = (a: Unidad, b: Unidad) => a.codigo.localeCompare(b.codigo);
  const ejes = unidades.filter((u) => u.tipo === "eje").sort(orden);
  const macros = unidades.filter((u) => u.tipo === "macroproceso").sort(orden);
  const procesos = unidades.filter((u) => u.tipo === "proceso").sort(orden);

  const conHijos = new Set(
    unidades.map((u) => u.padre_id).filter((x): x is string => Boolean(x)),
  );
  const conOficina = new Set(unidadesConOficina);

  function puedeEliminar(u: Unidad): boolean {
    if (u.tipo === "proceso") return !conOficina.has(u.id);
    return !conHijos.has(u.id);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Agregar eje */}
      <details>
        <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <Plus className="size-4" />
          Agregar eje
        </summary>
        <div className="mt-2">
          <FormUnidad tipo="eje" />
        </div>
      </details>

      {ejes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aún no hay ejes. Usa &laquo;Agregar eje&raquo; para empezar.
        </p>
      )}

      {ejes.map((eje) => (
        <div key={eje.id} className="rounded-lg border">
          <Nodo unidad={eje} puedeEliminar={puedeEliminar(eje)} />

          <div className="space-y-2 border-t bg-muted/20 p-3 pl-6">
            {macros
              .filter((m) => m.padre_id === eje.id)
              .map((macro) => (
                <div key={macro.id} className="rounded-md border bg-card">
                  <Nodo unidad={macro} puedeEliminar={puedeEliminar(macro)} />

                  <div className="space-y-2 border-t bg-muted/20 p-3 pl-6">
                    {procesos
                      .filter((p) => p.padre_id === macro.id)
                      .map((proc) => (
                        <div
                          key={proc.id}
                          className="rounded-md border bg-card"
                        >
                          <Nodo
                            unidad={proc}
                            puedeEliminar={puedeEliminar(proc)}
                          />
                        </div>
                      ))}
                    <details>
                      <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                        <Plus className="size-3.5" />
                        Agregar proceso
                      </summary>
                      <div className="mt-2">
                        <FormUnidad tipo="proceso" padreId={macro.id} />
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            <details>
              <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <Plus className="size-3.5" />
                Agregar macroproceso
              </summary>
              <div className="mt-2">
                <FormUnidad tipo="macroproceso" padreId={eje.id} />
              </div>
            </details>
          </div>
        </div>
      ))}
    </div>
  );
}

function Nodo({
  unidad,
  puedeEliminar,
}: {
  unidad: Unidad;
  puedeEliminar: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">
          <span className="font-medium">{unidad.codigo}</span> · {unidad.nombre}
        </span>
        {puedeEliminar ? (
          <form action={eliminarUnidad}>
            <input type="hidden" name="id" value={unidad.id} />
            <button
              type="submit"
              aria-label="Eliminar"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </form>
        ) : (
          <span
            className="text-xs text-muted-foreground"
            title="No se puede eliminar mientras tenga elementos dependientes"
          >
            en uso
          </span>
        )}
      </div>

      <details className="text-sm">
        <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <Pencil className="size-3.5" />
          Editar
        </summary>
        <form
          action={actualizarUnidad}
          className="mt-2 grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={unidad.id} />
          <div className="flex flex-col gap-1">
            <Label>Código</Label>
            <Input name="codigo" defaultValue={unidad.codigo} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Nombre</Label>
            <Input name="nombre" defaultValue={unidad.nombre} required />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm">
              Guardar cambios
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}

function FormUnidad({
  tipo,
  padreId,
}: {
  tipo: "eje" | "macroproceso" | "proceso";
  padreId?: string;
}) {
  return (
    <form
      action={crearUnidad}
      className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="tipo" value={tipo} />
      {padreId && <input type="hidden" name="padre_id" value={padreId} />}
      <div className="flex flex-col gap-1">
        <Label>Código</Label>
        <Input name="codigo" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Nombre</Label>
        <Input name="nombre" required />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm">
          Agregar
        </Button>
      </div>
    </form>
  );
}
