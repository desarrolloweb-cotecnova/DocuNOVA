/**
 * Construcción del árbol del Fondo Documental de la organización:
 * COTECNOVA → ejes → macroprocesos → procesos → dependencias → series →
 * subseries → tipos → documentos. Ordenado por código en cada nivel.
 *
 * Función pura, sin acceso a datos, reutilizada por la vista interactiva
 * (cliente) y por la vista de impresión (servidor).
 */
import type { DocumentoListado } from "@/services/documentos";
import type { OficinaListado } from "@/services/oficinas";
import type {
  EstadoDocumento,
  EstadoTrd,
  NivelSerie,
  Serie,
  Unidad,
} from "./tipos";

export type TipoNodo =
  | "raiz"
  | "eje"
  | "macroproceso"
  | "proceso"
  | "oficina"
  | NivelSerie
  | "documento";

export type NodoFondo = {
  id: string;
  tipo: TipoNodo;
  codigo: string;
  nombre: string;
  /** Estado de la TRD (solo en nodos serie/subserie/tipo). */
  estadoTrd?: EstadoTrd;
  /** Estado del documento (solo en nodos documento). */
  estadoDoc?: EstadoDocumento;
  hijos: NodoFondo[];
};

/** Orden por código, numérico y con locale español; los vacíos al final. */
const porCodigo = (a: { codigo: string }, b: { codigo: string }): number => {
  const ca = a.codigo || "￿";
  const cb = b.codigo || "￿";
  return ca.localeCompare(cb, "es", { numeric: true, sensitivity: "base" });
};

/**
 * Arma el árbol completo. `oficinas`, `series` y `documentos` deben ser los de
 * toda la organización (la RLS permite lectura a cualquier rol activo).
 */
export function construirFondo(
  unidades: Unidad[],
  oficinas: OficinaListado[],
  series: Serie[],
  documentos: DocumentoListado[],
): NodoFondo {
  const ejes = unidades.filter((u) => u.tipo === "eje");
  const macros = unidades.filter((u) => u.tipo === "macroproceso");
  const procesos = unidades.filter((u) => u.tipo === "proceso");

  const docsPorSerie = new Map<string, DocumentoListado[]>();
  for (const d of documentos) {
    if (!d.serie_id) continue;
    const arr = docsPorSerie.get(d.serie_id);
    if (arr) arr.push(d);
    else docsPorSerie.set(d.serie_id, [d]);
  }

  const seriesPorOficina = new Map<string, Serie[]>();
  for (const s of series) {
    const arr = seriesPorOficina.get(s.oficina_id);
    if (arr) arr.push(s);
    else seriesPorOficina.set(s.oficina_id, [s]);
  }

  // Series de una oficina como árbol autorreferente por padre_id, con sus
  // documentos colgando de cada serie/subserie/tipo.
  const nodosSerie = (
    deLaOficina: Serie[],
    padreId: string | null,
  ): NodoFondo[] =>
    deLaOficina
      .filter((s) => s.padre_id === padreId)
      .sort(porCodigo)
      .map((s) => ({
        id: `serie:${s.id}`,
        tipo: s.nivel,
        codigo: s.codigo,
        nombre: s.nombre,
        estadoTrd: s.estado_aprobacion,
        hijos: [
          ...nodosSerie(deLaOficina, s.id),
          ...(docsPorSerie.get(s.id) ?? [])
            .map(
              (d): NodoFondo => ({
                id: `doc:${d.id}`,
                tipo: "documento",
                codigo: d.codigo ?? "",
                nombre: d.nombre,
                estadoDoc: d.estado,
                hijos: [],
              }),
            )
            .sort(porCodigo),
        ],
      }));

  const nodoOficina = (o: OficinaListado): NodoFondo => ({
    id: `of:${o.id}`,
    tipo: "oficina",
    codigo: o.codigo,
    nombre: o.nombre,
    hijos: nodosSerie(seriesPorOficina.get(o.id) ?? [], null),
  });

  const nodoProceso = (p: Unidad): NodoFondo => ({
    id: `u:${p.id}`,
    tipo: "proceso",
    codigo: p.codigo,
    nombre: p.nombre,
    hijos: oficinas
      .filter((o) => o.unidad_id === p.id)
      .sort(porCodigo)
      .map(nodoOficina),
  });

  const nodoMacro = (m: Unidad): NodoFondo => ({
    id: `u:${m.id}`,
    tipo: "macroproceso",
    codigo: m.codigo,
    nombre: m.nombre,
    hijos: procesos
      .filter((p) => p.padre_id === m.id)
      .sort(porCodigo)
      .map(nodoProceso),
  });

  const nodoEje = (e: Unidad): NodoFondo => ({
    id: `u:${e.id}`,
    tipo: "eje",
    codigo: e.codigo,
    nombre: e.nombre,
    hijos: macros
      .filter((m) => m.padre_id === e.id)
      .sort(porCodigo)
      .map(nodoMacro),
  });

  return {
    id: "raiz",
    tipo: "raiz",
    codigo: "",
    nombre: "COTECNOVA",
    hijos: ejes.slice().sort(porCodigo).map(nodoEje),
  };
}

/** Todos los ids del árbol (para «expandir todo»). */
export function idsDelArbol(nodo: NodoFondo, acc: string[] = []): string[] {
  acc.push(nodo.id);
  for (const h of nodo.hijos) idsDelArbol(h, acc);
  return acc;
}
