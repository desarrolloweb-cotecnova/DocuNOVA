/**
 * Reglas de mapeo entre los datos de los CSV y el modelo de DocuNOVA.
 * Se mantienen en un módulo aparte para poder verificarlas con pruebas
 * unitarias (ver src/lib/seed-mapping.test.ts).
 */

import { SUPER_ADMIN_EMAIL } from "./org-data.mjs";

/**
 * Mapea el `Rol_Sugerido` del CSV de usuarios a uno de los 5 roles del sistema
 * (super_admin, admin_archivo, jefe_dependencia, funcionario, consulta).
 *
 * - Administrador de Proceso / de Oficina Productora  -> jefe_dependencia
 * - Gestor documental                                 -> funcionario
 * - Consulta / Sin acceso                             -> consulta
 *
 * Excepciones por correo:
 * - desarrolloweb@ (super admin) -> super_admin (se siembra activo aparte)
 * - gestiondocumental@ (Directora de Gestión Documental) -> admin_archivo,
 *   pues administra la TRD y el catálogo archivístico institucional.
 */
export function mapRol(rolSugerido, email) {
  const correo = (email ?? "").trim().toLowerCase();
  if (correo === SUPER_ADMIN_EMAIL) return "super_admin";
  if (correo === "gestiondocumental@cotecnova.edu.co") return "admin_archivo";

  const rol = (rolSugerido ?? "").toLowerCase();
  if (rol.startsWith("administrador de proceso")) return "jefe_dependencia";
  if (rol.startsWith("administrador de oficina")) return "jefe_dependencia";
  if (rol.startsWith("gestor documental")) return "funcionario";
  return "consulta";
}

/**
 * Determina si el usuario requiere una cuenta operativa en DocuNOVA. El personal
 * de Servicios Generales (rol "Sin acceso al sistema") se siembra solo para
 * registro histórico y nunca inicia sesión.
 */
export function requiereCuenta(rolSugerido) {
  return !(rolSugerido ?? "").toLowerCase().startsWith("sin acceso");
}

/**
 * Extrae el código de oficina productora (4 dígitos) de un texto como
 * "Contabilidad (1251)" o "Formación - Direcciones de Unidad (1311, ...)".
 * Devuelve null si no hay código (usuario a nivel de proceso, sin oficina).
 */
export function oficinaCodeFromText(texto) {
  const m = (texto ?? "").match(/\((\d{4})/);
  return m ? m[1] : null;
}

/** Normaliza el valor "X"/"" de las columnas de la TRD a booleano. */
export function xToBool(valor) {
  return (valor ?? "").trim().toUpperCase() === "X";
}
