import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton, SubmitIcon } from "@/components/ui/submit-button";
import {
  CATEGORIAS_MEMORIA,
  CATEGORIA_MEMORIA_LABELS,
  type MemoriaComponente,
} from "@/lib/tipos";
import {
  crearComponente,
  actualizarComponente,
  eliminarComponente,
} from "@/app/(app)/configuracion/actions";

/**
 * Gestión del catálogo de componentes de Memoria Corporativa: por cada memoria,
 * lista sus componentes (renombrar, activar/desactivar, eliminar) y permite
 * agregar nuevos. Alimenta el desplegable del formulario de carga y el filtro
 * del listado.
 */
export function ComponentesMemoriaGestion({
  componentes,
}: {
  componentes: MemoriaComponente[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Los componentes clasifican los documentos dentro de cada memoria. Se
        usan en la lista desplegable del formulario de carga y como filtro en el
        listado. Desactiva un componente para ocultarlo del formulario sin
        perder los documentos ya clasificados.
      </p>

      {CATEGORIAS_MEMORIA.map((categoria) => {
        const items = componentes.filter((c) => c.categoria === categoria);
        return (
          <Card key={categoria}>
            <CardHeader>
              <CardTitle className="text-base">
                {CATEGORIA_MEMORIA_LABELS[categoria]}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin componentes en esta memoria.
                </p>
              ) : (
                <ul className="divide-y">
                  {items.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-2 py-2"
                    >
                      <form
                        action={actualizarComponente}
                        className="flex flex-1 flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <Input
                          name="nombre"
                          defaultValue={c.nombre}
                          required
                          className="min-w-[12rem] flex-1"
                        />
                        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            name="activo"
                            defaultChecked={c.activo}
                            className="size-4"
                          />
                          Activo
                        </label>
                        <SubmitButton
                          size="sm"
                          variant="outline"
                          textoPendiente="Guardando…"
                          exito="Componente actualizado."
                        >
                          Guardar
                        </SubmitButton>
                      </form>
                      <form action={eliminarComponente}>
                        <input type="hidden" name="id" value={c.id} />
                        <SubmitIcon
                          aria-label="Eliminar componente"
                          confirmar={`¿Eliminar el componente "${c.nombre}"?`}
                          exito="Componente eliminado."
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </SubmitIcon>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form
                action={crearComponente}
                className="flex flex-wrap items-center gap-2 border-t pt-3"
              >
                <input type="hidden" name="categoria" value={categoria} />
                <Input
                  name="nombre"
                  placeholder="Nuevo componente…"
                  required
                  className="min-w-[12rem] flex-1"
                />
                <SubmitButton
                  size="sm"
                  textoPendiente="Agregando…"
                  exito="Componente agregado."
                >
                  <Plus className="size-4" />
                  Agregar
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
