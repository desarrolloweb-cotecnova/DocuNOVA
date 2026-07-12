import type { Metadata } from "next";
import { Plus, FileStack } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { creaRegistros } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { listOficinas } from "@/services/oficinas";
import { listDocumentosActivos } from "@/services/documentos";
import { listRegistrosPorOficina } from "@/services/registros";
import {
  TIPO_DOCUMENTO_LABELS,
  ESTADO_REGISTRO_LABELS,
  labelDe,
} from "@/lib/tipos";
import { OficinaSelector } from "@/components/oficina-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { crearRegistro, setEstadoRegistro } from "./actions";

export const metadata: Metadata = {
  title: `Registros — ${APP_NAME}`,
};

export default async function RegistrosPage({
  searchParams,
}: {
  searchParams: Promise<{ oficina?: string }>;
}) {
  const { oficina } = await searchParams;
  const [rol, oficinas] = await Promise.all([rolDelUsuario(), listOficinas()]);
  const puedeRegistrar = creaRegistros(rol);

  const oficinaId =
    oficina && oficinas.some((o) => o.id === oficina) ? oficina : null;

  const [documentos, registros] = oficinaId
    ? await Promise.all([
        listDocumentosActivos(oficinaId),
        listRegistrosPorOficina(oficinaId),
      ])
    : [[], []];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Registros</h1>
        <p className="text-sm text-muted-foreground">
          Crea registros a partir de los documentos activos de una dependencia.
        </p>
      </div>

      <OficinaSelector
        oficinas={oficinas}
        actual={oficinaId}
        basePath="/registros"
      />

      {!oficinaId ? (
        <p className="text-sm text-muted-foreground">
          Elige una dependencia para comenzar.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Documentos disponibles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Documentos disponibles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay documentos activos en esta dependencia.
                </p>
              ) : (
                <ul className="divide-y">
                  {documentos.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium">
                          <FileStack className="size-4 text-muted-foreground" />
                          {d.nombre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {labelDe(TIPO_DOCUMENTO_LABELS, d.tipo)}
                        </span>
                      </span>
                      {puedeRegistrar && (
                        <form action={crearRegistro}>
                          <input
                            type="hidden"
                            name="documento_id"
                            value={d.id}
                          />
                          <input
                            type="hidden"
                            name="oficina_id"
                            value={oficinaId}
                          />
                          <Button type="submit" size="sm">
                            <Plus className="size-4" />
                            Registrar
                          </Button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Registros creados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Registros ({registros.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {registros.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay registros en esta dependencia.
                </p>
              ) : (
                <ul className="divide-y">
                  {registros.map((r) => (
                    <li key={r.id} className="flex flex-col gap-1 py-3 text-sm">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">
                          {r.documento_nombre ?? "Documento"}
                        </span>
                        <span
                          className={
                            r.estado === "completado"
                              ? "shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                              : r.estado === "anulado"
                                ? "shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                                : "shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {labelDe(ESTADO_REGISTRO_LABELS, r.estado)}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.creado_en).toLocaleDateString("es-CO")}
                      </span>
                      {puedeRegistrar && r.estado === "borrador" && (
                        <span className="flex gap-2">
                          <form action={setEstadoRegistro}>
                            <input type="hidden" name="id" value={r.id} />
                            <input
                              type="hidden"
                              name="estado"
                              value="completado"
                            />
                            <Button type="submit" size="sm" variant="outline">
                              Completar
                            </Button>
                          </form>
                          <form action={setEstadoRegistro}>
                            <input type="hidden" name="id" value={r.id} />
                            <input
                              type="hidden"
                              name="estado"
                              value="anulado"
                            />
                            <Button type="submit" size="sm" variant="ghost">
                              Anular
                            </Button>
                          </form>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
