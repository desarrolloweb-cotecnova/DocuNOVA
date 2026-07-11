import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Monitor } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";
import {
  estadoExpedienteLabel,
  tipoDocumentoLabel,
  foliosLabel,
  ubicacionFisicaLabel,
  type Documento,
} from "@/lib/documentos";
import { NuevoDocumentoForm } from "./nuevo-documento-form";

export const metadata: Metadata = {
  title: `Expediente — ${APP_NAME}`,
};

type ExpedienteDetalle = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  fecha_apertura: string;
  procesos: { nombre: string } | null;
  oficinas_productoras: { codigo: string; nombre: string } | null;
};

export default async function ExpedienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: exp } = await supabase
    .from("expedientes")
    .select(
      "id, titulo, descripcion, estado, fecha_apertura, procesos(nombre), oficinas_productoras(codigo, nombre)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!exp) notFound();
  const expediente = exp as unknown as ExpedienteDetalle;

  const { data: docsData } = await supabase
    .from("documentos")
    .select("*")
    .eq("expediente_id", id)
    .order("created_at", { ascending: false });
  const documentos = (docsData ?? []) as Documento[];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href="/expedientes"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Expedientes
        </Link>
        <h1 className="text-2xl font-semibold">{expediente.titulo}</h1>
        <p className="text-sm text-muted-foreground">
          {expediente.procesos?.nombre ?? "—"}
          {expediente.oficinas_productoras
            ? ` · ${expediente.oficinas_productoras.codigo} ${expediente.oficinas_productoras.nombre}`
            : ""}
          {" · "}
          {estadoExpedienteLabel(expediente.estado)} · Apertura{" "}
          {expediente.fecha_apertura}
        </p>
        {expediente.descripcion && (
          <p className="mt-2 text-sm">{expediente.descripcion}</p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          Documentos ({documentos.length})
        </h2>
        {documentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este expediente aún no tiene documentos.
          </p>
        ) : (
          <ul className="space-y-2">
            {documentos.map((d) => (
              <li key={d.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-muted-foreground">
                    {d.tipo === "electronico" ? (
                      <Monitor className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/documentos/${d.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {d.titulo}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {tipoDocumentoLabel(d.tipo)}
                      {d.fecha_documento ? ` · ${d.fecha_documento}` : ""}
                    </p>
                    {d.descripcion && (
                      <p className="mt-1 text-sm">{d.descripcion}</p>
                    )}
                    {d.tipo === "fisico" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ubicacionFisicaLabel(d)} · Folios{" "}
                        {foliosLabel(d.folio_inicial, d.folio_final)}
                        {d.estado_conservacion
                          ? ` · ${d.estado_conservacion}`
                          : ""}
                      </p>
                    ) : (
                      d.contenido && (
                        <p className="mt-1 line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">
                          {d.contenido}
                        </p>
                      )
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Agregar documento</h2>
        <div className="rounded-lg border bg-card p-4">
          <NuevoDocumentoForm expedienteId={expediente.id} />
        </div>
      </section>
    </div>
  );
}
