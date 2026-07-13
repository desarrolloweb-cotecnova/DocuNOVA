import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { getOficina } from "@/services/oficinas";
import { listUnidades } from "@/services/unidades";
import { listSeriesPorOficina } from "@/services/series";
import {
  ESTADO_TRD_LABELS,
  NIVEL_SERIE_LABELS,
  labelDe,
  type Unidad,
} from "@/lib/tipos";
import { ImprimirAlCargar } from "@/components/imprimir-al-cargar";

export const metadata: Metadata = {
  title: `TRD para imprimir — ${APP_NAME}`,
};

export default async function ImprimirTrdPage({
  searchParams,
}: {
  searchParams: Promise<{ oficina?: string }>;
}) {
  const { oficina } = await searchParams;
  if (!oficina) notFound();

  const [of, unidades, series] = await Promise.all([
    getOficina(oficina),
    listUnidades(),
    listSeriesPorOficina(oficina),
  ]);
  if (!of) notFound();

  const porId = new Map(unidades.map((u) => [u.id, u] as const));
  const proceso: Unidad | undefined = of.unidad_id
    ? porId.get(of.unidad_id)
    : undefined;
  const macro: Unidad | undefined = proceso?.padre_id
    ? porId.get(proceso.padre_id)
    : undefined;
  const eje: Unidad | undefined = macro?.padre_id
    ? porId.get(macro.padre_id)
    : undefined;

  const estado = series[0]?.estado_aprobacion ?? "borrador";
  const generado = new Date().toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-white p-6 text-black print:p-0">
      <ImprimirAlCargar />

      {/* Estilos específicos de impresión */}
      <style>{`
        @page { size: A4 landscape; margin: 14mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .trd-tabla { border-collapse: collapse; width: 100%; font-size: 10px; }
        .trd-tabla th, .trd-tabla td {
          border: 1px solid #333; padding: 4px 6px; vertical-align: top;
        }
        .trd-tabla th { background: #00602F; color: white; text-align: left; }
        .trd-tabla tr.subserie td { background: #F0F4F1; }
        .trd-tabla tr.tipo td { background: #FAFAFA; font-style: italic; }
      `}</style>

      <div className="mx-auto max-w-[1100px] print:max-w-none">
        {/* Barra superior (no imprime) */}
        <div className="no-print mb-4 flex items-center justify-between border-b pb-3">
          <p className="text-sm text-gray-600">
            Vista para imprimir. Usa el diálogo del navegador para «Guardar como
            PDF».
          </p>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-[#00602F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#004d25]"
          >
            Imprimir
          </button>
        </div>

        {/* Encabezado */}
        <header className="mb-4 flex items-center gap-4 border-b-2 border-[#00602F] pb-3">
          <Image
            src="/docunova-logo.png"
            alt="DocuNOVA"
            width={140}
            height={44}
            priority
          />
          <div className="flex-1">
            <h1 className="text-lg font-bold">
              Tabla de Retención Documental (TRD)
            </h1>
            <p className="text-xs text-gray-700">Cotecnova · DocuNOVA</p>
          </div>
          <div className="text-right text-xs">
            <p>
              <span className="font-semibold">Estado: </span>
              {labelDe(ESTADO_TRD_LABELS, estado)}
            </p>
            <p>
              <span className="font-semibold">Generado: </span>
              {generado}
            </p>
          </div>
        </header>

        {/* Datos de la dependencia */}
        <section className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p>
              <span className="font-semibold">Dependencia: </span>
              {of.codigo} · {of.nombre}
            </p>
            {of.ubicacion_fisica && (
              <p>
                <span className="font-semibold">Ubicación física: </span>
                {of.ubicacion_fisica}
              </p>
            )}
            {of.ubicacion_digital && (
              <p>
                <span className="font-semibold">Ubicación digital: </span>
                {of.ubicacion_digital}
              </p>
            )}
          </div>
          <div>
            {eje && (
              <p>
                <span className="font-semibold">Eje: </span>
                {eje.codigo} · {eje.nombre}
              </p>
            )}
            {macro && (
              <p>
                <span className="font-semibold">Macroproceso: </span>
                {macro.codigo} · {macro.nombre}
              </p>
            )}
            {proceso && (
              <p>
                <span className="font-semibold">Proceso: </span>
                {proceso.codigo} · {proceso.nombre}
              </p>
            )}
          </div>
        </section>

        {/* Tabla */}
        {series.length === 0 ? (
          <p className="text-sm">
            Esta dependencia aún no tiene entradas de TRD.
          </p>
        ) : (
          <table className="trd-tabla">
            <thead>
              <tr>
                <th style={{ width: "80px" }}>Código</th>
                <th>Serie / Subserie / Tipo</th>
                <th style={{ width: "70px" }}>Nivel</th>
                <th style={{ width: "45px" }}>Físico</th>
                <th style={{ width: "45px" }}>Digital</th>
                <th style={{ width: "50px" }}>Gest.</th>
                <th style={{ width: "50px" }}>Cent.</th>
                <th style={{ width: "40px" }}>CT</th>
                <th style={{ width: "40px" }}>S</th>
                <th style={{ width: "40px" }}>E</th>
                <th style={{ width: "40px" }}>D</th>
                <th>Procedimiento</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.id} className={s.nivel}>
                  <td>{s.codigo}</td>
                  <td>
                    {s.nivel === "subserie"
                      ? "  "
                      : s.nivel === "tipo"
                        ? "    "
                        : ""}
                    {s.nombre}
                  </td>
                  <td>{NIVEL_SERIE_LABELS[s.nivel]}</td>
                  <td>{s.soporte_fisico ? "X" : ""}</td>
                  <td>{s.soporte_digital ? "X" : ""}</td>
                  <td>{s.anios_gestion ?? ""}</td>
                  <td>{s.anios_central ?? ""}</td>
                  <td>{s.disp_conservacion ? "X" : ""}</td>
                  <td>{s.disp_seleccion ? "X" : ""}</td>
                  <td>{s.disp_eliminacion ? "X" : ""}</td>
                  <td>{s.disp_digital ? "X" : ""}</td>
                  <td>{s.procedimiento ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Convenciones */}
        <p className="mt-3 text-[10px] text-gray-700">
          Convenciones de disposición final: <strong>CT</strong> Conservación
          total · <strong>S</strong> Selección · <strong>E</strong> Eliminación
          · <strong>D</strong> Digitalización. Retención en años:{" "}
          <strong>Gest.</strong> Archivo de gestión · <strong>Cent.</strong>{" "}
          Archivo central.
        </p>
      </div>
    </div>
  );
}
