"use client";

import { useRouter } from "next/navigation";

export type OficinaOpcion = { id: string; codigo: string; nombre: string };

/**
 * Selector de dependencia (oficina) que navega a `?oficina=<id>` al cambiar.
 * Reutilizado por TRD, Documentos y Registros.
 */
export function OficinaSelector({
  oficinas,
  actual,
  basePath,
}: {
  oficinas: OficinaOpcion[];
  actual: string | null;
  basePath: string;
}) {
  const router = useRouter();

  return (
    <select
      value={actual ?? ""}
      onChange={(e) => {
        const id = e.target.value;
        router.push(id ? `${basePath}?oficina=${id}` : basePath);
      }}
      className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-2 text-sm"
    >
      <option value="">Elegir dependencia…</option>
      {oficinas.map((o) => (
        <option key={o.id} value={o.id}>
          {o.codigo} · {o.nombre}
        </option>
      ))}
    </select>
  );
}
