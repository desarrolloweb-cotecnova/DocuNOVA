"use client";

import { useEffect } from "react";

/**
 * Lanza el diálogo de impresión del navegador al montar. El usuario elige
 * "Guardar como PDF" en el diálogo para obtener el archivo.
 */
export function ImprimirAlCargar() {
  useEffect(() => {
    // Pequeño retraso para asegurar que las imágenes (logo) hayan cargado.
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return null;
}
