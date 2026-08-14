import { NextResponse } from "next/server";
import { registrarLatido, monitoreoDisponible } from "@/services/monitoreo";

/**
 * Latido que mantiene despierto el proyecto de Supabase (Plan Free).
 *
 * Supabase pausa los proyectos gratuitos tras una semana sin actividad, y la
 * actividad se mide por peticiones al proyecto: por eso el latido se dispara
 * desde fuera (GitHub Actions, cada 3 días — ver .github/workflows/keepalive.yml)
 * y esta ruta lo traduce en una llamada real a la base de datos.
 *
 * Es pública a propósito (el cron externo no tiene sesión). Si se define
 * KEEPALIVE_SECRET, exige ese token en `Authorization: Bearer …` o `?token=`.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secreto = process.env.KEEPALIVE_SECRET?.trim();

  if (secreto) {
    const { searchParams } = new URL(request.url);
    const enviado =
      request.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "")
        .trim() ??
      searchParams.get("token")?.trim() ??
      "";
    if (enviado !== secreto) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  if (!monitoreoDisponible()) {
    return NextResponse.json(
      {
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY: sin la clave de servicio no se puede registrar el latido.",
      },
      { status: 503 },
    );
  }

  try {
    const keepalive = await registrarLatido("cron-externo");
    return NextResponse.json(
      { ok: true, ...keepalive },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
