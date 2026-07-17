import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { listMisNotificaciones } from "@/services/notificaciones";
import { TIPO_NOTIFICACION_LABELS, labelDe } from "@/lib/tipos";
import { notificacionHref } from "@/lib/notificaciones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { marcarLeida, marcarTodasLeidas } from "./actions";

export const metadata: Metadata = {
  title: `Notificaciones — ${APP_NAME}`,
};

export default async function NotificacionesPage() {
  const notifs = await listMisNotificaciones(200);
  const noLeidas = notifs.filter((n) => !n.leida);
  const leidas = notifs.filter((n) => n.leida);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {noLeidas.length > 0 && (
        <div className="flex justify-end">
          <form action={marcarTodasLeidas}>
            <SubmitButton
              size="sm"
              variant="outline"
              textoPendiente="Marcando…"
              exito="Notificaciones marcadas como leídas."
            >
              <CheckCheck className="size-4" />
              Marcar todas como leídas
            </SubmitButton>
          </form>
        </div>
      )}

      {notifs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Bell className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No tienes notificaciones.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {noLeidas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  No leídas ({noLeidas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 p-0">
                <ul className="divide-y">
                  {noLeidas.map((n) => (
                    <li
                      key={n.id}
                      className="flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <Link
                        href={notificacionHref(n)}
                        className="min-w-0 flex-1"
                      >
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className="size-2 shrink-0 rounded-full bg-secondary" />
                          {n.asunto}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {labelDe(TIPO_NOTIFICACION_LABELS, n.tipo)} ·{" "}
                          {new Date(n.creado_en).toLocaleString("es-CO")}
                        </p>
                        {n.mensaje && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {n.mensaje}
                          </p>
                        )}
                      </Link>
                      <form action={marcarLeida}>
                        <input type="hidden" name="id" value={n.id} />
                        <SubmitButton size="sm" variant="ghost" exito="Marcada como leída.">
                          Marcar leída
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {leidas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Leídas ({leidas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 p-0">
                <ul className="divide-y">
                  {leidas.map((n) => (
                    <li key={n.id} className="px-6 py-3">
                      <Link href={notificacionHref(n)}>
                        <p className="text-sm">{n.asunto}</p>
                        <p className="text-xs text-muted-foreground">
                          {labelDe(TIPO_NOTIFICACION_LABELS, n.tipo)} ·{" "}
                          {new Date(n.creado_en).toLocaleString("es-CO")}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
