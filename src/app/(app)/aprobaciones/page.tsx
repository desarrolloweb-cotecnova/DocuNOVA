import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Aprobaciones — ${APP_NAME}`,
};

type PasoInbox = {
  id: string;
  orden: number;
  aprobacion_solicitudes: {
    estado: string;
    paso_actual: number;
    documento_id: string;
    documentos: { titulo: string; tipo: string } | null;
  } | null;
};

export default async function AprobacionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("aprobacion_pasos")
    .select(
      "id, orden, aprobacion_solicitudes!inner(estado, paso_actual, documento_id, documentos(titulo, tipo))",
    )
    .eq("aprobador_id", user?.id ?? "")
    .eq("estado", "pendiente");

  const filas = (data ?? []) as unknown as PasoInbox[];

  // Solo los pasos que están en turno de una solicitud en curso.
  const pendientes = filas.filter(
    (p) =>
      p.aprobacion_solicitudes?.estado === "en_curso" &&
      p.orden === p.aprobacion_solicitudes?.paso_actual,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Aprobaciones</h1>
        <p className="text-muted-foreground">
          Documentos que esperan tu revisión y firma.
        </p>
      </div>

      {pendientes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center text-muted-foreground">
          <Inbox className="size-8" />
          <p>No tienes documentos pendientes de aprobar.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pendientes.map((p) => {
            const s = p.aprobacion_solicitudes!;
            return (
              <li key={p.id}>
                <Link
                  href={`/documentos/${s.documento_id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary"
                >
                  <div>
                    <p className="font-medium">
                      {s.documentos?.titulo ?? "Documento"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Paso {p.orden} · esperando tu firma
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
