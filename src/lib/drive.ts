import { createSign } from "node:crypto";

/**
 * Integración con Google Drive para el módulo de Memoria Corporativa.
 *
 * Los archivos se guardan en una carpeta del Drive institucional
 * (docunova@cotecnova.edu.co) usando una cuenta de servicio de Google Cloud.
 * La app nunca ve la contraseña de la cuenta: firma un JWT con la clave privada
 * de la cuenta de servicio y lo canjea por un token de acceso.
 *
 * Variables de entorno (ver docs/DRIVE.md):
 *   GOOGLE_DRIVE_CLIENT_EMAIL  correo de la cuenta de servicio
 *   GOOGLE_DRIVE_PRIVATE_KEY   clave privada PEM de la cuenta de servicio
 *   GOOGLE_DRIVE_FOLDER_ID     ID de la carpeta destino en Drive
 *   GOOGLE_DRIVE_SUBJECT       (opcional) usuario a suplantar con delegación
 *                              de dominio, p. ej. docunova@cotecnova.edu.co
 *
 * Si faltan las tres primeras, `driveConfigurado()` devuelve false y el módulo
 * de Memoria sigue guardando en el bucket 'memoria' de Supabase Storage.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export type DriveArchivo = {
  id: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  webViewLink: string | null;
  parents: string[];
};

type Config = {
  clientEmail: string;
  privateKey: string;
  folderId: string;
  subject: string | null;
};

function leerConfig(): Config | null {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim();
  // En Vercel la clave se pega en una sola línea con "\n" literales.
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  ).trim();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!clientEmail || !privateKey || !folderId) return null;
  return {
    clientEmail,
    privateKey,
    folderId,
    subject: process.env.GOOGLE_DRIVE_SUBJECT?.trim() || null,
  };
}

/** ¿Está configurado el Drive institucional como destino de los archivos? */
export function driveConfigurado(): boolean {
  return leerConfig() !== null;
}

/** ID de la carpeta destino (lanza si Drive no está configurado). */
export function carpetaDrive(): string {
  return requerirConfig().folderId;
}

function requerirConfig(): Config {
  const cfg = leerConfig();
  if (!cfg) {
    throw new Error(
      "Google Drive no está configurado: faltan GOOGLE_DRIVE_CLIENT_EMAIL, " +
        "GOOGLE_DRIVE_PRIVATE_KEY o GOOGLE_DRIVE_FOLDER_ID (ver docs/DRIVE.md).",
    );
  }
  return cfg;
}

function base64url(valor: string | Buffer): string {
  return Buffer.from(valor)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Token de acceso vigente, memorizado hasta poco antes de que expire. */
let cache: { token: string; expiraEn: number } | null = null;

async function accessToken(): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  if (cache && cache.expiraEn > ahora + 60) return cache.token;

  const cfg = requerirConfig();
  const encabezado = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(
    JSON.stringify({
      iss: cfg.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: ahora,
      exp: ahora + 3600,
      // Con delegación de dominio, actúa como el usuario indicado (así los
      // archivos quedan a nombre de docunova@cotecnova.edu.co).
      ...(cfg.subject ? { sub: cfg.subject } : {}),
    }),
  );
  const firma = base64url(
    createSign("RSA-SHA256")
      .update(`${encabezado}.${cuerpo}`)
      .sign(cfg.privateKey),
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${encabezado}.${cuerpo}.${firma}`,
    }),
  });
  const datos = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !datos.access_token) {
    throw new Error(
      `Google rechazó las credenciales de Drive: ${
        datos.error_description ?? datos.error ?? res.status
      }`,
    );
  }

  cache = {
    token: datos.access_token,
    expiraEn: ahora + (datos.expires_in ?? 3600),
  };
  return cache.token;
}

/**
 * Abre una sesión de carga reanudable y devuelve la URL a la que el navegador
 * sube los bytes directamente. Así el archivo no pasa por el servidor y no lo
 * limita el tamaño máximo del cuerpo de una Server Action (1 MB por defecto).
 * `origen` es el origin de la app: Google lo necesita para habilitar CORS en la
 * URL de sesión.
 */
export async function iniciarCargaReanudable({
  nombre,
  mimeType,
  descripcion,
  origen,
}: {
  nombre: string;
  mimeType: string;
  descripcion?: string | null;
  origen: string;
}): Promise<string> {
  const cfg = requerirConfig();
  const res = await fetch(
    `${UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true&fields=id`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${await accessToken()}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": mimeType,
        // Sin este Origin, la URL de sesión rechaza el PUT del navegador.
        origin: origen,
      },
      body: JSON.stringify({
        name: nombre,
        parents: [cfg.folderId],
        ...(descripcion ? { description: descripcion } : {}),
      }),
    },
  );
  const url = res.headers.get("location");
  if (!res.ok || !url) {
    throw new Error(
      `No se pudo abrir la carga en Drive (${res.status}): ${await res.text()}`,
    );
  }
  return url;
}

/** Metadatos de un archivo, o null si no existe o no es accesible. */
export async function obtenerArchivo(
  fileId: string,
): Promise<DriveArchivo | null> {
  const res = await fetch(
    `${API}/files/${encodeURIComponent(fileId)}` +
      "?supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,parents",
    { headers: { authorization: `Bearer ${await accessToken()}` } },
  );
  if (!res.ok) return null;
  const d = (await res.json()) as {
    id: string;
    name: string;
    mimeType?: string;
    size?: string;
    webViewLink?: string;
    parents?: string[];
  };
  return {
    id: d.id,
    name: d.name,
    mimeType: d.mimeType ?? null,
    size: d.size ? Number(d.size) : null,
    webViewLink: d.webViewLink ?? null,
    parents: d.parents ?? [],
  };
}

/** Contenido del archivo, para servirlo desde la ruta de visualización. */
export async function descargarArchivo(fileId: string): Promise<Response> {
  return fetch(
    `${API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${await accessToken()}` } },
  );
}

/** Envía el archivo a la papelera de Drive (recuperable durante 30 días). */
export async function eliminarArchivo(fileId: string): Promise<void> {
  await fetch(
    `${API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${await accessToken()}`,
        "content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ trashed: true }),
    },
  );
}

/**
 * Comprueba que las credenciales sirven y que la carpeta destino existe y es
 * accesible. Se usa en el diagnóstico de Configuración → Monitoreo.
 */
export async function verificarDrive(): Promise<{
  ok: boolean;
  mensaje: string;
  carpeta?: string;
}> {
  if (!driveConfigurado()) {
    return {
      ok: false,
      mensaje:
        "Drive no está configurado. Los archivos se guardan en Supabase Storage.",
    };
  }
  try {
    const carpeta = await obtenerArchivo(carpetaDrive());
    if (!carpeta) {
      return {
        ok: false,
        mensaje:
          "La cuenta de servicio no puede ver la carpeta indicada en " +
          "GOOGLE_DRIVE_FOLDER_ID. Compártela con ella como Editor.",
      };
    }
    return { ok: true, mensaje: "Conexión con Drive correcta.", carpeta: carpeta.name };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : String(e) };
  }
}
