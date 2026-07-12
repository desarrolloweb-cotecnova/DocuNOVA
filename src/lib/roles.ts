/**
 * Roles del sistema (deben coincidir con el enum `rol_usuario` de la base de
 * datos, ver supabase/migrations/0001_fundacion.sql). Los helpers de capacidad
 * reflejan las funciones RLS del backend (es_admin_usuarios, puede_aprobar_trd,
 * puede_elaborar, puede_crear_registros, es_lector).
 */
export const ROLES = [
  "superadmin",
  "rector",
  "administrador",
  "gestor",
  "colaborador",
  "consulta",
  "pendiente",
] as const;

export type Role = (typeof ROLES)[number];

/** Etiquetas legibles en español para cada rol. */
export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super administrador",
  rector: "Rector",
  administrador: "Administrador",
  gestor: "Gestor",
  colaborador: "Colaborador",
  consulta: "Consulta",
  pendiente: "Pendiente de asignación",
};

/**
 * Roles que un administrador de usuarios puede asignar desde la interfaz.
 * Se excluye 'pendiente' (es el estado inicial, no una asignación manual).
 */
export const ROLES_ASIGNABLES: readonly Role[] = ROLES.filter(
  (r) => r !== "pendiente",
);

export function roleLabel(role: string | null | undefined): string {
  if (role && role in ROLE_LABELS) {
    return ROLE_LABELS[role as Role];
  }
  return "Sin rol asignado";
}

/** ¿El rol es el super administrador global? */
export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "superadmin";
}

/** ¿Gestiona usuarios (asigna roles/activa cuentas)? superadmin o rector. */
export function gestionaUsuarios(role: string | null | undefined): boolean {
  return role === "superadmin" || role === "rector";
}

/** ¿Aprueba la TRD y crea documentos? superadmin, rector o administrador. */
export function apruebaTRD(role: string | null | undefined): boolean {
  return role === "superadmin" || role === "rector" || role === "administrador";
}

/** ¿Elabora TRD y crea/edita documentos? apruebaTRD + gestor. */
export function elabora(role: string | null | undefined): boolean {
  return apruebaTRD(role) || role === "gestor";
}

/** ¿Puede crear registros? elabora + colaborador. */
export function creaRegistros(role: string | null | undefined): boolean {
  return elabora(role) || role === "colaborador";
}

/** ¿Tiene algún rol asignado con acceso de lectura? (bloquea 'pendiente'). */
export function esLector(role: string | null | undefined): boolean {
  return (
    role != null &&
    (ROLES as readonly string[]).includes(role) &&
    role !== "pendiente"
  );
}
