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
import { gestionaUsuarios } from "./roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Marca funcionalidades planificadas para fases posteriores. */
  disabled?: boolean;
  /** Si se define, solo los roles para los que la función devuelve true lo ven. */
  visible?: (role: string | null | undefined) => boolean;
};

/**
 * Navegación principal. "Gestión" solo es visible para quien administra
 * usuarios (superadmin/rector). Los ítems deshabilitados corresponden a módulos
 * de próximas fases (Correspondencia, Reuniones).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/dependencias", label: "Dependencias", icon: Building2 },
  { href: "/trd", label: "TRD", icon: ListTree },
  { href: "/documentos", label: "Documentos", icon: FileStack },
  { href: "/registros", label: "Registros", icon: ClipboardCheck },
  { href: "/consulta", label: "Consulta", icon: Search },
  {
    href: "/gestion",
    label: "Gestión",
    icon: Users,
    visible: gestionaUsuarios,
  },
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
  return NAV_ITEMS.filter((item) => !item.visible || item.visible(role));
}
