import type { Metadata } from "next";
import { Building2, Trash2, Star, Pencil } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { apruebaTRD } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import {
  listOficinas,
  listResponsablesPorOficina,
  type OficinaListado,
} from "@/services/oficinas";
import { listProcesos } from "@/services/unidades";
import { listPerfilesMinimos } from "@/services/perfiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  crearOficina,
  actualizarOficina,
  eliminarOficina,
  agregarResponsable,
  quitarResponsable,
} from "./actions";

export const metadata: Metadata = {
  title: `Dependencias — ${APP_NAME}`,
};

export default async function DependenciasPage() {
  const [rol, oficinas, procesos, responsables, perfiles] = await Promise.all([
    rolDelUsuario(),
    listOficinas(),
    listProcesos(),
    listResponsablesPorOficina(),
    listPerfilesMinimos(),
  ]);
  const puedeEditar = apruebaTRD(rol);

  // Agrupar oficinas por proceso (unidad).
  const grupos = new Map<string, OficinaListado[]>();
  for (const o of oficinas) {
    const clave = o.unidad_nombre ?? "Sin proceso";
    const lista = grupos.get(clave) ?? [];
    lista.push(o);
    grupos.set(clave, lista);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dependencias</h1>
        <p className="text-sm text-muted-foreground">
          Oficinas productoras agrupadas por proceso.
        </p>
      </div>

      {puedeEditar && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva oficina</CardTitle>
          </CardHeader>
          <CardContent>
            <FormularioOficina procesos={procesos} accion={crearOficina} />
          </CardContent>
        </Card>
      )}

      {[...grupos.entries()].map(([proceso, lista]) => (
        <div key={proceso} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Building2 className="size-4" />
            {proceso}
          </h2>
          {lista.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {o.codigo} · {o.nombre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.ubicacion_fisica ?? "Sin ubicación física"}
                      {o.ubicacion_digital ? ` · ${o.ubicacion_digital}` : ""}
                    </p>
                  </div>
                  {puedeEditar && (
                    <form action={eliminarOficina}>
                      <input type="hidden" name="id" value={o.id} />
                      <button
                        type="submit"
                        aria-label="Eliminar oficina"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  )}
                </div>

                {/* Responsables */}
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Responsables
                  </p>
                  {(responsables[o.id] ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sin responsables asignados.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {(responsables[o.id] ?? []).map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="flex items-center gap-1.5">
                            {r.es_principal && (
                              <Star className="size-3.5 fill-secondary text-secondary" />
                            )}
                            {r.nombre_completo ?? r.email}
                          </span>
                          {puedeEditar && (
                            <form action={quitarResponsable}>
                              <input type="hidden" name="id" value={r.id} />
                              <button
                                type="submit"
                                aria-label="Quitar responsable"
                                className="text-xs text-muted-foreground hover:text-destructive"
                              >
                                Quitar
                              </button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {puedeEditar && (
                    <form
                      action={agregarResponsable}
                      className="mt-2 flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="oficina_id" value={o.id} />
                      <select
                        name="usuario_id"
                        required
                        className="h-8 min-w-40 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Elegir usuario…</option>
                        {perfiles.map((p) => (
                          <option key={p.usuario_id} value={p.usuario_id}>
                            {p.nombre_completo ?? p.email}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" name="es_principal" value="1" />
                        Principal
                      </label>
                      <Button type="submit" size="sm" variant="outline">
                        Asignar
                      </Button>
                    </form>
                  )}
                </div>

                {/* Editar */}
                {puedeEditar && (
                  <details className="text-sm">
                    <summary className="flex cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-foreground">
                      <Pencil className="size-3.5" />
                      Editar oficina
                    </summary>
                    <div className="mt-3">
                      <FormularioOficina
                        procesos={procesos}
                        accion={actualizarOficina}
                        oficina={o}
                      />
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {oficinas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay oficinas registradas todavía.
        </p>
      )}
    </div>
  );
}

function FormularioOficina({
  procesos,
  accion,
  oficina,
}: {
  procesos: { id: string; nombre: string; codigo: string }[];
  accion: (formData: FormData) => void;
  oficina?: OficinaListado;
}) {
  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      {oficina && <input type="hidden" name="id" value={oficina.id} />}
      <div className="flex flex-col gap-1">
        <Label>Proceso</Label>
        <select
          name="unidad_id"
          defaultValue={oficina?.unidad_id ?? ""}
          required
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Elegir proceso…</option>
          {procesos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo} · {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label>Código</Label>
        <Input name="codigo" defaultValue={oficina?.codigo ?? ""} required />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label>Nombre</Label>
        <Input name="nombre" defaultValue={oficina?.nombre ?? ""} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Ubicación física</Label>
        <Input
          name="ubicacion_fisica"
          defaultValue={oficina?.ubicacion_fisica ?? ""}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Ubicación digital</Label>
        <Input
          name="ubicacion_digital"
          defaultValue={oficina?.ubicacion_digital ?? ""}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">
          {oficina ? "Guardar cambios" : "Crear oficina"}
        </Button>
      </div>
    </form>
  );
}
