import { Folder, FolderOpen, FileText, type LucideIcon } from "lucide-react";
import { NIVEL_SERIE_LABELS, type NivelSerie } from "@/lib/tipos";

/** Iconos planos (line) por nivel de la TRD. */
export const NIVEL_SERIE_ICON_FLAT: Record<NivelSerie, LucideIcon> = {
  serie: Folder,
  subserie: FolderOpen,
  tipo: FileText,
};

/** Chip con icono plano + etiqueta del nivel (Serie / Subserie / Tipo). */
export function EtiquetaNivel({ nivel }: { nivel: NivelSerie }) {
  const Icono = NIVEL_SERIE_ICON_FLAT[nivel];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/30 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      <Icono className="size-3" />
      {NIVEL_SERIE_LABELS[nivel]}
    </span>
  );
}
