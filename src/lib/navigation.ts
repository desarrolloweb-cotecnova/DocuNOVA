import {
  LayoutDashboard,
  Building2,
  ListTree,
  FileStack,
  ClipboardCheck,
  Search,
  Users,
  Library,
  Mail,
  CalendarClock,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { apruebaTRD, puedeVerModulo } from "./roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Marca funcionalidades planificadas para fases posteriores. */
  disabled?: boolean;
};

/**
 * Navegación principal. La visibilidad de cada módulo por rol se define en
 * `puedeVerModulo` (src/lib/roles.ts). Los ítems deshabilitados corresponden a
 * módulos de próximas fases (Correspondencia, Reuniones) y solo se muestran a
 * los roles con acceso amplio (aprobadores).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/dependencias", label: "Dependencias", icon: Building2 },
  { href: "/trd", label: "TRD", icon: ListTree },
  { href: "/documentos", label: "Documentos", icon: FileStack },
  { href: "/registros", label: "Registros", icon: ClipboardCheck },
  { href: "/consulta", label: "Consulta", icon: Search },
  { href: "/gestion", label: "Gestión", icon: Users },
  { href: "/memoria", label: "Memoria Corporativa", icon: Library },
  { href: "/configuracion", label: "Configuración", icon: Settings },
  // Próximamente
  {
    href: "/correspondencia",
    label: "Correspondencia",
    icon: Mail,
    disabled: true,
  },
  {
    href: "/reuniones",
    label: "Reuniones",
    icon: CalendarClock,
    disabled: true,
  },
];

/** Filtra la navegación según el rol del usuario. */
export function navItemsForRole(role: string | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) =>
    item.disabled ? apruebaTRD(role) : puedeVerModulo(role, item.href),
  );
}

/**
 * Títulos que se muestran en el encabezado fijo por ruta. El Panel se omite a
 * propósito (mantiene su saludo en el cuerpo). Se resuelve por prefijo más
 * largo, así las subrutas heredan el título de su sección.
 */
const PAGE_TITLES: Record<string, string> = {
  "/dependencias": "Dependencias",
  "/trd": "Tablas de Retención Documental",
  "/documentos": "Documentos",
  "/registros": "Registros",
  "/consulta": "Consulta",
  "/gestion": "Gestión",
  "/memoria": "Memoria Corporativa",
  "/configuracion": "Configuración",
  "/perfil": "Mi perfil",
  "/notificaciones": "Notificaciones",
};

/** Título del encabezado para una ruta, o null si no aplica (p. ej. Panel). */
export function pageTitleForPath(pathname: string): string | null {
  const match = Object.keys(PAGE_TITLES)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLES[match] : null;
}
