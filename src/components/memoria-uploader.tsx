"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import {
  prepararCarga,
  registrarDocumento,
  type ResultadoCarga,
} from "@/app/(app)/memoria/actions";
import {
  MAX_BYTES_MEMORIA,
  VISIBILIDADES_MEMORIA,
  VISIBILIDAD_MEMORIA_LABELS,
} from "@/lib/tipos";
import type { CategoriaMemoria, MemoriaComponente } from "@/lib/tipos";
import {
  SELECT_CLASS,
  avisoDePeso,
  formatoTamano,
  type AvisoPeso,
} from "@/components/memoria-campos";

const INICIAL: ResultadoCarga = { ok: false, mensaje: "" };

/**
 * Sube el archivo a una URL de carga (Google Drive o el bucket de Supabase) e
 * informa el avance. Devuelve el ID del archivo en Drive cuando corresponde.
 */
function subirConProgreso(
  url: string,
  archivo: File,
  onProgreso: (pct: number) => void,
): Promise<{ driveFileId: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader(
      "content-type",
      archivo.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgreso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`El archivo no se pudo subir (HTTP ${xhr.status}).`));
        return;
      }
      let driveFileId: string | null = null;
      try {
        driveFileId =
          (JSON.parse(xhr.responseText) as { id?: string }).id ?? null;
      } catch {
        // El bucket de Supabase responde otro formato; no hay ID de Drive.
      }
      resolve({ driveFileId });
    };
    xhr.onerror = () =>
      reject(new Error("Se perdió la conexión mientras se subía el archivo."));
    xhr.send(archivo);
  });
}

/** Formulario de carga de un documento en una categoría de Memoria Corporativa. */
export function MemoriaUploader({
  categoria,
  componentes,
  procesos,
}: {
  categoria: CategoriaMemoria;
  componentes: MemoriaComponente[];
  procesos: { id: string; ruta: string }[];
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<ResultadoCarga>(INICIAL);
  const [pending, setPending] = useState(false);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [aviso, setAviso] = useState<AvisoPeso | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      setEstado({ ok: false, mensaje: "Selecciona un archivo." });
      return;
    }

    setPending(true);
    setEstado(INICIAL);
    setProgreso(0);
    try {
      // 1) El servidor autoriza y dice a dónde subir el archivo.
      const destino = await prepararCarga({
        categoria,
        nombre: archivo.name,
        tipo: archivo.type,
        tamano: archivo.size,
      });
      if (!destino.ok) {
        setEstado(destino);
        return;
      }

      // 2) Los bytes viajan del navegador al destino, sin pasar por la app.
      let driveFileId: string | null = null;
      if (destino.destino === "drive") {
        driveFileId = (
          await subirConProgreso(destino.uploadUrl, archivo, setProgreso)
        ).driveFileId;
        if (!driveFileId) {
          setEstado({
            ok: false,
            mensaje: "Drive no devolvió el identificador del archivo.",
          });
          return;
        }
      } else {
        const supabase = createClient();
        const { error } = await supabase.storage
          .from("memoria")
          .uploadToSignedUrl(destino.ruta, destino.token, archivo, {
            contentType: archivo.type || undefined,
          });
        if (error) {
          setEstado({
            ok: false,
            mensaje: `No se pudo subir el archivo: ${error.message}`,
          });
          return;
        }
        setProgreso(100);
      }

      // 3) Solo los metadatos van a la Server Action.
      datos.delete("archivo");
      datos.set("archivo_nombre", archivo.name);
      if (driveFileId) datos.set("drive_file_id", driveFileId);
      else if (destino.destino === "supabase")
        datos.set("archivo_ruta", destino.ruta);

      const resultado = await registrarDocumento(INICIAL, datos);
      setEstado(resultado);
      if (resultado.ok) {
        form.reset();
        setAviso(null);
        router.refresh();
      }
    } catch (error) {
      setEstado({
        ok: false,
        mensaje: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPending(false);
      setProgreso(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="size-4 text-secondary" />
          Cargar documento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <input type="hidden" name="categoria" value={categoria} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`titulo-${categoria}`}>Título</Label>
            <Input
              id={`titulo-${categoria}`}
              name="titulo"
              required
              maxLength={200}
              placeholder="Nombre del documento"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`descripcion-${categoria}`}>
              Descripción (opcional)
            </Label>
            <textarea
              id={`descripcion-${categoria}`}
              name="descripcion"
              rows={2}
              maxLength={500}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`componente-${categoria}`}>Componente</Label>
            <select
              id={`componente-${categoria}`}
              name="componente_id"
              required
              defaultValue=""
              disabled={componentes.length === 0}
              className={`${SELECT_CLASS} w-full px-3 disabled:opacity-50`}
            >
              <option value="" disabled>
                Selecciona un componente…
              </option>
              {componentes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {componentes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay componentes activos en esta memoria. Un administrador
                debe crearlos en Configuración → Componentes Memoria
                Corporativa.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`proceso-${categoria}`}>Proceso</Label>
            <select
              id={`proceso-${categoria}`}
              name="unidad_id"
              required
              defaultValue=""
              disabled={procesos.length === 0}
              className={`${SELECT_CLASS} w-full px-3 disabled:opacity-50`}
            >
              <option value="" disabled>
                Selecciona el proceso…
              </option>
              {procesos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ruta}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`visibilidad-${categoria}`}>Visibilidad</Label>
              <select
                id={`visibilidad-${categoria}`}
                name="visibilidad"
                defaultValue="publico"
                className={`${SELECT_CLASS} w-full px-3`}
              >
                {VISIBILIDADES_MEMORIA.map((v) => (
                  <option key={v} value={v}>
                    {VISIBILIDAD_MEMORIA_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`archivo-${categoria}`}>Archivo</Label>
              <input
                id={`archivo-${categoria}`}
                type="file"
                name="archivo"
                required
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.odt,.ods,.odp,.jpg,.jpeg,.png"
                onChange={(e) =>
                  setAviso(avisoDePeso(e.target.files?.[0]?.size ?? 0))
                }
                className="text-sm file:mr-3 file:h-9 file:rounded-md file:border file:bg-background file:px-3 file:text-sm file:font-medium"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            PDF, Word, Excel, PowerPoint, imágenes… Máximo{" "}
            {formatoTamano(MAX_BYTES_MEMORIA)}. El documento quedará pendiente
            hasta que un administrador lo publique.
          </p>

          {aviso && (
            <p
              role="status"
              className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
                aviso.tipo === "excede"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {aviso.mensaje}
            </p>
          )}

          {progreso !== null && (
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{progreso}%</span>
            </div>
          )}

          <div>
            <Button
              type="submit"
              disabled={
                pending || componentes.length === 0 || procesos.length === 0
              }
            >
              {pending ? "Cargando…" : "Cargar documento"}
            </Button>
          </div>

          {estado.mensaje &&
            (estado.ok ? (
              <p className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 p-2 text-sm text-primary">
                <CheckCircle2 className="size-4" />
                {estado.mensaje}
              </p>
            ) : (
              <p className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                <AlertCircle className="size-4" />
                {estado.mensaje}
              </p>
            ))}
        </form>
      </CardContent>
    </Card>
  );
}
