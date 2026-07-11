import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";
import {
  tipoDocumentoLabel,
  normalizarBusqueda,
  TIPOS_DOCUMENTO,
  type TipoDocumento,
} from "@/lib/documentos";

export const metadata: Metadata = {
  title: `Buscar documentos — ${APP_NAME}`,
};

type Resultado = {
  id: string;
  titulo: string;
  tipo: string;
  fecha_documento: string | null;
  expediente_id: string;
  expedientes: { titulo: string } | null;
  procesos: { nombre: string } | null;
};

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  const { q, tipo } = await searchParams;
  const consulta = normalizarBusqueda(q);
  const tipoFiltro = TIPOS_DOCUMENTO.includes(tipo as TipoDocumento)
    ? (tipo as TipoDocumento)
    : "";

  const supabase = await createClient();

  // La RLS limita los resultados a los documentos del proceso del usuario.
  let query = supabase
    .from("documentos")
    .select(
      "id, titulo, tipo, fecha_documento, expediente_id, expedientes(titulo), procesos(nombre)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (consulta) {
    query = query.textSearch("busqueda", consulta, {
      type: "websearch",
      config: "spanish",
    });
  }
  if (tipoFiltro) {
    query = query.eq("tipo", tipoFiltro);
  }

  const { data } = await query;
  const resultados = (data ?? []) as unknown as Resultado[];
  const hizoBusqueda = Boolean(consulta || tipoFiltro);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Buscar documentos</h1>
        <p className="text-muted-foreground">
          Busca por texto en documentos electrónicos y por título en documentos
          físicos de tu proceso.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Texto
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              name="q"
              defaultValue={consulta}
              placeholder="Ej. acta de grado, contrato, resolución…"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tipo
          <select
            name="tipo"
            defaultValue={tipoFiltro}
            className="h-[38px] rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Todos</option>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {tipoDocumentoLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-[38px] rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90"
        >
          Buscar
        </button>
      </form>

      {hizoBusqueda ? (
        resultados.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            No se encontraron documentos con esos criterios.
          </p>
        ) : (
          <ul className="space-y-2">
            {resultados.map((r) => (
              <li key={r.id} className="rounded-lg border bg-card p-4">
                <Link
                  href={`/documentos/${r.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {r.titulo}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {tipoDocumentoLabel(r.tipo)}
                  {r.procesos?.nombre ? ` · ${r.procesos.nombre}` : ""}
                  {r.expedientes?.titulo
                    ? ` · Expediente: ${r.expedientes.titulo}`
                    : ""}
                  {r.fecha_documento ? ` · ${r.fecha_documento}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Ingresa un texto o selecciona un tipo para buscar.
        </p>
      )}
    </div>
  );
}
