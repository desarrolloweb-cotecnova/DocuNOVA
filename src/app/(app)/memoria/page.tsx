import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { apruebaTRD, elabora } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { listMemoria, listComponentesActivos } from "@/services/memoria";
import { listUnidades } from "@/services/unidades";
import {
  CATEGORIAS_MEMORIA,
  CATEGORIA_MEMORIA_LABELS,
  CATEGORIA_MEMORIA_DESC,
  type CategoriaMemoria,
} from "@/lib/tipos";
import { Tabs } from "@/components/tabs";
import { MemoriaUploader } from "@/components/memoria-uploader";
import { MemoriaLista } from "@/components/memoria-lista";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: `Memoria Corporativa — ${APP_NAME}`,
};

export default async function MemoriaPage() {
  const [rol, documentos, componentes, unidades] = await Promise.all([
    rolDelUsuario(),
    listMemoria(),
    listComponentesActivos(),
    listUnidades(),
  ]);
  const puedeCargar = elabora(rol);
  const puedeAprobar = apruebaTRD(rol);
  const puedeEliminar = apruebaTRD(rol);

  // Procesos con su ruta "Eje ▸ Macro ▸ Proceso" para el desplegable de carga.
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

  const docsDe = (categoria: CategoriaMemoria) =>
    documentos.filter((d) => d.categoria === categoria);
  const compsDe = (categoria: CategoriaMemoria) =>
    componentes.filter((c) => c.categoria === categoria);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Tabs
        tabs={CATEGORIAS_MEMORIA.map((categoria) => ({
          id: categoria,
          label: CATEGORIA_MEMORIA_LABELS[categoria],
          content: (
            <div className="flex flex-col gap-6">
              <p className="text-sm text-muted-foreground">
                {CATEGORIA_MEMORIA_DESC[categoria]}
              </p>

              {puedeCargar && (
                <MemoriaUploader
                  categoria={categoria}
                  componentes={compsDe(categoria)}
                  procesos={procesos}
                />
              )}

              <Card>
                <CardContent>
                  <MemoriaLista
                    documentos={docsDe(categoria)}
                    componentes={compsDe(categoria)}
                    unidades={unidades}
                    puedeAprobar={puedeAprobar}
                    puedeEliminar={puedeEliminar}
                  />
                </CardContent>
              </Card>
            </div>
          ),
        }))}
      />
    </div>
  );
}
