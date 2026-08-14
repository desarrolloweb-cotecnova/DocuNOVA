/**
 * Monitoreo de Supabase: tipos, límites del Plan Free y utilidades de cálculo.
 *
 * Solo lógica pura (sin acceso a datos) para poder probarla y reutilizarla
 * tanto en el servidor como en el componente de cliente del módulo de
 * Configuración.
 */

export type TablaTamano = {
  schemaname: string;
  tablename: string;
  size_bytes: number;
  size_pretty: string;
};

export type Bucket = { name: string; public: boolean };

export type Keepalive = {
  ultimo_latido: string | null;
  origen: string;
  total_latidos: number;
};

export type Metricas = {
  timestamp: string;
  database: { total_size_bytes: number; total_size_pretty: string };
  tables: TablaTamano[];
  connections: { active: number; idle: number; total: number };
  auth: {
    total_users: number;
    confirmed_users: number;
    unconfirmed_users: number;
  };
  storage: {
    total_files: number;
    total_size_bytes: number;
    total_size_pretty: string;
    buckets: Bucket[];
  };
  keepalive: Keepalive;
};

/** Límites del Plan Free de Supabase (los que se pueden medir desde la BD). */
export const LIMITES_PLAN_FREE = {
  /** 500 MB de base de datos. */
  db_bytes: 500 * 1024 * 1024,
  /** 1 GB de Storage. */
  storage_bytes: 1024 * 1024 * 1024,
  /** 50 000 usuarios activos al mes en Auth. */
  usuarios_auth: 50_000,
  /** 60 conexiones concurrentes (pooler). */
  conexiones: 60,
} as const;

/**
 * Días sin actividad tras los que Supabase pausa un proyecto del Plan Free.
 * El keepalive debe latir con holgura antes de ese plazo.
 */
export const DIAS_PAUSA_PLAN_FREE = 7;

/** Días entre latidos programados del keepalive (cron externo e interno). */
export const DIAS_ENTRE_LATIDOS = 3;

export type NivelAlerta = "ok" | "atencion" | "critico";

export const ETIQUETA_NIVEL: Record<NivelAlerta, string> = {
  ok: "Normal",
  atencion: "Atención",
  critico: "Crítico",
};

/** Porcentaje de uso respecto al límite, acotado a [0, 100]. */
export function porcentaje(valor: number, limite: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(limite) || limite <= 0)
    return 0;
  return Math.min(100, Math.max(0, (valor / limite) * 100));
}

/** Nivel de alerta: crítico desde el 90 %, atención desde el 70 %. */
export function nivelAlerta(pct: number): NivelAlerta {
  if (pct >= 90) return "critico";
  if (pct >= 70) return "atencion";
  return "ok";
}

/** Formatea bytes con la unidad binaria más adecuada (B, KB, MB, GB, TB). */
export function formatearBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const unidades = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    unidades.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const valor = bytes / Math.pow(1024, i);
  return `${Number(valor.toFixed(i === 0 ? 0 : 2))} ${unidades[i]}`;
}

/** Texto relativo en español ("hace 5 min") para una fecha ISO. */
export function hace(iso: string, ahora: number = Date.now()): string {
  const segundos = Math.max(
    0,
    Math.floor((ahora - new Date(iso).getTime()) / 1000),
  );
  if (segundos < 60) return `hace ${segundos} s`;
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`;
  const dias = Math.floor(segundos / 86400);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

/**
 * Estado del keepalive frente al plazo de pausa del Plan Free: cuántos días
 * lleva el proyecto sin latido y si eso ya es motivo de alerta.
 */
export function estadoKeepalive(
  ultimoLatido: string | null,
  ahora: number = Date.now(),
): { diasSinLatido: number | null; nivel: NivelAlerta } {
  if (!ultimoLatido) return { diasSinLatido: null, nivel: "critico" };
  const ms = ahora - new Date(ultimoLatido).getTime();
  if (!Number.isFinite(ms)) return { diasSinLatido: null, nivel: "critico" };
  const dias = Math.max(0, ms / 86_400_000);
  // Crítico al acercarse al plazo de pausa; atención al pasarse del ritmo
  // previsto de latidos.
  const nivel: NivelAlerta =
    dias >= DIAS_PAUSA_PLAN_FREE - 2
      ? "critico"
      : dias > DIAS_ENTRE_LATIDOS
        ? "atencion"
        : "ok";
  return { diasSinLatido: Math.floor(dias), nivel };
}

/** Resumen global de las métricas para el banner del módulo. */
export function resumenAlertas(m: Metricas): {
  nivel: NivelAlerta;
  mensaje: string;
} {
  const pcts = [
    porcentaje(m.database.total_size_bytes, LIMITES_PLAN_FREE.db_bytes),
    porcentaje(m.storage.total_size_bytes, LIMITES_PLAN_FREE.storage_bytes),
    porcentaje(m.auth.total_users, LIMITES_PLAN_FREE.usuarios_auth),
    porcentaje(m.connections.total, LIMITES_PLAN_FREE.conexiones),
  ];
  const criticas = pcts.filter((p) => nivelAlerta(p) === "critico").length;
  const atencion = pcts.filter((p) => nivelAlerta(p) === "atencion").length;

  if (criticas > 0) {
    return {
      nivel: "critico",
      mensaje: `${criticas} métrica${criticas > 1 ? "s" : ""} por encima del 90 % del límite del Plan Free.`,
    };
  }
  if (atencion > 0) {
    return {
      nivel: "atencion",
      mensaje: `${atencion} métrica${atencion > 1 ? "s" : ""} por encima del 70 % del límite del Plan Free.`,
    };
  }
  return {
    nivel: "ok",
    mensaje: "Todos los recursos están dentro del rango normal del Plan Free.",
  };
}
