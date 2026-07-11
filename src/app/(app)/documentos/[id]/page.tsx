import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PenLine, CheckCircle2, XCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";
import { tipoDocumentoLabel } from "@/lib/documentos";
import {
  estadoSolicitudLabel,
  estadoPasoLabel,
  esPasoActual,
} from "@/lib/aprobaciones";
import { enviarAAprobacion, decidirPaso } from "./actions";

export const metadata: Metadata = {
  title: `Documento — ${APP_NAME}`,
};

type Doc = {
  id: string;
  titulo: string;
  tipo: string;
  descripcion: string | null;
  fecha_documento: string | null;
  contenido: string | null;
  proceso_id: string | null;
  expediente_id: string;
  procesos: { nombre: string } | null;
  expedientes: { titulo: string } | null;
};

type PasoRow = {
  id: string;
  orden: number;
  aprobador_id: string;
  estado: string;
  comentario: string | null;
  decidido_at: string | null;
  profiles: { full_name: string | null; email: string } | null;
};

type FirmaRow = {
  id: string;
  rol_snapshot: string | null;
  hash_documento: string | null;
  ip: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

export default async function DocumentoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: docData } = await supabase
    .from("documentos")
    .select(
      "id, titulo, tipo, descripcion, fecha_documento, contenido, proceso_id, expediente_id, procesos(nombre), expedientes(titulo)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!docData) notFound();
  const doc = docData as unknown as Doc;

  // Última solicitud de aprobación del documento (si existe).
  const { data: solicitud } = await supabase
    .from("aprobacion_solicitudes")
    .select("id, estado, paso_actual, created_at")
    .eq("documento_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let pasos: PasoRow[] = [];
  if (solicitud) {
    const { data } = await supabase
      .from("aprobacion_pasos")
      .select(
        "id, orden, aprobador_id, estado, comentario, decidido_at, profiles(full_name, email)",
      )
      .eq("solicitud_id", solicitud.id)
      .order("orden");
    pasos = (data ?? []) as unknown as PasoRow[];
  }

  const { data: firmasData } = await supabase
    .from("firmas")
    .select(
      "id, rol_snapshot, hash_documento, ip, created_at, profiles(full_name, email)",
    )
    .eq("documento_id", id)
    .order("created_at");
  const firmas = (firmasData ?? []) as unknown as FirmaRow[];

  const hayFlujoEnCurso = solicitud?.estado === "en_curso";
  const pasoActual = solicitud
    ? pasos.find((p) => esPasoActual(p, solicitud))
    : undefined;
  const meToca = Boolean(pasoActual && pasoActual.aprobador_id === user?.id);

  // Aprobadores posibles: usuarios activos del mismo proceso.
  const { data: aprobadoresData } = doc.proceso_id
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("proceso_id", doc.proceso_id)
        .eq("is_active", true)
        .order("full_name")
    : { data: [] };
  const aprobadores = (aprobadoresData ?? []) as {
    id: string;
    full_name: string | null;
    email: string;
  }[];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href={`/expedientes/${doc.expediente_id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver al expediente
        </Link>
        <h1 className="text-2xl font-semibold">{doc.titulo}</h1>
        <p className="text-sm text-muted-foreground">
          {tipoDocumentoLabel(doc.tipo)}
          {doc.procesos?.nombre ? ` · ${doc.procesos.nombre}` : ""}
          {doc.expedientes?.titulo ? ` · ${doc.expedientes.titulo}` : ""}
          {doc.fecha_documento ? ` · ${doc.fecha_documento}` : ""}
        </p>
        {doc.descripcion && <p className="mt-2 text-sm">{doc.descripcion}</p>}
        {doc.tipo === "electronico" && doc.contenido && (
          <div className="mt-3 rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap">
            {doc.contenido}
          </div>
        )}
      </div>

      {/* Estado del flujo de aprobación */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Aprobación</h2>

        {!solicitud ? (
          <p className="text-sm text-muted-foreground">
            Este documento no tiene un flujo de aprobación.
          </p>
        ) : (
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-sm">
              Estado:{" "}
              <span className="font-medium">
                {estadoSolicitudLabel(solicitud.estado)}
              </span>
            </p>
            <ol className="space-y-2">
              {pasos.map((p) => (
                <li key={p.id} className="flex items-start gap-2 text-sm">
                  <EstadoIcono estado={p.estado} />
                  <div>
                    <span className="font-medium">
                      {p.orden}. {p.profiles?.full_name ?? p.profiles?.email}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      — {estadoPasoLabel(p.estado)}
                      {p.decidido_at
                        ? ` · ${new Date(p.decidido_at).toLocaleString("es-CO")}`
                        : ""}
                    </span>
                    {p.comentario && (
                      <p className="text-muted-foreground">“{p.comentario}”</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Decisión del aprobador en turno */}
        {meToca && pasoActual && (
          <form
            action={decidirPaso}
            className="space-y-3 rounded-lg border border-primary/40 bg-card p-4"
          >
            <p className="text-sm font-medium">Es tu turno de aprobar</p>
            <input type="hidden" name="paso_id" value={pasoActual.id} />
            <input type="hidden" name="documento_id" value={doc.id} />
            <textarea
              name="comentario"
              rows={2}
              placeholder="Comentario (opcional)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                name="decision"
                value="aprobado"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
              >
                <PenLine className="size-4" /> Aprobar y firmar
              </button>
              <button
                type="submit"
                name="decision"
                value="rechazado"
                className="rounded-md border px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                Rechazar
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Al aprobar, se registra una firma electrónica simple con tu
              usuario, rol, fecha/hora, IP y el hash del documento.
            </p>
          </form>
        )}

        {/* Envío a aprobación (si no hay flujo en curso) */}
        {!hayFlujoEnCurso && aprobadores.length > 0 && (
          <form
            action={enviarAAprobacion}
            className="space-y-3 rounded-lg border bg-card p-4"
          >
            <p className="text-sm font-medium">
              {solicitud
                ? "Iniciar una nueva aprobación"
                : "Enviar a aprobación"}
            </p>
            <input type="hidden" name="documento_id" value={doc.id} />
            <p className="text-xs text-muted-foreground">
              Elige uno o varios aprobadores; firmarán en el orden indicado.
            </p>
            {[1, 2, 3].map((n) => (
              <label
                key={n}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="w-24">Aprobador {n}</span>
                <select
                  name={`aprobador_${n}`}
                  defaultValue=""
                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="">
                    {n === 1 ? "Selecciona…" : "— (opcional) —"}
                  </option>
                  {aprobadores.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name ?? a.email}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              Enviar a aprobación
            </button>
          </form>
        )}
      </section>

      {/* Firmas registradas */}
      {firmas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">
            Firmas electrónicas ({firmas.length})
          </h2>
          <ul className="space-y-2">
            {firmas.map((f) => (
              <li key={f.id} className="rounded-lg border bg-card p-4 text-sm">
                <p className="font-medium">
                  {f.profiles?.full_name ?? f.profiles?.email}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({f.rol_snapshot})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(f.created_at).toLocaleString("es-CO")} · IP{" "}
                  {f.ip ?? "—"}
                </p>
                {f.hash_documento && (
                  <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
                    SHA-256: {f.hash_documento}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EstadoIcono({ estado }: { estado: string }) {
  if (estado === "aprobado")
    return <CheckCircle2 className="mt-0.5 size-4 text-primary" />;
  if (estado === "rechazado")
    return <XCircle className="mt-0.5 size-4 text-destructive" />;
  return <Clock className="mt-0.5 size-4 text-muted-foreground" />;
}
