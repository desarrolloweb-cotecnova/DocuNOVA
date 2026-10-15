import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { roleLabel } from "@/lib/roles";
import {
  getPerfilActual,
  getNumeroDocumento,
  listPerfilesMinimos,
} from "@/services/perfiles";
import { listUnidades } from "@/services/unidades";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: `Mi perfil — ${APP_NAME}`,
};

/** Campo de solo lectura: etiqueta y valor (o "Sin asignar"). */
function Dato({
  etiqueta,
  valor,
  ancho,
  children,
}: {
  etiqueta: string;
  valor: string | null | undefined;
  ancho?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 ${ancho ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium">{etiqueta}</span>
      <p className="min-h-9 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
        {valor || <span className="text-muted-foreground">Sin asignar</span>}
      </p>
      {children}
    </div>
  );
}

export default async function PerfilPage() {
  const perfil = await getPerfilActual();
  const [numeroDocumento, perfiles, unidades] = await Promise.all([
    perfil ? getNumeroDocumento(perfil.usuario_id) : Promise.resolve(null),
    listPerfilesMinimos(),
    listUnidades(),
  ]);

  // Ruta "Eje ▸ Macro ▸ Proceso" del proceso del usuario.
  const porId = new Map(unidades.map((u) => [u.id, u]));
  const proceso = perfil?.unidad_id ? porId.get(perfil.unidad_id) : null;
  const macro = proceso?.padre_id ? porId.get(proceso.padre_id) : null;
  const eje = macro?.padre_id ? porId.get(macro.padre_id) : null;
  const rutaProceso = [eje?.nombre, macro?.nombre, proceso?.nombre]
    .filter(Boolean)
    .join(" ▸ ");

  const jefe = perfiles.find((p) => p.usuario_id === perfil?.supervisor_id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Dato
            etiqueta="Nombre completo"
            valor={perfil?.nombre_completo}
            ancho
          />
          <Dato etiqueta="Documento de identidad" valor={numeroDocumento}>
            <p className="text-xs text-muted-foreground">
              Dato reservado: solo lo ves tú y el administrador de usuarios.
            </p>
          </Dato>
          <Dato etiqueta="Cargo" valor={perfil?.titulo_cargo} />
          <Dato
            etiqueta="Jefe inmediato"
            valor={jefe ? (jefe.nombre_completo ?? jefe.email) : null}
          />
          <Dato etiqueta="Proceso" valor={rutaProceso} />

          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <span className="text-sm">
              Responsable de proceso: {perfil?.es_responsable ? "Sí" : "No"}
            </span>
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

          <p className="text-xs text-muted-foreground sm:col-span-2">
            Para corregir algún dato, solicítalo al administrador de usuarios.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
