import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";

/**
 * Valida que un correo pertenezca al dominio institucional permitido.
 *
 * Reglas:
 * - Comparación sin distinguir mayúsculas/minúsculas.
 * - Debe existir exactamente un `@` y el dominio debe coincidir de forma exacta
 *   (evita que `evil-cotecnova.edu.co` o `cotecnova.edu.co.attacker.com` pasen).
 *
 * @param email  Correo a validar (puede venir `undefined` desde el proveedor).
 * @param domain Dominio permitido; por defecto el configurado para Cotecnova.
 */
export function isAllowedEmail(
  email: string | null | undefined,
  domain: string = ALLOWED_EMAIL_DOMAIN,
): boolean {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();
  const expectedDomain = domain.trim().toLowerCase();

  const parts = normalized.split("@");
  if (parts.length !== 2) return false;

  const [localPart, emailDomain] = parts;
  if (!localPart) return false;

  return emailDomain === expectedDomain;
}
