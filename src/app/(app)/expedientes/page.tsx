import type { Metadata } from "next";
import Link from "next/link";
import { FolderPlus, FolderArchive } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";
import { estadoExpedienteLabel } from "@/lib/documentos";

export const metadata: Metadata = {
  title: `Expedientes — ${APP_NAME}`,
};

type FilaExpediente = {
  id: string;
  titulo: string;
  estado: string;
  fecha_apertura: string;
  procesos: { nombre: string } | null;
};

export default async function ExpedientesPage() {
  const supabase = await createClient();

  // La RLS ya limita los expedientes visibles al proceso del usuario.
  const { data } = await supabase
    .from("expedientes")
    .select("id, titulo, estado, fecha_apertura, procesos(nombre)")
    .order("created_at", { ascending: false });

  const expedientes = (data ?? []) as unknown as FilaExpediente[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Expedientes</h1>
          <p className="text-muted-foreground">
            Expedientes de tu proceso, clasificados según la TRD.
          </p>
        </div>
        <Link
          href="/expedientes/nuevo"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          <FolderPlus className="size-4" /> Nuevo expediente
        </Link>
      </div>

      {expedientes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center text-muted-foreground">
          <FolderArchive className="size-8" />
          <p>Aún no hay expedientes en tu proceso.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Título</th>
                <th className="px-4 py-2 font-medium">Proceso</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Apertura</th>
              </tr>
            </thead>
            <tbody>
              {expedientes.map((e) => (
                <tr key={e.id} className="border-t hover:bg-accent/50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/expedientes/${e.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {e.titulo}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {e.procesos?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {estadoExpedienteLabel(e.estado)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {e.fecha_apertura}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
