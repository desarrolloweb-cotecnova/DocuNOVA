import type { Notificacion } from "@/lib/tipos";

/**
 * Devuelve la ruta a la que apunta una notificación según su entidad, para que
 * al hacer clic el usuario navegue al módulo relacionado. Cliente-safe (sin
 * imports de servidor).
 */
export function notificacionHref(n: Notificacion): string {
  switch (n.entidad_tipo) {
    case "serie":
      // La serie vive dentro de la TRD de una oficina; si tenemos la oficina en
      // entidad_id la usamos, si no, dejamos la vista general.
      return n.entidad_id ? `/trd?oficina=${n.entidad_id}` : "/trd";
    case "oficina":
      return `/trd?oficina=${n.entidad_id}`;
    case "documento":
      return "/documentos";
    case "registro":
      return "/registros";
    default:
      return "/notificaciones";
  }
}
