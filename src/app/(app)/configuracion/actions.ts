"use server";

import { gestionaUsuarios } from "@/lib/roles";
import { requireCapacidad } from "@/lib/auth/roles-server";
import {
  monitoreoDisponible,
  obtenerMetricas,
  registrarLatido,
} from "@/services/monitoreo";
import type { Keepalive, Metricas } from "@/lib/monitoreo";

/**
 * Acciones del módulo de Configuración. Las métricas se consultan bajo demanda
 * (botón "Actualizar") y no al pintar la página: son consultas al catálogo del
 * sistema y no tiene sentido pagarlas en cada navegación.
 *
 * Ambas acciones exigen rol de gestión de usuarios (superadmin/rector), el mismo
 * que ya gobierna el módulo de Gestión.
 */

export type ResultadoMetricas =
  { ok: true; metricas: Metricas } | { ok: false; error: string };

export async function consultarMetricas(): Promise<ResultadoMetricas> {
  await requireCapacidad(gestionaUsuarios);

  if (!monitoreoDisponible()) {
    return {
      ok: false,
      error:
        "Falta la clave de servicio (SUPABASE_SERVICE_ROLE_KEY) en el entorno. " +
        "Configúrala en Vercel para habilitar el monitoreo.",
    };
  }

  try {
    return { ok: true, metricas: await obtenerMetricas() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error desconocido",
    };
  }
}

export type ResultadoLatido =
  { ok: true; keepalive: Keepalive } | { ok: false; error: string };

/** Latido manual desde la interfaz (el automático lo dispara el cron). */
export async function latirAhora(): Promise<ResultadoLatido> {
  await requireCapacidad(gestionaUsuarios);

  if (!monitoreoDisponible()) {
    return {
      ok: false,
      error: "Falta la clave de servicio (SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  try {
    return { ok: true, keepalive: await registrarLatido("manual") };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error desconocido",
    };
  }
}
