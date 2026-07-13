import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPlus, Trash2 } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { roleLabel, gestionaUsuarios, ROLES_ASIGNABLES } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { listPerfiles, listPreRegistros } from "@/services/perfiles";
import { listUnidades } from "@/services/unidades";
import { listOficinas } from "@/services/oficinas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EstructuraGestion } from "@/components/estructura-gestion";
import { Tabs } from "@/components/tabs";
import {
  setRol,
  setActivo,
  crearPreRegistro,
  eliminarPreRegistro,
} from "./actions";

export const metadata: Metadata = {
  title: `Gestión — ${APP_NAME}`,
};

export default async function GestionPage() {
  const rol = await rolDelUsuario();
  if (!gestionaUsuarios(rol)) redirect("/dashboard");

  const [perfiles, preRegistros, unidades, oficinas] = await Promise.all([
    listPerfiles(),
    listPreRegistros(),
    listUnidades(),
    listOficinas(),
  ]);

  const unidadesConOficina = oficinas
    .map((o) => o.unidad_id)
    .filter((x): x is string => Boolean(x));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Gestión</h1>
        <p className="text-sm text-muted-foreground">
          Administra usuarios y la estructura organizacional (ejes,
          macroprocesos y procesos).
        </p>
      </div>

      <Tabs
        defaultId="usuarios"
        tabs={[
          {
            id: "usuarios",
            label: "Usuarios",
            content: (
              <div className="flex flex-col gap-6">
                {/* Usuarios */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Usuarios ({perfiles.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
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
                              <p className="font-medium">
                                {p.nombre_completo ?? p.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {p.email}
                              </p>
                            </td>
                            <td className="py-3">
                              <form
                                action={setRol}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="hidden"
                                  name="id"
                                  value={p.usuario_id}
                                />
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
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="outline"
                                >
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
                            <td className="py-3 text-right">
                              <form action={setActivo} className="inline">
                                <input
                                  type="hidden"
                                  name="id"
                                  value={p.usuario_id}
                                />
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {/* Pre-registro */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <UserPlus className="size-4 text-secondary" />
                      Pre-registro de usuarios
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <form
                      action={crearPreRegistro}
                      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
                    >
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="pr-email">Correo institucional</Label>
                        <Input
                          id="pr-email"
                          name="email"
                          type="email"
                          placeholder="nombre@cotecnova.edu.co"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="pr-nombre">Nombre</Label>
                        <Input id="pr-nombre" name="nombre" required />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="pr-rol">Rol</Label>
                        <select
                          id="pr-rol"
                          name="rol"
                          defaultValue="consulta"
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {ROLES_ASIGNABLES.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button type="submit">Agregar</Button>
                    </form>

                    {preRegistros.length > 0 && (
                      <ul className="divide-y rounded-md border">
                        {preRegistros.map((pr) => (
                          <li
                            key={pr.email}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                          >
                            <span className="min-w-0">
                              <span className="font-medium">{pr.nombre}</span>{" "}
                              <span className="text-muted-foreground">
                                {pr.email}
                              </span>
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-medium text-secondary">
                                {roleLabel(pr.rol)}
                              </span>
                              <form action={eliminarPreRegistro}>
                                <input
                                  type="hidden"
                                  name="email"
                                  value={pr.email}
                                />
                                <button
                                  type="submit"
                                  aria-label="Eliminar pre-registro"
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </form>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: "estructura",
            label: "Estructura organizacional",
            content: (
              <EstructuraGestion
                unidades={unidades}
                unidadesConOficina={unidadesConOficina}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
