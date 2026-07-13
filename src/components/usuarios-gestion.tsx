"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleLabel, ROLES_ASIGNABLES } from "@/lib/roles";
import type { PerfilListado } from "@/services/perfiles";
import {
  setRol,
  setActivo,
  actualizarPerfilUsuario,
} from "@/app/(app)/gestion/actions";

export type ProcesoOpcion = { id: string; ruta: string };

/**
 * Tabla de usuarios registrados con edición de rol, activación y un botón
 * "Editar perfil" que abre un formulario completo (nombre, cédula, cargo, jefe
 * inmediato, proceso y responsable de proceso).
 */
export function UsuariosGestion({
  perfiles,
  cedulas,
  procesos,
}: {
  perfiles: PerfilListado[];
  cedulas: Record<string, string>;
  procesos: ProcesoOpcion[];
}) {
  const [editando, setEditando] = useState<PerfilListado | null>(null);

  // El jefe inmediato es un usuario marcado como responsable de proceso.
  const responsables = perfiles.filter((p) => p.es_responsable);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2">Usuario</th>
            <th className="pb-2">Rol</th>
            <th className="pb-2">Estado</th>
            <th className="pb-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {perfiles.map((p) => (
            <tr key={p.usuario_id}>
              <td className="py-3">
                <p className="font-medium">{p.nombre_completo ?? p.email}</p>
                <p className="text-xs text-muted-foreground">
                  {p.email}
                  {p.unidad_nombre ? ` · ${p.unidad_nombre}` : ""}
                  {p.es_responsable ? " · Responsable de proceso" : ""}
                </p>
              </td>
              <td className="py-3">
                <form action={setRol} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={p.usuario_id} />
                  <select
                    name="rol"
                    defaultValue={p.rol}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {ROLES_ASIGNABLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="outline">
                    Guardar
                  </Button>
                </form>
              </td>
              <td className="py-3">
                <span
                  className={
                    p.activo
                      ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {p.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="py-3">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditando(p)}
                  >
                    <Pencil className="size-3.5" />
                    Editar perfil
                  </Button>
                  <form action={setActivo}>
                    <input type="hidden" name="id" value={p.usuario_id} />
                    <input
                      type="hidden"
                      name="activar"
                      value={p.activo ? "0" : "1"}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant={p.activo ? "outline" : "default"}
                    >
                      {p.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editando && (
        <ModalEditar
          perfil={editando}
          cedula={cedulas[editando.usuario_id] ?? ""}
          procesos={procesos}
          responsables={responsables}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

function ModalEditar({
  perfil,
  cedula,
  procesos,
  responsables,
  onCerrar,
}: {
  perfil: PerfilListado;
  cedula: string;
  procesos: ProcesoOpcion[];
  responsables: PerfilListado[];
  onCerrar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Editar perfil</h2>
            <p className="text-xs text-muted-foreground">{perfil.email}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          action={(fd) => actualizarPerfilUsuario(fd).then(onCerrar)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={perfil.usuario_id} />

          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="ep-nombre">Nombre completo</Label>
            <Input
              id="ep-nombre"
              name="nombre_completo"
              defaultValue={perfil.nombre_completo ?? ""}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="ep-cedula">Cédula</Label>
            <Input
              id="ep-cedula"
              name="numero_documento"
              defaultValue={cedula}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="ep-cargo">Cargo</Label>
            <Input
              id="ep-cargo"
              name="titulo_cargo"
              defaultValue={perfil.titulo_cargo ?? ""}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="ep-jefe">Jefe inmediato</Label>
            <select
              id="ep-jefe"
              name="supervisor_id"
              defaultValue={perfil.supervisor_id ?? ""}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {responsables
                .filter((r) => r.usuario_id !== perfil.usuario_id)
                .map((r) => (
                  <option key={r.usuario_id} value={r.usuario_id}>
                    {r.nombre_completo ?? r.email}
                    {r.unidad_nombre ? ` — ${r.unidad_nombre}` : ""}
                  </option>
                ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Solo aparecen los responsables de proceso.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="ep-proceso">Proceso</Label>
            <select
              id="ep-proceso"
              name="unidad_id"
              defaultValue={perfil.unidad_id ?? ""}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {procesos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ruta}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="es_responsable"
              value="1"
              defaultChecked={perfil.es_responsable}
            />
            Responsable del proceso
          </label>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit">Guardar cambios</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
