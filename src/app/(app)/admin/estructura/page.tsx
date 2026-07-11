import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/config";
import type { Eje, Macroproceso, OficinaProductora, Proceso } from "@/lib/org";
import { cn } from "@/lib/utils";
import { renombrar, toggleActivo } from "./actions";

export const metadata: Metadata = {
  title: `Estructura organizacional — ${APP_NAME}`,
};

export default async function EstructuraPage() {
  const supabase = await createClient();
  const [
    { data: ejes },
    { data: macros },
    { data: procesos },
    { data: oficinas },
  ] = await Promise.all([
    supabase.from("ejes").select("*").order("codigo"),
    supabase.from("macroprocesos").select("*").order("codigo"),
    supabase.from("procesos").select("*").order("codigo"),
    supabase.from("oficinas_productoras").select("*").order("codigo"),
  ]);

  const listaEjes = (ejes ?? []) as Eje[];
  const listaMacros = (macros ?? []) as Macroproceso[];
  const listaProcesos = (procesos ?? []) as Proceso[];
  const listaOficinas = (oficinas ?? []) as OficinaProductora[];

  const oficinasIndependientes = listaOficinas.filter(
    (o) => o.proceso_id === null,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Administración
        </Link>
        <h1 className="text-2xl font-semibold">Estructura organizacional</h1>
        <p className="text-muted-foreground">
          {listaEjes.length} ejes · {listaMacros.length} macroprocesos ·{" "}
          {listaProcesos.length} procesos · {listaOficinas.length} oficinas
          productoras. Puedes renombrar o inactivar cada nodo.
        </p>
      </div>

      <div className="space-y-4">
        {listaEjes.map((eje) => (
          <div key={eje.id} className="rounded-lg border bg-card p-4">
            <Nodo
              tabla="ejes"
              id={eje.id}
              nombre={eje.nombre}
              activo={eje.activo}
            >
              <span className="font-mono text-xs text-muted-foreground">
                {eje.codigo}
              </span>
            </Nodo>

            <div className="mt-3 space-y-3 border-l pl-4">
              {listaMacros
                .filter((m) => m.eje_id === eje.id)
                .map((macro) => (
                  <div key={macro.id}>
                    <Nodo
                      tabla="macroprocesos"
                      id={macro.id}
                      nombre={macro.nombre}
                      activo={macro.activo}
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {macro.codigo}
                      </span>
                    </Nodo>
                    <div className="mt-2 space-y-2 border-l pl-4">
                      {listaProcesos
                        .filter((p) => p.macroproceso_id === macro.id)
                        .map((proc) => {
                          const ofis = listaOficinas.filter(
                            (o) => o.proceso_id === proc.id,
                          );
                          return (
                            <div key={proc.id}>
                              <Nodo
                                tabla="procesos"
                                id={proc.id}
                                nombre={proc.nombre}
                                activo={proc.activo}
                              />
                              {ofis.length > 0 && (
                                <ul className="mt-1 space-y-1 border-l pl-4">
                                  {ofis.map((o) => (
                                    <li key={o.id}>
                                      <Nodo
                                        tabla="oficinas_productoras"
                                        id={o.id}
                                        nombre={`${o.codigo} · ${o.nombre}`}
                                        activo={o.activo}
                                        small
                                      />
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {oficinasIndependientes.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">
            Clasificación independiente (fuera de la jerarquía de procesos)
          </h2>
          <ul className="space-y-1">
            {oficinasIndependientes.map((o) => (
              <li key={o.id}>
                <Nodo
                  tabla="oficinas_productoras"
                  id={o.id}
                  nombre={`${o.codigo} · ${o.nombre}`}
                  activo={o.activo}
                  small
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Nodo editable del árbol: nombre en línea con acción de renombrar y de
 * activar/inactivar.
 */
function Nodo({
  tabla,
  id,
  nombre,
  activo,
  small,
  children,
}: {
  tabla: string;
  id: string;
  nombre: string;
  activo: boolean;
  small?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={renombrar} className="flex items-center gap-1">
        <input type="hidden" name="tabla" value={tabla} />
        <input type="hidden" name="id" value={id} />
        <input
          name="nombre"
          defaultValue={nombre}
          aria-label="Nombre"
          className={cn(
            "min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-input focus:border-input focus:outline-none",
            small ? "text-sm" : "font-medium",
            !activo && "text-muted-foreground line-through",
          )}
        />
        <button
          type="submit"
          className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Renombrar
        </button>
      </form>
      {children}
      <form action={toggleActivo}>
        <input type="hidden" name="tabla" value={tabla} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="activo" value={activo ? "0" : "1"} />
        <button
          type="submit"
          className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {activo ? "Inactivar" : "Activar"}
        </button>
      </form>
    </div>
  );
}
