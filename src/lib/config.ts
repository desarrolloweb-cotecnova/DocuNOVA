/**
 * Configuración pública de la aplicación (no contiene secretos).
 *
 * El dominio de correo permitido puede sobreescribirse con la variable de
 * entorno NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN; por defecto es el de Cotecnova.
 */
export const ALLOWED_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN?.trim() || "cotecnova.edu.co";

/** Nombre visible de la aplicación. */
export const APP_NAME = "DocuNOVA";
