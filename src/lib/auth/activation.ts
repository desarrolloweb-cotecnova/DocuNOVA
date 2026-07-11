/**
 * Lógica de activación de cuentas, separada del layout para poder probarla.
 *
 * Una cuenta recién autorregistrada nace INACTIVA (pendiente de aprobación por el
 * super administrador). Mientras no esté activa, no puede acceder al panel.
 */
export type ProfileState = { is_active: boolean } | null;

/**
 * Devuelve la ruta a la que se debe redirigir tras superar el segundo factor,
 * o `null` si el usuario puede continuar al panel.
 *
 * - Perfil inexistente (aún sin fila) o inactivo -> "/pendiente".
 * - Perfil activo -> null (acceso permitido).
 */
export function activationRedirect(profile: ProfileState): string | null {
  if (!profile || !profile.is_active) return "/pendiente";
  return null;
}
