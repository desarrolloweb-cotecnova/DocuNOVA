import type { Metadata } from "next";
import { Search } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { buscarRegistros } from "@/services/consulta";
import { ESTADO_REGISTRO_LABELS, labelDe } from "@/lib/tipos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: `Consulta — ${APP_NAME}`,
};

export default async function ConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const resultados = await buscarRegistros(q);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Consulta</h1>
        <p className="text-sm text-muted-foreground">
          Busca registros por proceso, dependencia o documento.
        </p>
      </div>

      <form method="get" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Proceso, dependencia o documento…"
            className="pl-9"
          />
        </div>
        <Button type="submit">Buscar</Button>
      </form>

      <Card>
        <CardContent className="overflow-x-auto">
          {resultados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {q
                ? "No se encontraron registros para tu búsqueda."
                : "No hay registros para mostrar."}
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
                {resultados.map((r) => (
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
