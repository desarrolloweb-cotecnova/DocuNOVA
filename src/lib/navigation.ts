import {
  LayoutDashboard,
  FolderArchive,
  FileStack,
  ListTree,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Marca funcionalidades planificadas para fases posteriores. */
  disabled?: boolean;
};

/**
 * Navegación principal. Los ítems deshabilitados corresponden a módulos de
 * fases posteriores (TRD, expedientes, etc.) y se muestran atenuados.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  {
    href: "/expedientes",
    label: "Expedientes",
    icon: FolderArchive,
    disabled: true,
  },
  { href: "/documentos", label: "Documentos", icon: FileStack, disabled: true },
  {
    href: "/trd",
    label: "Tablas de Retención (TRD)",
    icon: ListTree,
    disabled: true,
  },
  { href: "/admin", label: "Administración", icon: Settings, disabled: true },
];
