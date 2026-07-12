/**
 * Ayuda contextual: texto de orientación según la página que el usuario está
 * viendo. Se muestra desde el botón de ayuda (?) del encabezado.
 */
export type AyudaContenido = { titulo: string; texto: string };

const AYUDA: { prefijo: string; contenido: AyudaContenido }[] = [
  {
    prefijo: "/dashboard",
    contenido: {
      titulo: "Panel",
      texto:
        "Resumen de tu proceso: expedientes, documentos, lo que espera tu firma y los expedientes próximos a vencer su tiempo de retención. Haz clic en cada tarjeta para ver el detalle.",
    },
  },
  {
    prefijo: "/expedientes",
    contenido: {
      titulo: "Expedientes",
      texto:
        "Un expediente agrupa documentos de una misma subserie de la TRD. Créalo con «Nuevo expediente»; al elegir la subserie, el sistema asigna solo el proceso y la oficina. Abre un expediente para ver y agregar sus documentos.",
    },
  },
  {
    prefijo: "/documentos",
    contenido: {
      titulo: "Documentos",
      texto:
        "Busca por texto en documentos electrónicos y por título en los físicos de tu proceso. Cada documento puede enviarse a un flujo de aprobación con firma electrónica.",
    },
  },
  {
    prefijo: "/aprobaciones",
    contenido: {
      titulo: "Aprobaciones",
      texto:
        "Aquí ves los documentos que esperan tu revisión y firma. Ábrelos para aprobar (queda registrada tu firma con fecha, IP y huella del documento) o rechazar.",
    },
  },
  {
    prefijo: "/notificaciones",
    contenido: {
      titulo: "Notificaciones",
      texto:
        "Avisos del sistema sobre tus documentos: pendientes de tu firma, aprobados o rechazados. Puedes marcarlos como leídos.",
    },
  },
  {
    prefijo: "/trd",
    contenido: {
      titulo: "Tablas de Retención Documental",
      texto:
        "Consulta las series y subseries documentales por proceso, con su soporte, tiempos de retención (gestión y central) y disposición final.",
    },
  },
  {
    prefijo: "/admin",
    contenido: {
      titulo: "Administración",
      texto:
        "Panel del super administrador: activa cuentas y asigna rol, proceso y oficina desde «Usuarios»; edita la estructura organizacional desde «Estructura».",
    },
  },
  {
    prefijo: "/perfil",
    contenido: {
      titulo: "Mi perfil",
      texto:
        "Tus datos en DocuNOVA. El rol y el proceso los asigna el administrador. Tu documento de identidad es un dato reservado, visible solo para ti y el super administrador.",
    },
  },
];

const POR_DEFECTO: AyudaContenido = {
  titulo: "Ayuda",
  texto:
    "DocuNOVA es el sistema de gestión de documentos electrónicos de archivo de Cotecnova. Usa el menú de la izquierda para navegar entre los módulos.",
};

/** Devuelve la ayuda correspondiente a la ruta actual. */
export function ayudaParaRuta(pathname: string): AyudaContenido {
  const encontrado = AYUDA.find(
    (a) => pathname === a.prefijo || pathname.startsWith(`${a.prefijo}/`),
  );
  return encontrado?.contenido ?? POR_DEFECTO;
}
