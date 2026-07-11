/**
 * Roles del sistema (deben coincidir con el enum `user_role` de la base de datos,
 * ver supabase/migrations/0001_init.sql).
 */
export const ROLES = [
  "super_admin",
  "admin_archivo",
  "jefe_dependencia",
  "funcionario",
  "consulta",
] as const;

export type Role = (typeof ROLES)[number];

/** Etiquetas legibles en español para cada rol. */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super administrador",
  admin_archivo: "Administrador de archivo",
  jefe_dependencia: "Jefe de dependencia",
  funcionario: "Funcionario",
  consulta: "Consulta",
};

export function roleLabel(role: string | null | undefined): string {
  if (role && role in ROLE_LABELS) {
    return ROLE_LABELS[role as Role];
  }
  return "Sin rol asignado";
}

/** ¿El rol administra la TRD y el catálogo archivístico? (super_admin o admin_archivo) */
export function isArchivoAdmin(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "admin_archivo";
}

/** ¿El rol es el super administrador global? */
export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "super_admin";
}
