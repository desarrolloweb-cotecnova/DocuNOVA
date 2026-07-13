import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { apruebaTRD, elabora } from "@/lib/roles";
import { rolDelUsuario } from "@/lib/auth/roles-server";
import { listOficinas } from "@/services/oficinas";
import { listDocumentosPorOficina } from "@/services/documentos";
import { listSeriesPorOficina } from "@/services/series";
import {
  TIPOS_DOCUMENTO,
  TIPO_DOCUMENTO_LABELS,
  ESTADO_DOCUMENTO_LABELS,
  labelDe,
} from "@/lib/tipos";
import { OficinaSelector } from "@/components/oficina-selector";
import { ImportadorExcel } from "@/components/importador-excel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  crearDocumento,
  setEstadoDocumento,
  eliminarDocumento,
  importarDocumentos,
} from "./actions";

export const metadata: Metadata = {
  title: `Documentos — ${APP_NAME}`,
};

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ oficina?: string }>;
}) {
  const { oficina } = await searchParams;
  const [rol, oficinas] = await Promise.all([rolDelUsuario(), listOficinas()]);
  const puedeElaborar = elabora(rol);
  const puedeAprobar = apruebaTRD(rol);

  const oficinaId =
    oficina && oficinas.some((o) => o.id === oficina) ? oficina : null;

  const [documentos, series] = oficinaId
    ? await Promise.all([
        listDocumentosPorOficina(oficinaId),
        listSeriesPorOficina(oficinaId),
      ])
    : [[], []];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Definición de documentos por dependencia (rutas de cargue o formatos
          diligenciables).
        </p>
      </div>

      {puedeElaborar && (
        <ImportadorExcel
          titulo="Carga masiva de documentos"
          descripcion="Sube un Excel con los documentos de una o varias dependencias (cada fila indica el código de su oficina)."
          plantillaHref="/documentos/plantilla"
          accion={importarDocumentos}
        />
      )}

      <OficinaSelector
        oficinas={oficinas}
        actual={oficinaId}
        basePath="/documentos"
      />

      {!oficinaId ? (
        <p className="text-sm text-muted-foreground">
          Elige una dependencia para ver sus documentos.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Documentos ({documentos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {documentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta dependencia no tiene documentos.
                </p>
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2">Documento</th>
                      <th className="pb-2">Tipo</th>
                      <th className="pb-2">Estado</th>
                      <th className="pb-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {documentos.map((d) => (
                      <tr key={d.id}>
                        <td className="py-3">
                          <p className="font-medium">{d.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.codigo ? `${d.codigo} · ` : ""}
                            {d.serie_nombre ?? "Sin serie"}
                            {d.es_publico ? " · Público" : ""}
                          </p>
                        </td>
                        <td className="py-3">
                          {labelDe(TIPO_DOCUMENTO_LABELS, d.tipo)}
                        </td>
                        <td className="py-3">
                          <span
                            className={
                              d.estado === "activo"
                                ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                                : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            }
                          >
                            {labelDe(ESTADO_DOCUMENTO_LABELS, d.estado)}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-2">
                            {puedeAprobar && d.estado !== "activo" && (
                              <form action={setEstadoDocumento}>
                                <input type="hidden" name="id" value={d.id} />
                                <input
                                  type="hidden"
                                  name="estado"
                                  value="activo"
                                />
                                <Button type="submit" size="sm">
                                  Activar
                                </Button>
                              </form>
                            )}
                            {puedeAprobar && d.estado === "activo" && (
                              <form action={setEstadoDocumento}>
                                <input type="hidden" name="id" value={d.id} />
                                <input
                                  type="hidden"
                                  name="estado"
                                  value="archivado"
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="outline"
                                >
                                  Archivar
                                </Button>
                              </form>
                            )}
                            {puedeAprobar && (
                              <form action={eliminarDocumento}>
                                <input type="hidden" name="id" value={d.id} />
                                <button
                                  type="submit"
                                  aria-label="Eliminar documento"
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {puedeElaborar && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nuevo documento</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  action={crearDocumento}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="oficina_id" value={oficinaId} />
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label>Nombre</Label>
                    <Input name="nombre" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Código</Label>
                    <Input name="codigo" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Serie / subserie</Label>
                    <select
                      name="serie_id"
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Sin serie</option>
                      {series.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.codigo} · {s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Tipo</Label>
                    <select
                      name="tipo"
                      defaultValue="diligenciable"
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {TIPOS_DOCUMENTO.map((t) => (
                        <option key={t} value={t}>
                          {TIPO_DOCUMENTO_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>URL de plantilla</Label>
                    <Input name="url_plantilla" placeholder="https://…" />
                  </div>
                  <div className="flex items-center gap-4 sm:col-span-2">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" name="es_publico" value="1" />
                      Público
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        name="requiere_descarga"
                        value="1"
                      />
                      Requiere descarga
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit">Crear documento</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
