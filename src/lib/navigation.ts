import {
  LayoutDashboard,
  FolderArchive,
  FileStack,
  ClipboardCheck,
  ListTree,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Marca funcionalidades planificadas para fases posteriores. */
  disabled?: boolean;
  /** Si se define, solo estos roles ven el ítem. */
  roles?: Role[];
};

/**
 * Navegación principal. Los ítems deshabilitados corresponden a módulos de
 * fases posteriores (expedientes, documentos). "Administración" solo es visible
 * para el super administrador.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/expedientes", label: "Expedientes", icon: FolderArchive },
  { href: "/documentos", label: "Buscar documentos", icon: FileStack },
  { href: "/aprobaciones", label: "Aprobaciones", icon: ClipboardCheck },
  { href: "/trd", label: "Tablas de Retención (TRD)", icon: ListTree },
  {
    href: "/admin",
    label: "Administración",
    icon: Settings,
    roles: ["super_admin"],
  },
];

/** Filtra la navegación según el rol del usuario. */
export function navItemsForRole(role: string | null | undefined): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      !item.roles || (role != null && item.roles.includes(role as Role)),
  );
}
