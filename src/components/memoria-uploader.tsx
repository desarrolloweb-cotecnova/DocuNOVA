"use client";

import { useActionState, useRef, useEffect } from "react";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cargarDocumento,
  type ResultadoCarga,
} from "@/app/(app)/memoria/actions";
import { VISIBILIDADES_MEMORIA, VISIBILIDAD_MEMORIA_LABELS } from "@/lib/tipos";
import type { CategoriaMemoria, MemoriaComponente } from "@/lib/tipos";

const INICIAL: ResultadoCarga = { ok: false, mensaje: "" };

/** Formulario de carga de un documento en una categoría de Memoria Corporativa. */
export function MemoriaUploader({
  categoria,
  componentes,
}: {
  categoria: CategoriaMemoria;
  componentes: MemoriaComponente[];
}) {
  const [estado, formAction, pending] = useActionState(
    cargarDocumento,
    INICIAL,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formRef.current?.reset();
  }, [estado.ok]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="size-4 text-secondary" />
          Cargar documento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-col gap-4"
        >
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
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
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
                No hay componentes activos en esta memoria. Un administrador debe
                crearlos en Gestión → Componentes Memoria Corporativa.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`visibilidad-${categoria}`}>Visibilidad</Label>
              <select
                id={`visibilidad-${categoria}`}
                name="visibilidad"
                defaultValue="publico"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                className="text-sm file:mr-3 file:h-9 file:rounded-md file:border file:bg-background file:px-3 file:text-sm file:font-medium"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            PDF, Word, Excel, PowerPoint, imágenes… Máximo 25 MB. El documento
            quedará pendiente hasta que un administrador lo publique.
          </p>

          <div>
            <Button type="submit" disabled={pending || componentes.length === 0}>
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
