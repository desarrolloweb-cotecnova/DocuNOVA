import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { apruebaTRD } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { listOficinas, listResponsablesPorOficina } from "@/services/oficinas";
import { listUnidades } from "@/services/unidades";
import { listPerfilesMinimos } from "@/services/perfiles";
import { ImportadorExcel } from "@/components/importador-excel";
import { DependenciasCliente } from "@/components/dependencias-cliente";
import { importarDependencias } from "./actions";

export const metadata: Metadata = {
  title: `Dependencias — ${APP_NAME}`,
};

export default async function DependenciasPage() {
  const [rol, unidades, oficinas, responsables, perfiles] = await Promise.all([
    rolDelUsuario(),
    listUnidades(),
    listOficinas(),
    listResponsablesPorOficina(),
    listPerfilesMinimos(),
  ]);
  const puedeEditar = apruebaTRD(rol);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dependencias</h1>
        <p className="text-sm text-muted-foreground">
          Estructura organizacional y oficinas productoras. Filtra por eje,
          macroproceso y proceso, o busca por palabra clave.
        </p>
      </div>

      {puedeEditar && (
        <ImportadorExcel
          titulo="Carga masiva de dependencias"
          descripcion="Sube un Excel con toda la jerarquía (eje, macroproceso, proceso y oficina). Se crean o actualizan según su código."
          plantillaHref="/dependencias/plantilla"
          accion={importarDependencias}
        />
      )}

      <DependenciasCliente
        unidades={unidades}
        oficinas={oficinas}
        responsables={responsables}
        perfiles={perfiles}
        puedeEditar={puedeEditar}
      />
    </div>
  );
}
