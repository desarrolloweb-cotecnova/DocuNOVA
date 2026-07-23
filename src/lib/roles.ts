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

/**
 * Módulos (rutas) que cada rol puede ver en la navegación. El "Panel" es la
 * pantalla de inicio y está disponible para todo rol activo; los módulos de
 * archivo se restringen según el rol. La comprobación es por prefijo de ruta,
 * así que cubre las subrutas de cada módulo.
 */
const MODULOS_POR_ROL: Record<Role, string[]> = {
  superadmin: [
    "/dashboard",
    "/dependencias",
    "/trd",
    "/documentos",
    "/registros",
    "/consulta",
    "/gestion",
    "/memoria",
  ],
  rector: [
    "/dashboard",
    "/dependencias",
    "/trd",
    "/documentos",
    "/registros",
    "/consulta",
    "/gestion",
    "/memoria",
  ],
  administrador: [
    "/dashboard",
    "/dependencias",
    "/trd",
    "/documentos",
    "/registros",
    "/consulta",
    "/memoria",
  ],
  gestor: [
    "/dashboard",
    "/trd",
    "/documentos",
    "/registros",
    "/consulta",
    "/memoria",
  ],
  colaborador: ["/dashboard", "/registros", "/consulta", "/memoria"],
  consulta: ["/dashboard", "/consulta", "/memoria"],
  pendiente: [],
};

/** ¿El rol puede ver el módulo cuya ruta base es `href`? */
export function puedeVerModulo(
  role: string | null | undefined,
  href: string,
): boolean {
  if (!role || !(role in MODULOS_POR_ROL)) return false;
  return MODULOS_POR_ROL[role as Role].some(
    (base) => href === base || href.startsWith(`${base}/`),
  );
}
