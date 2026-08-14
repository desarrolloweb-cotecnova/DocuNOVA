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
        "Resumen de tu actividad: registros recientes, documentos disponibles y accesos rápidos a los módulos. Haz clic en cada tarjeta para ver el detalle.",
    },
  },
  {
    prefijo: "/dependencias",
    contenido: {
      titulo: "Dependencias",
      texto:
        "Oficinas productoras agrupadas por proceso. Crea, edita o elimina oficinas y asigna sus responsables.",
    },
  },
  {
    prefijo: "/trd",
    contenido: {
      titulo: "Tablas de Retención Documental (TRD)",
      texto:
        "Filtra por Eje → Macroproceso → Proceso → Dependencia para ver su TRD. Consulta y elabora las series, subseries y tipos documentales con su soporte, tiempos de retención y disposición final. Envía la TRD a revisión, apruébala o recházala según tu rol, y exporta a PDF para imprimir.",
    },
  },
  {
    prefijo: "/documentos",
    contenido: {
      titulo: "Documentos",
      texto:
        "Definición de documentos (rutas de cargue o formatos diligenciables) por dependencia. Créalos, márcalos como públicos y actívalos para que puedan usarse en registros.",
    },
  },
  {
    prefijo: "/registros",
    contenido: {
      titulo: "Registros",
      texto:
        "A partir de un documento activo, crea un registro documental. Aquí ves los documentos disponibles y los registros que has creado.",
    },
  },
  {
    prefijo: "/consulta",
    contenido: {
      titulo: "Consulta",
      texto:
        "Busca registros por proceso, dependencia o documento. La tabla muestra el proceso, la dependencia, el documento, la fecha y el estado.",
    },
  },
  {
    prefijo: "/notificaciones",
    contenido: {
      titulo: "Notificaciones",
      texto:
        "Avisos del sistema sobre tus dependencias: TRD enviada a revisión, aprobada o rechazada; documentos activados o archivados; registros completados o anulados. Haz clic en una notificación para abrir el módulo relacionado o márcalas como leídas.",
    },
  },
  {
    prefijo: "/configuracion",
    contenido: {
      titulo: "Configuración",
      texto:
        "Administración del sistema en pestañas: Usuarios (activa cuentas y asigna roles), Estructura organizacional, Componentes de Memoria Corporativa y Monitoreo Supabase (uso del plan y estado de la base de datos). Solo disponible para superadmin y rector; el administrador ve únicamente los componentes de Memoria Corporativa.",
    },
  },
  {
    prefijo: "/memoria",
    contenido: {
      titulo: "Memoria Corporativa",
      texto:
        "Repositorio institucional en cuatro categorías: Memoria Histórica, Memoria de Gobierno, Memoria Activa y Banco de Proyectos. Los gestores cargan documentos (quedan pendientes) y los administradores los publican. Los documentos públicos los consulta cualquier usuario; los privados, solo los gestores.",
    },
  },
  {
    prefijo: "/perfil",
    contenido: {
      titulo: "Mi perfil",
      texto:
        "Tus datos en DocuNOVA. El rol lo asigna un administrador. Tu documento de identidad es un dato reservado, visible solo para ti y el administrador de usuarios.",
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
