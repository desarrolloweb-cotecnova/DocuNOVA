"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  SESSION_EXPIRED_SIGNOUT_URL,
  SESSION_MAX_HOURS,
  SESSION_WARNING_MS,
} from "@/lib/auth/session-policy";
import { useToast } from "@/components/ui/toast";

/** Cada cuánto se comprueba la caducidad mientras la pestaña está abierta. */
const INTERVALO_MS = 30_000;

/**
 * Expulsa de la aplicación a la pestaña cuya sesión ya caducó.
 *
 * Quien decide es el servidor (el proxy y `requireAuth()`), pero una pestaña
 * abierta sin navegar no pasa por ellos: seguiría mostrando el panel de una
 * sesión muerta hasta el siguiente clic. Este vigilante cierra ese hueco.
 *
 * No basta con un `setTimeout`: si el equipo se suspende, el navegador congela
 * los temporizadores. Por eso se recomprueba al recuperar el foco y al volver a
 * hacer visible la pestaña, que es cuando el usuario retoma el trabajo.
 *
 * @param expiraEn Momento (epoch ms) de caducidad; `null` si no se conoce.
 */
export function SessionExpiryWatcher({
  expiraEn,
}: {
  expiraEn: number | null;
}) {
  const router = useRouter();
  const { mostrar } = useToast();

  useEffect(() => {
    if (expiraEn === null) return;

    let avisado = false;
    let expulsado = false;

    const comprobar = () => {
      if (expulsado) return;
      const restante = expiraEn - Date.now();

      if (restante <= 0) {
        expulsado = true;
        router.replace(SESSION_EXPIRED_SIGNOUT_URL);
        return;
      }

      if (!avisado && restante <= SESSION_WARNING_MS) {
        avisado = true;
        const minutos = Math.max(1, Math.round(restante / 60_000));
        mostrar(
          `Tu sesión caduca en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}. ` +
            `Cada sesión dura máximo ${SESSION_MAX_HOURS} horas: guarda los cambios ` +
            "y vuelve a iniciar sesión.",
          "error",
        );
      }
    };

    comprobar();

    const id = window.setInterval(comprobar, INTERVALO_MS);
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") comprobar();
    };

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("focus", comprobar);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("focus", comprobar);
    };
  }, [expiraEn, router, mostrar]);

  return null;
}
