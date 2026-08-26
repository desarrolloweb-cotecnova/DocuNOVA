"use client";

import { useState } from "react";
import { HardDrive, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { probarDrive } from "@/app/(app)/configuracion/actions";

type Resultado = { ok: boolean; mensaje: string; carpeta?: string };

/**
 * Diagnóstico del almacenamiento de Memoria Corporativa en Google Drive.
 * Se consulta bajo demanda (botón) para no llamar a Google al pintar la página.
 */
export function DriveEstado() {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [probando, setProbando] = useState(false);

  async function probar() {
    setProbando(true);
    try {
      setResultado(await probarDrive());
    } catch (e) {
      setResultado({
        ok: false,
        mensaje: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setProbando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="size-4 text-secondary" />
          Almacenamiento de los archivos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Si el Drive institucional (docunova@cotecnova.edu.co) está vinculado,
          los archivos de Memoria Corporativa se guardan allí; si no, se guardan
          en el bucket «memoria» de Supabase Storage. Los pasos de vinculación
          están en <code>docs/DRIVE.md</code> del repositorio.
        </p>

        <div>
          <Button variant="outline" onClick={probar} disabled={probando}>
            {probando ? "Probando…" : "Probar conexión con Drive"}
          </Button>
        </div>

        {resultado && (
          <p
            className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
              resultado.ok
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {resultado.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <span>
              {resultado.mensaje}
              {resultado.carpeta && ` Carpeta destino: «${resultado.carpeta}».`}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
