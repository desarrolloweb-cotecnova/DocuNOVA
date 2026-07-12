import { cn } from "@/lib/utils";

/**
 * Marca institucional de DocuNOVA. Usa los archivos oficiales en `public/`:
 *  - /docunova-logo.png     → logotipo completo (símbolo + "DocuNOVA" + bajada)
 *  - /docunova-simbolo.png  → isotipo / logosímbolo (solo el documento)
 *
 * Se usan imágenes estáticas del directorio público; la altura se controla con
 * clases y el ancho es automático para respetar la proporción del logo.
 */

/** Logotipo completo (para el login y la barra lateral). */
export function LogoFull({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/docunova-logo.png"
      alt="DocuNOVA — Gestión Documental Electrónica"
      className={cn("h-10 w-auto max-w-full", className)}
    />
  );
}

/** Isotipo / logosímbolo (para espacios reducidos, p. ej. el encabezado móvil). */
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/docunova-simbolo.png"
      alt="DocuNOVA"
      className={cn("h-8 w-auto", className)}
    />
  );
}
