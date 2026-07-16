"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Network,
  GitBranch,
  Workflow,
  Building,
  Folder,
  FolderOpen,
  FileText,
  File,
  ChevronRight,
  Search,
  UnfoldVertical,
  FoldVertical,
  Printer,
  type LucideIcon,
} from "lucide-react";
import {
  construirFondo,
  idsDelArbol,
  type NodoFondo,
  type TipoNodo,
} from "@/lib/fondo-arbol";
import {
  ESTADO_TRD_LABELS,
  ESTADO_DOCUMENTO_LABELS,
  type EstadoDocumento,
  type EstadoTrd,
  type Serie,
  type Unidad,
} from "@/lib/tipos";
import type { OficinaListado } from "@/services/oficinas";
import type { DocumentoListado } from "@/services/documentos";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ICONO: Record<TipoNodo, LucideIcon> = {
  raiz: Building2,
  eje: Network,
  macroproceso: GitBranch,
  proceso: Workflow,
  oficina: Building,
  serie: Folder,
  subserie: FolderOpen,
  tipo: FileText,
  documento: File,
};

const ESTADO_TRD_COLOR: Record<EstadoTrd, string> = {
  borrador: "bg-muted text-muted-foreground",
  en_revision: "bg-secondary/15 text-secondary",
  aprobado: "bg-primary/10 text-primary",
  rechazado: "bg-destructive/10 text-destructive",
};

const ESTADO_DOC_COLOR: Record<EstadoDocumento, string> = {
  borrador: "bg-muted text-muted-foreground",
  activo: "bg-primary/10 text-primary",
  archivado: "bg-secondary/15 text-secondary",
};

/** Normaliza texto para búsqueda: minúsculas y sin acentos. */
const DIACRITICOS = /[̀-ͯ]/g;
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");

/** Poda el árbol a las ramas que coinciden con la búsqueda. */
function filtrar(nodo: NodoFondo, q: string): NodoFondo | null {
  const propio = norm(`${nodo.codigo} ${nodo.nombre}`).includes(q);
  if (propio) return nodo;
  const hijos = nodo.hijos
    .map((h) => filtrar(h, q))
    .filter((n): n is NodoFondo => n !== null);
  if (hijos.length > 0) return { ...nodo, hijos };
  return null;
}

/**
 * Árbol de solo lectura del Fondo Documental de toda la organización, con
 * búsqueda, expandir/contraer y exportación a PDF. La visibilidad es total: la
 * RLS permite lectura a cualquier rol activo.
 */
export function FondoDocumental({
  unidades,
  oficinas,
  series,
  documentos,
}: {
  unidades: Unidad[];
  oficinas: OficinaListado[];
  series: Serie[];
  documentos: DocumentoListado[];
}) {
  const arbol = useMemo(
    () => construirFondo(unidades, oficinas, series, documentos),
    [unidades, oficinas, series, documentos],
  );
  const [query, setQuery] = useState("");
  // Por defecto solo la raíz abierta (se ven los ejes).
  const [expandidos, setExpandidos] = useState<Set<string>>(
    () => new Set(["raiz"]),
  );

  const q = norm(query.trim());
  const visible = useMemo(() => (q ? filtrar(arbol, q) : arbol), [arbol, q]);

  const toggle = (id: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandirTodo = () => setExpandidos(new Set(idsDelArbol(arbol)));
  const contraerTodo = () => setExpandidos(new Set());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código o nombre…"
            className="pl-8"
            aria-label="Buscar en el fondo documental"
          />
        </div>
        <button
          type="button"
          onClick={expandirTodo}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          <UnfoldVertical className="size-4" />
          Expandir
        </button>
        <button
          type="button"
          onClick={contraerTodo}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          <FoldVertical className="size-4" />
          Contraer
        </button>
        <Link
          href="/trd/fondo/imprimir"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Printer className="size-4" />
          Exportar PDF
        </Link>
      </div>

      <div className="rounded-lg border p-2">
        {visible ? (
          <Fila
            nodo={visible}
            depth={0}
            expandidos={expandidos}
            toggle={toggle}
            forzarAbierto={q.length > 0}
          />
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            No hay coincidencias para «{query}».
          </p>
        )}
      </div>
    </div>
  );
}

function Fila({
  nodo,
  depth,
  expandidos,
  toggle,
  forzarAbierto,
}: {
  nodo: NodoFondo;
  depth: number;
  expandidos: Set<string>;
  toggle: (id: string) => void;
  forzarAbierto: boolean;
}) {
  const tieneHijos = nodo.hijos.length > 0;
  const abierto = forzarAbierto || expandidos.has(nodo.id);
  const Icono = ICONO[nodo.tipo];

  return (
    <div>
      <div
        className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-accent/50"
        style={{ paddingLeft: depth * 18 + 4 }}
      >
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => toggle(nodo.id)}
            aria-label={abierto ? "Contraer" : "Expandir"}
            aria-expanded={abierto}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform",
                abierto && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <Icono
          className={cn(
            "size-4 shrink-0",
            nodo.tipo === "raiz" ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "text-sm",
            nodo.tipo === "raiz" && "font-semibold",
          )}
        >
          {nodo.codigo && (
            <>
              <span className="font-medium">{nodo.codigo}</span>
              {" · "}
            </>
          )}
          {nodo.nombre}
        </span>
        {nodo.estadoTrd && (
          <span
            className={cn(
              "ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              ESTADO_TRD_COLOR[nodo.estadoTrd],
            )}
          >
            {ESTADO_TRD_LABELS[nodo.estadoTrd]}
          </span>
        )}
        {nodo.estadoDoc && (
          <span
            className={cn(
              "ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              ESTADO_DOC_COLOR[nodo.estadoDoc],
            )}
          >
            {ESTADO_DOCUMENTO_LABELS[nodo.estadoDoc]}
          </span>
        )}
      </div>
      {tieneHijos &&
        abierto &&
        nodo.hijos.map((h) => (
          <Fila
            key={h.id}
            nodo={h}
            depth={depth + 1}
            expandidos={expandidos}
            toggle={toggle}
            forzarAbierto={forzarAbierto}
          />
        ))}
    </div>
  );
}
