"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { Unidad } from "@/lib/tipos";
import type { OficinaListado } from "@/services/oficinas";

/**
 * Filtro en cascada reutilizable (TRD, Documentos, etc.): Eje → Macroproceso
 * → Proceso → Dependencia. Al elegir dependencia navega a
 * `<basePath>?oficina=<id>` (patrón server component + searchParams).
 * Si viene una `oficinaActual`, deriva los selects para preseleccionar la ruta.
 */
export function FiltroDependencia({
  unidades,
  oficinas,
  oficinaActual,
  basePath,
}: {
  unidades: Unidad[];
  oficinas: OficinaListado[];
  oficinaActual: string | null;
  basePath: string;
}) {
  const router = useRouter();

  const ejes = useMemo(
    () => unidades.filter((u) => u.tipo === "eje"),
    [unidades],
  );
  const macros = useMemo(
    () => unidades.filter((u) => u.tipo === "macroproceso"),
    [unidades],
  );
  const procesos = useMemo(
    () => unidades.filter((u) => u.tipo === "proceso"),
    [unidades],
  );

  // Derivar la ruta jerárquica desde la oficina actual (si existe).
  const rutaInicial = useMemo(() => {
    if (!oficinaActual) return { eje: "", macro: "", proc: "" };
    const of = oficinas.find((o) => o.id === oficinaActual);
    const proc = of?.unidad_id
      ? procesos.find((p) => p.id === of.unidad_id)
      : null;
    const macro = proc?.padre_id
      ? macros.find((m) => m.id === proc.padre_id)
      : null;
    const eje = macro?.padre_id
      ? ejes.find((e) => e.id === macro.padre_id)
      : null;
    return {
      eje: eje?.id ?? "",
      macro: macro?.id ?? "",
      proc: proc?.id ?? "",
    };
  }, [oficinaActual, oficinas, procesos, macros, ejes]);

  const [ejeId, setEjeId] = useState(rutaInicial.eje);
  const [macroId, setMacroId] = useState(rutaInicial.macro);
  const [procId, setProcId] = useState(rutaInicial.proc);

  const macrosDelEje = ejeId
    ? macros.filter((m) => m.padre_id === ejeId)
    : macros;
  const procesosDelMacro = macroId
    ? procesos.filter((p) => p.padre_id === macroId)
    : procesos;
  const oficinasDelProc = procId
    ? oficinas.filter((o) => o.unidad_id === procId)
    : [];

  function irAOficina(id: string) {
    router.push(id ? `${basePath}?oficina=${id}` : basePath);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium">Filtrar por</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label>Eje</Label>
            <select
              value={ejeId}
              onChange={(e) => {
                setEjeId(e.target.value);
                setMacroId("");
                setProcId("");
                irAOficina("");
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Todos</option>
              {ejes.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigo} · {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Macroproceso</Label>
            <select
              value={macroId}
              onChange={(e) => {
                setMacroId(e.target.value);
                setProcId("");
                irAOficina("");
              }}
              disabled={!ejeId}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
            >
              <option value="">Todos</option>
              {macrosDelEje.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigo} · {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Proceso</Label>
            <select
              value={procId}
              onChange={(e) => {
                setProcId(e.target.value);
                irAOficina("");
              }}
              disabled={!macroId}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
            >
              <option value="">Todos</option>
              {procesosDelMacro.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigo} · {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Dependencia</Label>
            <select
              value={oficinaActual ?? ""}
              onChange={(e) => irAOficina(e.target.value)}
              disabled={!procId}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
            >
              <option value="">Elegir dependencia…</option>
              {oficinasDelProc.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.codigo} · {o.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
