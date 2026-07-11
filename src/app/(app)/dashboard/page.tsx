import type { Metadata } from "next";
import Link from "next/link";
import {
  FolderArchive,
  FileStack,
  ClipboardCheck,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";
import {
  vencimientoGestion,
  estadoVencimiento,
  ESTADO_VENCIMIENTO_LABELS,
} from "@/lib/retencion";

export const metadata: Metadata = {
  title: `Panel — ${APP_NAME}`,
};

type ExpedienteRet = {
  id: string;
  titulo: string;
  fecha_apertura: string;
  subseries: { retencion_gestion: string | null } | null;
  procesos: { nombre: string } | null;
};

type PasoPend = {
  id: string;
  orden: number;
  aprobacion_solicitudes: {
    estado: string;
    paso_actual: number;
    documento_id: string;
    documentos: { titulo: string } | null;
  } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Conteos (la RLS ya limita al proceso del usuario).
  const [expedientesCount, documentosCount, notifNoLeidas] = await Promise.all([
    supabase
      .from("expedientes")
      .select("*", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    supabase
      .from("documentos")
      .select("*", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    supabase
      .from("notificaciones")
      .select("*", { count: "exact", head: true })
      .eq("leida", false)
      .then((r) => r.count ?? 0),
  ]);

  // Mis aprobaciones pendientes (pasos en turno).
  const { data: pasosData } = await supabase
    .from("aprobacion_pasos")
    .select(
      "id, orden, aprobacion_solicitudes!inner(estado, paso_actual, documento_id, documentos(titulo))",
    )
    .eq("aprobador_id", user?.id ?? "")
    .eq("estado", "pendiente");
  const misAprobaciones = ((pasosData ?? []) as unknown as PasoPend[]).filter(
    (p) =>
      p.aprobacion_solicitudes?.estado === "en_curso" &&
      p.orden === p.aprobacion_solicitudes?.paso_actual,
  );

  // Vencimientos de retención (archivo de gestión).
  const { data: expData } = await supabase
    .from("expedientes")
    .select(
      "id, titulo, fecha_apertura, subseries(retencion_gestion), procesos(nombre)",
    )
    .limit(500);
  const hoy = new Date();
  const vencimientos = ((expData ?? []) as unknown as ExpedienteRet[])
    .map((e) => {
      const fecha = vencimientoGestion(
        e.fecha_apertura,
        e.subseries?.retencion_gestion,
      );
      return { exp: e, fecha, estado: estadoVencimiento(fecha, hoy) };
    })
    .filter((v) => v.estado === "vencido" || v.estado === "proximo")
    .sort((a, b) => (a.fecha?.getTime() ?? 0) - (b.fecha?.getTime() ?? 0));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Panel</h1>
        <p className="text-muted-foreground">
          Resumen de la gestión documental de tu proceso.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<FolderArchive className="size-5" />}
          num={expedientesCount}
          label="Expedientes"
          href="/expedientes"
        />
        <Kpi
          icon={<FileStack className="size-5" />}
          num={documentosCount}
          label="Documentos"
          href="/documentos"
        />
        <Kpi
          icon={<ClipboardCheck className="size-5" />}
          num={misAprobaciones.length}
          label="Pendientes de tu firma"
          href="/aprobaciones"
          warn={misAprobaciones.length > 0}
        />
        <Kpi
          icon={<CalendarClock className="size-5" />}
          num={vencimientos.length}
          label="Vencimientos de retención"
          warn={vencimientos.length > 0}
        />
      </div>

      {notifNoLeidas > 0 && (
        <Link
          href="/notificaciones"
          className="flex items-center justify-between rounded-lg border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm"
        >
          <span>
            Tienes <b>{notifNoLeidas}</b> notificación
            {notifNoLeidas === 1 ? "" : "es"} sin leer.
          </span>
          <ArrowRight className="size-4" />
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mis aprobaciones */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Pendientes de tu firma</h2>
            <Link
              href="/aprobaciones"
              className="text-sm text-primary hover:underline"
            >
              Ver todo
            </Link>
          </div>
          {misAprobaciones.length === 0 ? (
            <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
              No tienes documentos pendientes de aprobar.
            </p>
          ) : (
            <ul className="space-y-2">
              {misAprobaciones.slice(0, 5).map((p) => {
                const s = p.aprobacion_solicitudes!;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/documentos/${s.documento_id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary"
                    >
                      <span className="truncate">
                        {s.documentos?.titulo ?? "Documento"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Paso {p.orden}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Vencimientos */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Retención por vencer</h2>
          {vencimientos.length === 0 ? (
            <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
              No hay expedientes próximos a vencer su retención.
            </p>
          ) : (
            <ul className="space-y-2">
              {vencimientos.slice(0, 5).map((v) => (
                <li
                  key={v.exp.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/expedientes/${v.exp.id}`}
                      className="block truncate font-medium text-primary hover:underline"
                    >
                      {v.exp.titulo}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {v.exp.procesos?.nombre ?? ""} ·{" "}
                      {v.fecha?.toLocaleDateString("es-CO")}
                    </span>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded px-2 py-0.5 text-xs font-medium " +
                      (v.estado === "vencido"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-secondary/15 text-secondary")
                    }
                  >
                    {ESTADO_VENCIMIENTO_LABELS[v.estado]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  num,
  label,
  href,
  warn,
}: {
  icon: React.ReactNode;
  num: number;
  label: string;
  href?: string;
  warn?: boolean;
}) {
  const inner = (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div
        className={
          "mb-3 flex size-9 items-center justify-center rounded-lg " +
          (warn
            ? "bg-secondary/15 text-secondary"
            : "bg-primary/10 text-primary")
        }
      >
        {icon}
      </div>
      <div className="text-3xl font-bold tabular-nums">{num}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-colors hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}
