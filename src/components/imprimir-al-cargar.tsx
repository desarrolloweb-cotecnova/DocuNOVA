"use client";

import { useEffect } from "react";

/**
 * Controles de impresión: dispara el diálogo del navegador al montar y ofrece
 * un botón manual "Imprimir". El usuario elige "Guardar como PDF" en el
 * diálogo para obtener el archivo. Vive en un componente cliente porque el
 * botón usa onClick (no permitido en Server Components).
 */
export function ImprimirAlCargar({
  autoPrint = true,
  className,
}: {
  autoPrint?: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    // Pequeño retraso para asegurar que las imágenes (logo) hayan cargado.
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [autoPrint]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "rounded-md bg-[#00602F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#004d25]"
      }
    >
      Imprimir
    </button>
  );
}
