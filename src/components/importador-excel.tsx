"use client";

import { useActionState } from "react";
import { Download, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RESULTADO_INICIAL, type ResultadoImport } from "@/lib/importacion";

/**
 * Bloque reutilizable de carga masiva: descarga de plantilla + subida de Excel
 * con resumen del resultado (creados/actualizados/omitidos y errores por fila).
 */
export function ImportadorExcel({
  titulo,
  descripcion,
  plantillaHref,
  accion,
}: {
  titulo: string;
  descripcion: string;
  plantillaHref: string;
  accion: (
    prev: ResultadoImport,
    formData: FormData,
  ) => Promise<ResultadoImport>;
}) {
  const [estado, formAction, pending] = useActionState(
    accion,
    RESULTADO_INICIAL,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="size-4 text-secondary" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{descripcion}</p>

        <div className="flex flex-wrap items-end gap-3">
          <a
            href={plantillaHref}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Download className="size-4" />
            Descargar plantilla
          </a>

          <form action={formAction} className="flex flex-wrap items-end gap-2">
            <input
              type="file"
              name="archivo"
              accept=".xlsx,.xls"
              required
              className="text-sm file:mr-3 file:h-9 file:rounded-md file:border file:bg-background file:px-3 file:text-sm file:font-medium"
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Cargando…" : "Cargar Excel"}
            </Button>
          </form>
        </div>

        {estado.mensaje && (
          <p className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {estado.mensaje}
          </p>
        )}

        {estado.ok && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-primary">
              <CheckCircle2 className="size-4" />
              Importación finalizada
            </p>
            <p className="mt-1 text-muted-foreground">
              Creados: <strong>{estado.creados}</strong> · Actualizados:{" "}
              <strong>{estado.actualizados}</strong>
              {estado.omitidos > 0 ? (
                <>
                  {" "}
                  · Omitidos: <strong>{estado.omitidos}</strong>
                </>
              ) : null}
            </p>
            {estado.errores.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-destructive">
                  {estado.errores.length} fila(s) con problemas:
                </p>
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-destructive">
                  {estado.errores.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
