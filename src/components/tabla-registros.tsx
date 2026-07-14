"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ESTADO_REGISTRO_LABELS, labelDe } from "@/lib/tipos";
import type { RegistroListado } from "@/services/registros";
import { setEstadoRegistro } from "@/app/(app)/registros/actions";

/**
 * Tabla de registros de una dependencia con buscador en vivo (client-side).
 * Al ser cliente, se puede filtrar por documento/estado sin recargar la
 * página. Los formularios de cambio de estado siguen usando server actions.
 */
export function TablaRegistros({
  registros,
  puedeActuar,
}: {
  registros: RegistroListado[];
  puedeActuar: boolean;
}) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return registros;
    return registros.filter((r) =>
      [r.documento_nombre, labelDe(ESTADO_REGISTRO_LABELS, r.estado)]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(t)),
    );
  }, [registros, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por documento o estado…"
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="overflow-x-auto">
          <p className="mb-2 text-xs text-muted-foreground">
            {filtrados.length} de {registros.length} registro(s)
          </p>
          {filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {registros.length === 0
                ? "Todavía no hay registros en esta dependencia."
                : "No se encontraron registros para tu búsqueda."}
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2">Documento</th>
                  <th className="pb-2">Fecha</th>
                  <th className="pb-2">Estado</th>
                  {puedeActuar && <th className="pb-2 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtrados.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-medium">
                      {r.documento_nombre ?? "Documento"}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(r.creado_en).toLocaleDateString("es-CO")}
                    </td>
                    <td className="py-2">
                      <span
                        className={
                          r.estado === "completado"
                            ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                            : r.estado === "anulado"
                              ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {labelDe(ESTADO_REGISTRO_LABELS, r.estado)}
                      </span>
                    </td>
                    {puedeActuar && (
                      <td className="py-2 text-right">
                        {r.estado === "borrador" && (
                          <span className="flex justify-end gap-2">
                            <form action={setEstadoRegistro}>
                              <input type="hidden" name="id" value={r.id} />
                              <input
                                type="hidden"
                                name="estado"
                                value="completado"
                              />
                              <SubmitButton
                                size="sm"
                                variant="outline"
                                textoPendiente="Completando…"
                                exito="Registro completado."
                              >
                                Completar
                              </SubmitButton>
                            </form>
                            <form action={setEstadoRegistro}>
                              <input type="hidden" name="id" value={r.id} />
                              <input
                                type="hidden"
                                name="estado"
                                value="anulado"
                              />
                              <SubmitButton
                                size="sm"
                                variant="ghost"
                                textoPendiente="Anulando…"
                                confirmar="¿Anular este registro?"
                                exito="Registro anulado."
                              >
                                Anular
                              </SubmitButton>
                            </form>
                          </span>
                        )}
                      </td>
                    )}
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
