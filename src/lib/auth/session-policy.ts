/**
 * Política de caducidad de sesión.
 *
 * Problema que resuelve: Supabase renueva el token de acceso indefinidamente
 * mientras el refresh token siga vivo, así que una pestaña abierta mantiene la
 * sesión durante días sin volver a pedir credenciales. Un equipo compartido o
 * desatendido queda expuesto todo ese tiempo.
 *
 * Regla: la sesión caduca a las SESSION_MAX_HOURS horas contadas desde el
 * inicio de sesión REAL, se use la aplicación o no. No es un temporizador de
 * inactividad: dentro de esa ventana nadie es expulsado por dejar de escribir.
 * Como el tope (8 h) es menor que un día, nadie puede arrastrar la misma sesión
 * de una jornada a la siguiente: cada día hay que volver a autenticarse.
 *
 * Se aplica en el servidor —el proxy y `requireAuth()`— sobre el usuario que
 * devuelve `supabase.auth.getUser()`, que está verificado contra el servidor de
 * autenticación. El navegador no participa en la decisión.
 */

/** Duración máxima de una sesión, en horas, desde el inicio de sesión. */
export const SESSION_MAX_HOURS = 8;

export const SESSION_MAX_MS = SESSION_MAX_HOURS * 60 * 60 * 1000;

/** Antelación con la que se avisa al usuario de que la sesión va a caducar. */
export const SESSION_WARNING_MS = 5 * 60 * 1000;

/** `reason` con el que /login explica la expulsión. */
export const SESSION_EXPIRED_REASON = "expirada";

/** Ruta que cierra la sesión caducada y devuelve al login con el aviso. */
export const SESSION_EXPIRED_SIGNOUT_URL = `/auth/signout?reason=${SESSION_EXPIRED_REASON}`;

/** Lo mínimo que necesita la política de un usuario de Supabase. */
type SessionUser = { last_sign_in_at?: string | null };

/**
 * Momento (epoch ms) del inicio de sesión, o `null` si no se puede determinar.
 *
 * `last_sign_in_at` lo fija el servidor de Supabase en cada inicio de sesión y
 * **no** se actualiza al renovar el token: por eso sirve como ancla de la
 * ventana y por eso el cliente no puede estirarla.
 */
export function getSessionStart(user: SessionUser): number | null {
  if (!user.last_sign_in_at) return null;
  const parsed = Date.parse(user.last_sign_in_at);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Momento (epoch ms) en que la sesión deja de ser válida, si se conoce. */
export function getSessionExpiry(user: SessionUser): number | null {
  const start = getSessionStart(user);
  return start === null ? null : start + SESSION_MAX_MS;
}

/** Milisegundos que le quedan a la sesión; `null` si no se puede calcular. */
export function getSessionTimeLeft(
  user: SessionUser,
  now: number = Date.now(),
): number | null {
  const expiry = getSessionExpiry(user);
  return expiry === null ? null : expiry - now;
}

/**
 * ¿La sesión superó la ventana máxima?
 *
 * Si falta `last_sign_in_at` se responde que no: sin ancla no hay forma de
 * medir la ventana, y responder que sí encerraría al usuario en un bucle
 * login → expulsión → login del que no podría salir.
 */
export function isSessionExpired(
  user: SessionUser,
  now: number = Date.now(),
): boolean {
  const timeLeft = getSessionTimeLeft(user, now);
  return timeLeft !== null && timeLeft <= 0;
}
