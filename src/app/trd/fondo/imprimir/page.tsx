import type { Metadata } from "next";
import Image from "next/image";
import { APP_NAME } from "@/lib/config";
import { requireAuth } from "@/lib/auth/guard";
import { listUnidades } from "@/services/unidades";
import { listOficinas } from "@/services/oficinas";
import { listSeriesTodas } from "@/services/series";
import { listDocumentosTodos } from "@/services/documentos";
import {
  ESTADO_TRD_LABELS,
  ESTADO_DOCUMENTO_LABELS,
  labelDe,
} from "@/lib/tipos";
import { construirFondo, type NodoFondo } from "@/lib/fondo-arbol";
import { ImprimirAlCargar } from "@/components/imprimir-al-cargar";

export const metadata: Metadata = {
  title: `Fondo Documental para imprimir — ${APP_NAME}`,
};

const ESTADO_TIPO: Record<NodoFondo["tipo"], string> = {
  raiz: "Organización",
  eje: "Eje",
  macroproceso: "Macroproceso",
  proceso: "Proceso",
  oficina: "Dependencia",
  serie: "Serie",
  subserie: "Subserie",
  tipo: "Tipo documental",
  documento: "Documento",
};

function Rama({ nodo, nivel }: { nodo: NodoFondo; nivel: number }) {
  return (
    <li>
      <div className="fondo-fila" style={{ paddingLeft: nivel * 16 }}>
        <span className="fondo-etiqueta">{ESTADO_TIPO[nodo.tipo]}</span>
        <span className="fondo-nombre">
          {nodo.codigo && <strong>{nodo.codigo}</strong>}
          {nodo.codigo ? " · " : ""}
          {nodo.nombre}
        </span>
        {nodo.estadoTrd && (
          <span className="fondo-estado">
            {labelDe(ESTADO_TRD_LABELS, nodo.estadoTrd)}
          </span>
        )}
        {nodo.estadoDoc && (
          <span className="fondo-estado">
            {labelDe(ESTADO_DOCUMENTO_LABELS, nodo.estadoDoc)}
          </span>
        )}
      </div>
      {nodo.hijos.length > 0 && (
        <ul>
          {nodo.hijos.map((h) => (
            <Rama key={h.id} nodo={h} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function ImprimirFondoPage() {
  // Fuera del route group (app): aplicamos el gate de sesión manualmente.
  await requireAuth();

  const [unidades, oficinas, series, documentos] = await Promise.all([
    listUnidades(),
    listOficinas(),
    listSeriesTodas(),
    listDocumentosTodos(),
  ]);

  const arbol = construirFondo(unidades, oficinas, series, documentos);
  const generado = new Date().toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-white p-6 text-black print:p-0">
      <style>{`
        @page { size: A4 portrait; margin: 14mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .fondo-arbol, .fondo-arbol ul { list-style: none; margin: 0; padding: 0; }
        .fondo-fila {
          display: flex; align-items: baseline; gap: 6px;
          padding-top: 2px; padding-bottom: 2px; font-size: 11px;
          border-bottom: 1px solid #eee;
        }
        .fondo-etiqueta {
          flex: 0 0 auto; min-width: 84px;
          font-size: 8px; text-transform: uppercase; letter-spacing: .04em;
          color: #00602F; font-weight: 600;
        }
        .fondo-nombre { flex: 1 1 auto; }
        .fondo-estado {
          flex: 0 0 auto; font-size: 8px; text-transform: uppercase;
          border: 1px solid #00602F; color: #00602F; border-radius: 9999px;
          padding: 0 6px;
        }
      `}</style>

      <div className="mx-auto max-w-[900px] print:max-w-none">
        <div className="no-print mb-4 flex items-center justify-between border-b pb-3">
          <p className="text-sm text-gray-600">
            Vista para imprimir. Usa el diálogo del navegador para «Guardar como
            PDF».
          </p>
          <ImprimirAlCargar />
        </div>

        <header className="mb-4 flex items-center gap-4 border-b-2 border-[#00602F] pb-3">
          <Image
            src="/docunova-logo.png"
            alt="DocuNOVA"
            width={140}
            height={44}
            priority
          />
          <div className="flex-1">
            <h1 className="text-lg font-bold">Fondo Documental — COTECNOVA</h1>
            <p className="text-xs text-gray-700">
              Ejes, macroprocesos, procesos, dependencias, series, subseries,
              tipos y documentos.
            </p>
          </div>
          <div className="text-right text-xs">
            <p>
              <span className="font-semibold">Generado: </span>
              {generado}
            </p>
          </div>
        </header>

        <ul className="fondo-arbol">
          <Rama nodo={arbol} nivel={0} />
        </ul>
      </div>
    </div>
  );
}
