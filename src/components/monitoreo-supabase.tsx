"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  FolderOpen,
  HardDrive,
  Network,
  RefreshCw,
  Server,
  TableProperties,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  DIAS_ENTRE_LATIDOS,
  DIAS_PAUSA_PLAN_FREE,
  ETIQUETA_NIVEL,
  LIMITES_PLAN_FREE,
  estadoKeepalive,
  formatearBytes,
  hace,
  nivelAlerta,
  porcentaje,
  resumenAlertas,
  type Metricas,
  type NivelAlerta,
} from "@/lib/monitoreo";
import {
  consultarMetricas,
  latirAhora,
} from "@/app/(app)/configuracion/monitoreo-actions";

/**
 * Monitoreo de Supabase: uso del proyecto frente a los límites del Plan Free y
 * estado del keepalive que evita la pausa por inactividad. Las métricas se
 * piden al servidor al abrir la pantalla y con el botón "Actualizar".
 */

const ESTILOS_NIVEL: Record<
  NivelAlerta,
  { barra: string; texto: string; etiqueta: string }
> = {
  ok: {
    barra: "bg-emerald-500",
    texto: "text-emerald-600",
    etiqueta: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  atencion: {
    barra: "bg-amber-500",
    texto: "text-amber-600",
    etiqueta: "border-amber-200 bg-amber-50 text-amber-700",
  },
  critico: {
    barra: "bg-destructive",
    texto: "text-destructive",
    etiqueta: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

function IconoNivel({
  nivel,
  className,
}: {
  nivel: NivelAlerta;
  className?: string;
}) {
  const clase = cn("size-4 shrink-0", className);
  if (nivel === "critico")
    return <XCircle className={cn(clase, "text-destructive")} />;
  if (nivel === "atencion")
    return <AlertTriangle className={cn(clase, "text-amber-600")} />;
  return <CheckCircle2 className={cn(clase, "text-emerald-600")} />;
}

function BarraUso({
  etiqueta,
  actual,
  limite,
  formato,
  detalle,
}: {
  etiqueta: string;
  actual: number;
  limite: number;
  formato: (v: number) => string;
  detalle?: string;
}) {
  const pct = porcentaje(actual, limite);
  const nivel = nivelAlerta(pct);
  const estilos = ESTILOS_NIVEL[nivel];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <IconoNivel nivel={nivel} />
          <span className="truncate text-sm font-medium">{etiqueta}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={cn("text-xs font-semibold", estilos.texto)}>
            {pct.toFixed(1)}%
          </span>
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-xs font-medium",
              estilos.etiqueta,
            )}
          >
            {ETIQUETA_NIVEL[nivel]}
          </span>
        </span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", estilos.barra)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{formato(actual)}</span>{" "}
          usado
          {detalle ? ` · ${detalle}` : ""}
        </span>
        <span>
          Límite:{" "}
          <span className="font-medium text-foreground">{formato(limite)}</span>
        </span>
      </div>
    </div>
  );
}

export function MonitoreoSupabase() {
  const { mostrar } = useToast();
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, empezar] = useTransition();
  const [latiendo, empezarLatido] = useTransition();

  const cargar = useCallback(
    (avisar: boolean) => {
      empezar(async () => {
        const r = await consultarMetricas();
        if (r.ok) {
          setMetricas(r.metricas);
          setError(null);
          if (avisar) mostrar("Métricas actualizadas.");
        } else {
          setError(r.error);
          if (avisar) mostrar(r.error, "error");
        }
      });
    },
    [mostrar],
  );

  // Primera carga al abrir el módulo.
  useEffect(() => {
    cargar(false);
  }, [cargar]);

  const latir = () => {
    empezarLatido(async () => {
      const r = await latirAhora();
      if (r.ok) {
        setMetricas((m) => (m ? { ...m, keepalive: r.keepalive } : m));
        mostrar("Latido registrado: el proyecto queda activo.");
      } else {
        mostrar(r.error, "error");
      }
    });
  };

  const resumen = metricas ? resumenAlertas(metricas) : null;
  const ka = metricas
    ? estadoKeepalive(metricas.keepalive.ultimo_latido)
    : null;
  const maxTabla = Math.max(
    1,
    ...(metricas?.tables ?? []).map((t) => t.size_bytes),
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Server className="size-5 text-primary" />
            Monitoreo de Supabase
          </h2>
          <p className="text-sm text-muted-foreground">
            Uso actual frente a los límites del{" "}
            <span className="font-medium text-foreground">Plan Free</span>. El
            keepalive mantiene el proyecto activo para que la base de datos no
            se pause por inactividad.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {metricas && (
            <span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
              <Clock className="size-3" />
              Actualizado {hace(metricas.timestamp)}
            </span>
          )}
          <Button onClick={() => cargar(true)} disabled={cargando}>
            <RefreshCw className={cn("size-4", cargando && "animate-spin")} />
            {cargando ? "Consultando…" : "Actualizar"}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 py-4">
          <CardContent className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                No se pudieron obtener las métricas
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!metricas && cargando && (
        <p className="text-sm text-muted-foreground">
          Consultando el proyecto…
        </p>
      )}

      {metricas && (
        <>
          {/* Resumen global */}
          {resumen && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium",
                ESTILOS_NIVEL[resumen.nivel].etiqueta,
              )}
            >
              <IconoNivel nivel={resumen.nivel} className="size-5" />
              {resumen.mensaje}
            </div>
          )}

          {/* Keepalive */}
          <Card className="py-5">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {ka && (
                  <IconoNivel nivel={ka.nivel} className="mt-0.5 size-5" />
                )}
                <div>
                  <p className="text-sm font-medium">Keepalive del Plan Free</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {metricas.keepalive.ultimo_latido
                      ? `Último latido ${hace(metricas.keepalive.ultimo_latido)} (${metricas.keepalive.origen}), ${metricas.keepalive.total_latidos} en total.`
                      : "Todavía no se ha registrado ningún latido."}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Un cron externo late cada {DIAS_ENTRE_LATIDOS} días;
                    Supabase pausa los proyectos gratuitos tras{" "}
                    {DIAS_PAUSA_PLAN_FREE} días sin actividad.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={latir}
                disabled={latiendo}
                className="shrink-0"
              >
                <Clock className={cn("size-4", latiendo && "animate-spin")} />
                {latiendo ? "Registrando…" : "Latir ahora"}
              </Button>
            </CardContent>
          </Card>

          {/* Indicadores rápidos */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                etiqueta: "Base de datos",
                valor: metricas.database.total_size_pretty,
                sub: `de ${formatearBytes(LIMITES_PLAN_FREE.db_bytes)}`,
                icono: <Database className="size-5 text-primary" />,
              },
              {
                etiqueta: "Storage",
                valor: metricas.storage.total_size_pretty,
                sub: `${metricas.storage.total_files} archivo${metricas.storage.total_files === 1 ? "" : "s"}`,
                icono: <HardDrive className="size-5 text-primary" />,
              },
              {
                etiqueta: "Usuarios Auth",
                valor: metricas.auth.total_users.toLocaleString("es-CO"),
                sub: `${metricas.auth.confirmed_users} confirmados`,
                icono: <Users className="size-5 text-primary" />,
              },
              {
                etiqueta: "Conexiones",
                valor: String(metricas.connections.total),
                sub: `${metricas.connections.active} activas · ${metricas.connections.idle} inactivas`,
                icono: <Network className="size-5 text-primary" />,
              },
            ].map((kpi) => (
              <Card key={kpi.etiqueta} className="gap-2 py-4">
                <CardContent className="flex flex-col gap-2 px-4">
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {kpi.icono}
                    {kpi.etiqueta}
                  </span>
                  <span className="text-xl leading-none font-bold">
                    {kpi.valor}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {kpi.sub}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Uso frente a límites */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="size-4 text-primary" />
                  Base de datos y conexiones
                </CardTitle>
                <CardDescription>
                  Almacenamiento relacional y conexiones concurrentes
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <BarraUso
                  etiqueta="Almacenamiento de la BD"
                  actual={metricas.database.total_size_bytes}
                  limite={LIMITES_PLAN_FREE.db_bytes}
                  formato={formatearBytes}
                />
                <BarraUso
                  etiqueta="Conexiones"
                  actual={metricas.connections.total}
                  limite={LIMITES_PLAN_FREE.conexiones}
                  formato={(v) => String(v)}
                  detalle={`${metricas.connections.active} activas`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="size-4 text-primary" />
                  Storage y autenticación
                </CardTitle>
                <CardDescription>
                  Archivos almacenados y usuarios registrados
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <BarraUso
                  etiqueta="Almacenamiento de Storage"
                  actual={metricas.storage.total_size_bytes}
                  limite={LIMITES_PLAN_FREE.storage_bytes}
                  formato={formatearBytes}
                  detalle={`${metricas.storage.total_files} archivos`}
                />
                <BarraUso
                  etiqueta="Usuarios de Auth"
                  actual={metricas.auth.total_users}
                  limite={LIMITES_PLAN_FREE.usuarios_auth}
                  formato={(v) => v.toLocaleString("es-CO")}
                  detalle={`${metricas.auth.confirmed_users} confirmados`}
                />
              </CardContent>
            </Card>
          </div>

          {/* Tablas más pesadas */}
          {metricas.tables.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TableProperties className="size-4 text-primary" />
                  Tablas más pesadas
                </CardTitle>
                <CardDescription>
                  Las 10 tablas que más espacio ocupan (datos e índices)
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {metricas.tables.map((t) => (
                  <div
                    key={`${t.schemaname}.${t.tablename}`}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="w-40 shrink-0 truncate text-right text-xs text-muted-foreground"
                      title={`${t.schemaname}.${t.tablename}`}
                    >
                      {t.tablename}
                    </span>
                    <span className="h-5 min-w-0 flex-1 overflow-hidden rounded bg-muted">
                      <span
                        className="block h-full rounded bg-primary/70"
                        style={{ width: `${(t.size_bytes / maxTabla) * 100}%` }}
                      />
                    </span>
                    <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">
                      {t.size_pretty}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Buckets */}
          {metricas.storage.buckets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderOpen className="size-4 text-primary" />
                  Buckets de Storage
                </CardTitle>
                <CardDescription>
                  Contenedores de archivos configurados en el proyecto
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {metricas.storage.buckets.map((b) => (
                  <span
                    key={b.name}
                    className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <FolderOpen className="size-4 shrink-0 text-primary" />
                    <span className="font-medium">{b.name}</span>
                    <span className="rounded-full border px-1.5 py-0.5 text-xs text-muted-foreground">
                      {b.public ? "Público" : "Privado"}
                    </span>
                  </span>
                ))}
              </CardContent>
            </Card>
          )}

          <p className="text-right text-xs text-muted-foreground">
            Datos obtenidos el{" "}
            {new Date(metricas.timestamp).toLocaleString("es-CO")}
          </p>
        </>
      )}
    </div>
  );
}
