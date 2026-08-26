import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Impersonación ("iniciar sesión como") del módulo de Configuración. SOLO servidor.
 *
 * El intercambio de sesión (forjar la sesión del usuario objetivo) vive en las
 * server actions; aquí están las piezas transversales:
 *  - un marcador FIRMADO (HMAC) que identifica una sesión como impersonada, para
 *    que el guard de auth omita el segundo factor (aal2) solo en ese caso; y
 *  - el respaldo/restauración de las cookies de sesión de Supabase, para poder
 *    volver a la cuenta del administrador con un clic.
 *
 * El marcador va firmado con la service_role key (secreto de servidor) para que
 * un usuario no pueda fabricarlo y saltarse su propio MFA.
 */

/** Marcador httpOnly y firmado: `actorId:objetivoId:hmac`. */
export const IMPERSONATOR_COOKIE = "docunova-imp";
/** Respaldo httpOnly de las cookies de sesión del administrador (base64 JSON). */
export const BACKUP_COOKIE = "docunova-imp-backup";

const MAX_EDAD = 60 * 60 * 8; // 8 horas

function secreto(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

function firma(payload: string, clave: string): string {
  return createHmac("sha256", clave).update(payload).digest("hex");
}

/** Devuelve el valor de cookie firmado para (actor → objetivo). */
export function firmarMarcador(actorId: string, objetivoId: string): string {
  const clave = secreto();
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para firmar.");
  const payload = `${actorId}:${objetivoId}`;
  return `${payload}:${firma(payload, clave)}`;
}

/** Verifica el marcador; devuelve los ids o null si es inválido. */
export function verificarMarcador(
  valor: string | undefined,
): { actorId: string; objetivoId: string } | null {
  const clave = secreto();
  if (!clave || !valor) return null;
  const partes = valor.split(":");
  if (partes.length !== 3) return null;
  const [actorId, objetivoId, mac] = partes;
  const esperado = firma(`${actorId}:${objetivoId}`, clave);
  const a = Buffer.from(mac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { actorId, objetivoId };
}

/** Lee y verifica el marcador de impersonación de la petición actual. */
export async function leerImpersonacion(): Promise<{
  actorId: string;
  objetivoId: string;
} | null> {
  const store = await cookies();
  return verificarMarcador(store.get(IMPERSONATOR_COOKIE)?.value);
}

/** ¿La sesión actual es una impersonación válida? (para omitir el aal2). */
export async function esSesionImpersonada(): Promise<boolean> {
  return (await leerImpersonacion()) !== null;
}

// --- Respaldo/restauración de las cookies de sesión de Supabase --------------

function esCookieSesion(name: string): boolean {
  return name.startsWith("sb-") && name.includes("auth-token");
}

const OPCIONES_SESION = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 400,
};

/**
 * Guarda las cookies de sesión actuales (del administrador) en una cookie de
 * respaldo httpOnly y las elimina, dejando el store listo para la sesión del
 * objetivo. Debe llamarse ANTES de forjar la sesión del objetivo.
 */
export async function respaldarYlimpiarSesion(): Promise<void> {
  const store = await cookies();
  const sesion = store
    .getAll()
    .filter((c) => esCookieSesion(c.name))
    .map((c) => ({ name: c.name, value: c.value }));

  store.set(
    BACKUP_COOKIE,
    Buffer.from(JSON.stringify(sesion)).toString("base64"),
    {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: MAX_EDAD,
    },
  );

  for (const c of sesion) store.delete(c.name);
}

/**
 * Restaura las cookies de sesión del administrador desde el respaldo y borra el
 * marcador y el respaldo. Devuelve true si había una sesión que restaurar.
 */
export async function restaurarSesion(): Promise<boolean> {
  const store = await cookies();
  const respaldo = store.get(BACKUP_COOKIE)?.value;

  // Elimina la sesión del objetivo y los rastros de impersonación.
  for (const c of store.getAll()) {
    if (esCookieSesion(c.name)) store.delete(c.name);
  }
  store.delete(IMPERSONATOR_COOKIE);
  store.delete(BACKUP_COOKIE);

  if (!respaldo) return false;
  try {
    const sesion = JSON.parse(
      Buffer.from(respaldo, "base64").toString("utf8"),
    ) as { name: string; value: string }[];
    for (const c of sesion) store.set(c.name, c.value, OPCIONES_SESION);
    return sesion.length > 0;
  } catch {
    return false;
  }
}

/** Fija el marcador firmado de impersonación (httpOnly). */
export async function fijarMarcador(
  actorId: string,
  objetivoId: string,
): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATOR_COOKIE, firmarMarcador(actorId, objetivoId), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_EDAD,
  });
}
