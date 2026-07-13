import {
  LayoutDashboard,
  Building2,
  ListTree,
  FileStack,
  ClipboardCheck,
  Search,
  Users,
  Mail,
  CalendarClock,
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
