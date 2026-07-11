import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";
import {
  disposicionLabel,
  soporteLabel,
  type OficinaProductora,
  type Proceso,
  type Serie,
  type Subserie,
} from "@/lib/org";

export const metadata: Metadata = {
  title: `Tablas de Retención (TRD) — ${APP_NAME}`,
};

export default async function TrdPage({
  searchParams,
}: {
  searchParams: Promise<{ proceso?: string }>;
}) {
  const { proceso: procesoId } = await searchParams;
  const supabase = await createClient();

  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, nombre, codigo")
    .order("codigo");
  const listaProcesos = (procesos ?? []) as Pick<
    Proceso,
    "id" | "nombre" | "codigo"
  >[];

  const seleccionado = listaProcesos.find((p) => p.id === procesoId) ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Tablas de Retención Documental
        </h1>
        <p className="text-muted-foreground">
          Catálogo de series y subseries documentales por proceso.
        </p>
      </div>

      {/* Selector de proceso */}
      <div className="flex flex-wrap gap-2">
        {listaProcesos.map((p) => (
          <Link
            key={p.id}
            href={`/trd?proceso=${p.id}`}
            className={
              "rounded-full border px-3 py-1 text-sm transition-colors " +
              (p.id === procesoId
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent")
            }
          >
            {p.nombre}
          </Link>
        ))}
      </div>

      {seleccionado ? (
        <TrdProceso procesoId={seleccionado.id} />
      ) : (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Selecciona un proceso para ver sus series y subseries documentales.
        </p>
      )}
    </div>
  );
}

async function TrdProceso({ procesoId }: { procesoId: string }) {
  const supabase = await createClient();

  const { data: oficinasData } = await supabase
    .from("oficinas_productoras")
    .select("id, codigo, nombre, proceso_id")
    .eq("proceso_id", procesoId)
    .order("codigo");
  const oficinas = (oficinasData ?? []) as OficinaProductora[];

  if (oficinas.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Este proceso no tiene oficina productora física: su documentación es
        100% electrónica (no aplica registro físico en la TRD).
      </p>
    );
  }

  const oficinaIds = oficinas.map((o) => o.id);
  const { data: seriesData } = await supabase
    .from("series")
    .select("id, oficina_id, cod_serie, nombre")
    .in("oficina_id", oficinaIds)
    .order("nombre");
  const series = (seriesData ?? []) as Serie[];

  const serieIds = series.map((s) => s.id);
  const { data: subData } = serieIds.length
    ? await supabase
        .from("subseries")
        .select("*")
        .in("serie_id", serieIds)
        .order("orden")
    : { data: [] };
  const subseries = (subData ?? []) as Subserie[];

  return (
    <div className="space-y-6">
      {oficinas.map((ofi) => {
        const seriesOfi = series.filter((s) => s.oficina_id === ofi.id);
        return (
          <section key={ofi.id} className="space-y-3">
            <h2 className="text-lg font-medium">
              <span className="font-mono text-sm text-muted-foreground">
                {ofi.codigo}
              </span>{" "}
              {ofi.nombre}
            </h2>
            {seriesOfi.map((serie) => {
              const subs = subseries.filter((s) => s.serie_id === serie.id);
              return (
                <div
                  key={serie.id}
                  className="overflow-hidden rounded-lg border"
                >
                  <div className="bg-muted/50 px-4 py-2 text-sm font-medium">
                    {serie.nombre}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr className="border-b">
                          <th className="px-4 py-2 font-medium">
                            Subserie / tipo documental
                          </th>
                          <th className="px-4 py-2 font-medium">Soporte</th>
                          <th className="px-4 py-2 font-medium">Gestión</th>
                          <th className="px-4 py-2 font-medium">Central</th>
                          <th className="px-4 py-2 font-medium">Disposición</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subs.map((sub) => (
                          <tr key={sub.id} className="border-b last:border-0">
                            <td className="px-4 py-2">{sub.nombre}</td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {soporteLabel(sub)}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {sub.retencion_gestion ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {sub.retencion_central ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {disposicionLabel(sub)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
