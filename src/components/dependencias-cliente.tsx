"use client";

import { useMemo, useState } from "react";
import { Building2, Trash2, Star, Pencil, Plus, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton, SubmitIcon } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Unidad } from "@/lib/tipos";
import type { OficinaListado, ResponsableListado } from "@/services/oficinas";
import {
  crearOficina,
  actualizarOficina,
  eliminarOficina,
  agregarResponsable,
  quitarResponsable,
} from "@/app/(app)/dependencias/actions";

type PerfilMin = {
  usuario_id: string;
  nombre_completo: string | null;
  email: string;
};

export function DependenciasCliente({
  unidades,
  oficinas,
  responsables,
  perfiles,
  puedeEditar,
}: {
  unidades: Unidad[];
  oficinas: OficinaListado[];
  responsables: Record<string, ResponsableListado[]>;
  perfiles: PerfilMin[];
  puedeEditar: boolean;
}) {
  const [q, setQ] = useState("");
  const [ejeId, setEjeId] = useState("");
  const [macroId, setMacroId] = useState("");
  const [procId, setProcId] = useState("");
  const [oficinaAbierta, setOficinaAbierta] = useState(false);

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

  const macrosDelEje = ejeId
    ? macros.filter((m) => m.padre_id === ejeId)
    : macros;
  const procesosDelMacro = macroId
    ? procesos.filter((p) => p.padre_id === macroId)
    : procesos;

  // Procesos "visibles" según el filtro de jerarquía elegido.
  const procesosVisibles = useMemo(() => {
    let lista = procesos;
    if (procId) return new Set([procId]);
    if (macroId) lista = procesos.filter((p) => p.padre_id === macroId);
    else if (ejeId) {
      const macroIds = new Set(
        macros.filter((m) => m.padre_id === ejeId).map((m) => m.id),
      );
      lista = procesos.filter((p) => p.padre_id && macroIds.has(p.padre_id));
    }
    return new Set(lista.map((p) => p.id));
  }, [procesos, macros, ejeId, macroId, procId]);

  const termino = q.trim().toLowerCase();
  const oficinasFiltradas = oficinas.filter((o) => {
    const enJerarquia =
      !ejeId && !macroId && !procId
        ? true
        : o.unidad_id
          ? procesosVisibles.has(o.unidad_id)
          : false;
    if (!enJerarquia) return false;
    if (!termino) return true;
    return [o.codigo, o.nombre, o.unidad_nombre]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(termino));
  });

  function reset(nivel: "eje" | "macro") {
    if (nivel === "eje") {
      setMacroId("");
      setProcId("");
    } else {
      setProcId("");
    }
    setOficinaAbierta(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar dependencia u oficina por nombre o código…"
          className="pl-9"
        />
      </div>

      {/* Filtro en cascada */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm font-medium">Filtrar por</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label>Eje</Label>
              <select
                value={ejeId}
                onChange={(e) => {
                  setEjeId(e.target.value);
                  reset("eje");
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
                  reset("macro");
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
                  setOficinaAbierta(false);
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
          </div>

          {/* Agregar dependencia (oficina) al proceso seleccionado */}
          {puedeEditar && (
            <div className="border-t pt-3">
              <Button
                size="sm"
                disabled={!procId}
                onClick={() => setOficinaAbierta((v) => !v)}
              >
                <Plus className="size-4" />
                Agregar dependencia (oficina)
              </Button>
              {!procId && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Elige un proceso para poder crear su oficina. La estructura
                  (ejes, macroprocesos y procesos) se administra en Configuración.
                </p>
              )}
            </div>
          )}

          {oficinaAbierta && procId && <FormOficina unidadId={procId} />}
        </CardContent>
      </Card>

      {/* Resultado: lista de dependencias (oficinas) */}
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {oficinasFiltradas.length} dependencia(s)
        </p>
        {oficinasFiltradas.map((o) => (
          <Card key={o.id}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 font-medium">
                    <Building2 className="size-4 text-muted-foreground" />
                    {o.codigo} · {o.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.unidad_nombre ?? "Sin proceso"} ·{" "}
                    {o.ubicacion_fisica ?? "Sin ubicación física"}
                    {o.ubicacion_digital ? ` · ${o.ubicacion_digital}` : ""}
                  </p>
                </div>
                {puedeEditar && (
                  <form action={eliminarOficina}>
                    <input type="hidden" name="id" value={o.id} />
                    <SubmitIcon
                      aria-label="Eliminar oficina"
                      confirmar={`¿Eliminar la dependencia "${o.codigo} · ${o.nombre}"? Esta acción no se puede deshacer.`}
                      exito="Dependencia eliminada."
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </SubmitIcon>
                  </form>
                )}
              </div>

              {/* Responsables */}
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  Responsables
                </p>
                {(responsables[o.id] ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sin responsables asignados.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {(responsables[o.id] ?? []).map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="flex items-center gap-1.5">
                          {r.es_principal && (
                            <Star className="size-3.5 fill-secondary text-secondary" />
                          )}
                          {r.nombre_completo ?? r.email}
                        </span>
                        {puedeEditar && (
                          <form action={quitarResponsable}>
                            <input type="hidden" name="id" value={r.id} />
                            <SubmitIcon
                              aria-label="Quitar responsable"
                              confirmar={`¿Quitar a ${r.nombre_completo ?? r.email} como responsable?`}
                              exito="Responsable retirado."
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              Quitar
                            </SubmitIcon>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {puedeEditar && (
                  <form
                    action={agregarResponsable}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="oficina_id" value={o.id} />
                    <select
                      name="usuario_id"
                      required
                      className="h-8 min-w-40 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Elegir usuario…</option>
                      {perfiles.map((p) => (
                        <option key={p.usuario_id} value={p.usuario_id}>
                          {p.nombre_completo ?? p.email}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="es_principal" value="1" />
                      Principal
                    </label>
                    <SubmitButton
                      size="sm"
                      variant="outline"
                      textoPendiente="Asignando…"
                      exito="Responsable asignado."
                    >
                      Asignar
                    </SubmitButton>
                  </form>
                )}
              </div>

              {/* Editar */}
              {puedeEditar && (
                <details className="text-sm">
                  <summary className="flex cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Pencil className="size-3.5" />
                    Editar oficina
                  </summary>
                  <div className="mt-3">
                    <FormOficina unidadId={o.unidad_id ?? ""} oficina={o} />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        ))}

        {oficinasFiltradas.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay dependencias que coincidan con el filtro.
          </p>
        )}
      </div>
    </div>
  );
}

function FormOficina({
  unidadId,
  oficina,
}: {
  unidadId: string;
  oficina?: OficinaListado;
}) {
  return (
    <form
      action={oficina ? actualizarOficina : crearOficina}
      className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-2"
    >
      {!oficina && (
        <p className="text-sm font-medium sm:col-span-2">Nueva oficina</p>
      )}
      {oficina && <input type="hidden" name="id" value={oficina.id} />}
      <input type="hidden" name="unidad_id" value={unidadId} />
      <div className="flex flex-col gap-1">
        <Label>Código</Label>
        <Input name="codigo" defaultValue={oficina?.codigo ?? ""} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Nombre</Label>
        <Input name="nombre" defaultValue={oficina?.nombre ?? ""} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Ubicación física</Label>
        <Input
          name="ubicacion_fisica"
          defaultValue={oficina?.ubicacion_fisica ?? ""}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Ubicación digital</Label>
        <Input
          name="ubicacion_digital"
          defaultValue={oficina?.ubicacion_digital ?? ""}
        />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton
          size="sm"
          textoPendiente="Guardando…"
          exito={oficina ? "Dependencia actualizada." : "Dependencia creada."}
        >
          {oficina ? "Guardar cambios" : "Crear oficina"}
        </SubmitButton>
      </div>
    </form>
  );
}
