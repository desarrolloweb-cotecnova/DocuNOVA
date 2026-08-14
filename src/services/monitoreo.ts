import { createAdminClient } from "@/lib/supabase/admin";
import type { Bucket, Keepalive, Metricas, TablaTamano } from "@/lib/monitoreo";

/**
 * Lectura de las métricas de Supabase. Las funciones `monitor_*` (migración
 * 0013) solo pueden ejecutarlas la clave de servicio, así que todo esto es
 * exclusivamente de servidor: el llamador debe comprobar antes el rol del
 * usuario (ver src/app/(app)/configuracion/actions.ts).
 */

/** ¿Está configurada la clave de servicio? Sin ella no hay monitoreo. */
export function monitoreoDisponible(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

type Json = Record<string, unknown> | null;

function num(json: Json, clave: string): number {
  const v = json?.[clave];
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

function texto(json: Json, clave: string, porDefecto: string): string {
  const v = json?.[clave];
  return typeof v === "string" && v !== "" ? v : porDefecto;
}

/**
 * Consulta todas las métricas del proyecto. Cada RPC se resuelve por separado y
 * su fallo degrada solo su bloque (ceros) en lugar de tumbar la pantalla: así el
 * módulo sigue siendo útil aunque, por ejemplo, no exista aún el esquema de
 * Storage.
 */
export async function obtenerMetricas(): Promise<Metricas> {
  const admin = createAdminClient();

  const [db, tablas, conexiones, usuarios, storage, buckets, keepalive] =
    await Promise.all([
      admin.rpc("monitor_get_db_size"),
      admin.rpc("monitor_get_table_sizes"),
      admin.rpc("monitor_get_active_connections"),
      admin.rpc("monitor_get_auth_users_count"),
      admin.rpc("monitor_get_storage_stats"),
      admin.rpc("monitor_get_buckets"),
      admin.rpc("monitor_keepalive_estado"),
    ]);

  // Si la migración 0013 no se ha aplicado, todas las RPC fallan igual: avisamos
  // con un mensaje accionable en vez de mostrar un tablero en ceros.
  if (db.error) {
    throw new Error(
      `No se pudieron leer las métricas de Supabase (${db.error.message}). ` +
        "Revisa que la migración 0013_monitoreo_supabase.sql esté aplicada en el proyecto.",
    );
  }

  const dbJson = db.data as Json;
  const connJson = conexiones.data as Json;
  const authJson = usuarios.data as Json;
  const storageJson = storage.data as Json;
  const kaJson = keepalive.data as Json;

  return {
    timestamp: new Date().toISOString(),
    database: {
      total_size_bytes: num(dbJson, "size_bytes"),
      total_size_pretty: texto(dbJson, "size_pretty", "0 bytes"),
    },
    tables: ((tablas.data as TablaTamano[] | null) ?? []).filter(Boolean),
    connections: {
      active: num(connJson, "active_count"),
      idle: num(connJson, "idle_count"),
      total: num(connJson, "total_count"),
    },
    auth: {
      total_users: num(authJson, "total_users"),
      confirmed_users: num(authJson, "confirmed_users"),
      unconfirmed_users: num(authJson, "unconfirmed_users"),
    },
    storage: {
      total_files: num(storageJson, "total_files"),
      total_size_bytes: num(storageJson, "total_size_bytes"),
      total_size_pretty: texto(storageJson, "total_size_pretty", "0 bytes"),
      buckets: ((buckets.data as Bucket[] | null) ?? []).filter(Boolean),
    },
    keepalive: {
      ultimo_latido:
        typeof kaJson?.ultimo_latido === "string" ? kaJson.ultimo_latido : null,
      origen: texto(kaJson, "origen", "desconocido"),
      total_latidos: num(kaJson, "total_latidos"),
    },
  };
}

/**
 * Registra un latido: escribe la marca de tiempo y consulta el tamaño de la BD.
 * La petición viaja por la API de Supabase, que es lo que cuenta como actividad
 * del proyecto para no caer en la pausa automática del Plan Free.
 */
export async function registrarLatido(origen: string): Promise<Keepalive> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("monitor_keepalive", {
    p_origen: origen,
  });
  if (error) throw new Error(error.message);

  const json = data as Json;
  return {
    ultimo_latido:
      typeof json?.ultimo_latido === "string" ? json.ultimo_latido : null,
    origen: texto(json, "origen", origen),
    total_latidos: num(json, "total_latidos"),
  };
}
