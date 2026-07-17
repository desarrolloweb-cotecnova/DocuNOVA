import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPlus, Trash2 } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { roleLabel, gestionaUsuarios, ROLES_ASIGNABLES } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { createClient } from "@/lib/supabase/server";
import {
  listPerfiles,
  listPreRegistros,
  listNumerosDocumento,
} from "@/services/perfiles";
import { listUnidades } from "@/services/unidades";
import { listOficinas } from "@/services/oficinas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton, SubmitIcon } from "@/components/ui/submit-button";
import { EstructuraGestion } from "@/components/estructura-gestion";
import { UsuariosGestion } from "@/components/usuarios-gestion";
import { ImportadorExcel } from "@/components/importador-excel";
import { Tabs } from "@/components/tabs";
import {
  crearPreRegistro,
  eliminarPreRegistro,
  importarUsuarios,
} from "./actions";

export const metadata: Metadata = {
  title: `Gestión — ${APP_NAME}`,
};

export default async function GestionPage() {
  const rol = await rolDelUsuario();
  if (!gestionaUsuarios(rol)) redirect("/dashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [perfiles, preRegistros, cedulas, unidades, oficinas] =
    await Promise.all([
      listPerfiles(),
      listPreRegistros(),
      listNumerosDocumento(),
      listUnidades(),
      listOficinas(),
    ]);

  const unidadesConOficina = oficinas
    .map((o) => o.unidad_id)
    .filter((x): x is string => Boolean(x));

  // Procesos con su ruta "Eje ▸ Macro ▸ Proceso" para los selectores.
  const porId = new Map(unidades.map((u) => [u.id, u]));
  const procesos = unidades
    .filter((u) => u.tipo === "proceso")
    .map((p) => {
      const macro = p.padre_id ? porId.get(p.padre_id) : null;
      const eje = macro?.padre_id ? porId.get(macro.padre_id) : null;
      const ruta = [eje?.nombre, macro?.nombre, p.nombre]
        .filter(Boolean)
        .join(" ▸ ");
      return { id: p.id, ruta };
    });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Tabs
        defaultId="usuarios"
        tabs={[
          {
            id: "usuarios",
            label: "Usuarios",
            content: (
              <div className="flex flex-col gap-6">
                {/* Usuarios registrados */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Usuarios ({perfiles.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <UsuariosGestion
                      perfiles={perfiles}
                      cedulas={cedulas}
                      procesos={procesos}
                      usuarioActualId={user?.id ?? ""}
                    />
                  </CardContent>
                </Card>

                {/* Invitar nuevo usuario */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <UserPlus className="size-4 text-secondary" />
                      Invitar nuevo usuario
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                      Pre-registra a un empleado por su correo. Al iniciar sesión
                      por primera vez, su cuenta se crea activa con el rol y el
                      proceso indicados aquí.
                    </p>
                    <form
                      action={crearPreRegistro}
                      className="grid gap-3 sm:grid-cols-2"
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
                        <Label htmlFor="pr-cedula">Cédula</Label>
                        <Input id="pr-cedula" name="numero_documento" />
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
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <Label htmlFor="pr-proceso">Proceso</Label>
                        <select
                          id="pr-proceso"
                          name="unidad_id"
                          defaultValue=""
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
                      <div className="sm:col-span-2">
                        <SubmitButton
                          textoPendiente="Invitando…"
                          exito="Invitación creada."
                        >
                          Invitar usuario
                        </SubmitButton>
                      </div>
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
                                <SubmitIcon
                                  aria-label="Eliminar pre-registro"
                                  confirmar={`¿Eliminar la invitación de ${pr.email}?`}
                                  exito="Invitación eliminada."
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </SubmitIcon>
                              </form>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <ImportadorExcel
                  titulo="Carga masiva de usuarios"
                  descripcion="Sube un Excel para invitar (pre-registrar) varios empleados a la vez. Se crean o actualizan según su correo."
                  plantillaHref="/gestion/plantilla"
                  accion={importarUsuarios}
                />
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
