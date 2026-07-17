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
      {puedeEditar && (
        <ImportadorExcel
          titulo="Carga masiva de dependencias"
          descripcion="Descarga la plantilla (trae las dependencias actuales), edítala y súbela. Solo se agregan las oficinas nuevas; las de código ya existente se omiten."
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
