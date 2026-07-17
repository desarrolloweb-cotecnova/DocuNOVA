import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { roleLabel, gestionaUsuarios } from "@/lib/roles";
import {
  getPerfilActual,
  getNumeroDocumento,
  listPerfilesMinimos,
} from "@/services/perfiles";
import { listUnidades } from "@/services/unidades";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarPerfil } from "./actions";

export const metadata: Metadata = {
  title: `Mi perfil — ${APP_NAME}`,
};

export default async function PerfilPage() {
  const perfil = await getPerfilActual();
  const [numeroDocumento, perfiles, unidades] = await Promise.all([
    perfil ? getNumeroDocumento(perfil.usuario_id) : Promise.resolve(null),
    listPerfilesMinimos(),
    listUnidades(),
  ]);

  // Construir la ruta "Eje ▸ Macro ▸ Proceso" para cada proceso.
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

  const esAdmin = gestionaUsuarios(perfil?.rol);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={actualizarPerfil} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor="nombre_completo">Nombre completo</Label>
              <Input
                id="nombre_completo"
                name="nombre_completo"
                defaultValue={perfil?.nombre_completo ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="numero_documento">Documento de identidad</Label>
              <Input
                id="numero_documento"
                name="numero_documento"
                defaultValue={numeroDocumento ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Dato reservado: solo lo ves tú y el administrador de usuarios.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="titulo_cargo">Cargo</Label>
              <Input
                id="titulo_cargo"
                name="titulo_cargo"
                defaultValue={perfil?.titulo_cargo ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="supervisor_id">Jefe inmediato</Label>
              <select
                id="supervisor_id"
                name="supervisor_id"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Sin asignar</option>
                {perfiles
                  .filter((p) => p.usuario_id !== perfil?.usuario_id)
                  .map((p) => (
                    <option key={p.usuario_id} value={p.usuario_id}>
                      {p.nombre_completo ?? p.email}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="unidad_id">Proceso</Label>
              <select
                id="unidad_id"
                name="unidad_id"
                defaultValue={perfil?.unidad_id ?? ""}
                disabled={!esAdmin}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
              >
                <option value="">Sin asignar</option>
                {procesos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ruta}
                  </option>
                ))}
              </select>
              {!esAdmin && (
                <p className="text-xs text-muted-foreground">
                  El proceso lo asigna un administrador.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="es_responsable"
                  value="1"
                  defaultChecked={perfil?.es_responsable}
                  disabled={!esAdmin}
                />
                Responsable de proceso
              </label>
              <span className="flex items-center gap-2 text-sm">
                Rol:
                <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-medium text-secondary">
                  {roleLabel(perfil?.rol)}
                </span>
              </span>
              <span className="flex items-center gap-2 text-sm">
                Estado:
                <span
                  className={
                    perfil?.activo
                      ? "rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                      : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {perfil?.activo ? "Activo" : "Inactivo"}
                </span>
              </span>
            </div>

            <div className="sm:col-span-2">
              <SubmitButton textoPendiente="Guardando…" exito="Perfil actualizado.">
                Guardar cambios
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
