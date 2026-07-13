"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ESTADO_REGISTRO_LABELS, labelDe } from "@/lib/tipos";
import type { ResultadoConsulta } from "@/services/consulta";

/**
 * Tabla de resultados de la consulta con buscador en vivo (client-side).
 * El filtro por Eje/Macroproceso/Proceso/Dependencia lo hace el server
 * component al pedir los datos; aquí solo se filtra por palabra clave.
 */
export function TablaConsulta({
  resultados,
}: {
  resultados: ResultadoConsulta[];
}) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return resultados;
    return resultados.filter((r) =>
      [r.proceso, r.dependencia, r.documento]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(t)),
    );
  }, [resultados, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por proceso, dependencia o documento…"
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="overflow-x-auto">
          <p className="mb-2 text-xs text-muted-foreground">
            {filtrados.length} de {resultados.length} registro(s)
          </p>
          {filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {resultados.length === 0
                ? "No hay registros para mostrar."
                : "No se encontraron registros para tu búsqueda."}
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2">Proceso</th>
                  <th className="pb-2">Dependencia</th>
                  <th className="pb-2">Documento</th>
                  <th className="pb-2">Fecha</th>
                  <th className="pb-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtrados.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2">{r.proceso ?? "—"}</td>
                    <td className="py-2">{r.dependencia ?? "—"}</td>
                    <td className="py-2">{r.documento ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(r.fecha).toLocaleDateString("es-CO")}
                    </td>
                    <td className="py-2">
                      {labelDe(ESTADO_REGISTRO_LABELS, r.estado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
