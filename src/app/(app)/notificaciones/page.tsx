import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";
import {
  tipoNotificacionLabel,
  notificacionHref,
  type Notificacion,
} from "@/lib/notificaciones";
import { marcarLeida } from "./actions";

export const metadata: Metadata = {
  title: `Notificaciones — ${APP_NAME}`,
};

export default async function NotificacionesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notificaciones")
    .select(
      "id, tipo, asunto, cuerpo, entidad_tipo, entidad_id, estado, leida, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const notificaciones = (data ?? []) as Notificacion[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notificaciones</h1>
        <p className="text-muted-foreground">
          Avisos sobre aprobaciones y vencimientos de tus documentos.
        </p>
      </div>

      {notificaciones.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center text-muted-foreground">
          <BellOff className="size-8" />
          <p>No tienes notificaciones.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notificaciones.map((n) => {
            const href = notificacionHref(n);
            return (
              <li
                key={n.id}
                className={
                  "rounded-lg border p-4 " +
                  (n.leida ? "bg-card" : "border-primary/30 bg-primary/5")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.leida && (
                        <Bell className="size-4 shrink-0 text-primary" />
                      )}
                      <p className="font-medium">{n.asunto}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tipoNotificacionLabel(n.tipo)} ·{" "}
                      {new Date(n.created_at).toLocaleString("es-CO")}
                      {n.estado === "pendiente"
                        ? " · envío por correo pendiente"
                        : ""}
                    </p>
                    {n.cuerpo && <p className="mt-1 text-sm">{n.cuerpo}</p>}
                    {href && (
                      <Link
                        href={href}
                        className="mt-1 inline-block text-sm text-primary hover:underline"
                      >
                        Ver documento →
                      </Link>
                    )}
                  </div>
                  {!n.leida && (
                    <form action={marcarLeida}>
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Marcar leída
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
