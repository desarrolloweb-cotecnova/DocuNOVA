/**
 * Estructura organizacional canónica de Cotecnova (Ejes → Macroprocesos →
 * Procesos). Fuente de verdad: tabla "Estructura organizacional" del prompt
 * (docunovapromptmedo.md, niveles 1-3). Las Oficinas Productoras (nivel 4),
 * Series y Subseries NO se definen aquí: se derivan de la TRD real
 * (data/trd_cotecnova.csv).
 *
 * `codigo` de proceso = clave estable que coincide EXACTAMENTE con la columna
 * `Proceso` de data/usuarios_seed.csv (p. ej. "E-GI - Gestión Institucional"),
 * lo que permite enlazar cada usuario con su proceso sin ambigüedad.
 */

export const EJES = [
  { codigo: "E", nombre: "Estratégico" },
  { codigo: "M", nombre: "Misional" },
  { codigo: "A", nombre: "Apoyo" },
];

export const MACROPROCESOS = [
  { codigo: "GI", nombre: "Gobierno Institucional", eje: "E" },
  {
    codigo: "GC",
    nombre: "Gestión de Calidad y Mejoramiento Institucional",
    eje: "E",
  },
  { codigo: "GF", nombre: "Gestión de Formación", eje: "M" },
  { codigo: "IC", nombre: "Investigación, Innovación y Creación", eje: "M" },
  { codigo: "ER", nombre: "Extensión y Relacionamiento", eje: "M" },
  { codigo: "BI", nombre: "Bienestar Institucional", eje: "M" },
  { codigo: "CI", nombre: "Capital Intelectual", eje: "A" },
  { codigo: "GT", nombre: "Gestión de TIC", eje: "A" },
  { codigo: "FI", nombre: "Financiera", eje: "A" },
  { codigo: "GR", nombre: "Gestión de Recursos Logísticos", eje: "A" },
];

/**
 * 16 procesos. `codigo` = "{EJE}-{MACRO} - {nombre}". `nombreTrd` = nombre tal
 * como aparece en la columna `Proceso` de la TRD (para enlazar oficinas). Los
 * procesos 100% electrónicos no tienen oficina productora física ni filas TRD.
 */
export const PROCESOS = [
  {
    macro: "GI",
    nombre: "Gestión Institucional",
    nombreTrd: "Gestión Institucional",
  },
  {
    macro: "GI",
    nombre: "Gestión de Calidad",
    nombreTrd: "Gestión de Calidad",
  },
  { macro: "GI", nombre: "Gestión Jurídica", nombreTrd: "Gestión Jurídica" },
  {
    macro: "GI",
    nombre: "Gestión de Mercadeo",
    nombreTrd: "Gestión de Mercadeo",
  },
  { macro: "GC", nombre: "Sistemas Integrados de Gestión", nombreTrd: null },
  {
    macro: "GC",
    nombre: "Sistema de Aseguramiento Interno de Calidad",
    nombreTrd: null,
  },
  { macro: "GF", nombre: "Formación", nombreTrd: "Formación" },
  { macro: "IC", nombre: "Investigación", nombreTrd: "Investigación" },
  {
    macro: "ER",
    nombre: "Relación con el Sector Externo",
    nombreTrd: "Relación con el Sector Externo",
  },
  {
    macro: "BI",
    nombre: "Bienestar Institucional",
    nombreTrd: "Bienestar Institucional",
  },
  { macro: "CI", nombre: "Talento Humano", nombreTrd: "Talento Humano" },
  { macro: "GT", nombre: "Gestión de TIC", nombreTrd: "Gestión de TIC" },
  { macro: "FI", nombre: "Financiera", nombreTrd: "Financiera" },
  {
    macro: "GR",
    nombre: "Gestión Documental",
    nombreTrd: "Gestión Documental",
  },
  {
    macro: "GR",
    nombre: "Infraestructura Física",
    nombreTrd: "Infraestructura Física",
  },
  { macro: "GR", nombre: "Medios Educativos", nombreTrd: "Medios Educativos" },
].map((p) => ({
  ...p,
  eje: MACROPROCESOS.find((m) => m.codigo === p.macro).eje,
  codigo: `${MACROPROCESOS.find((m) => m.codigo === p.macro).eje}-${p.macro} - ${p.nombre}`,
}));

/** Valor de la columna `Proceso` de la TRD para el Consejo Directivo. */
export const CONSEJO_DIRECTIVO_TRD =
  "N/A - Consejo Directivo (entidad independiente)";

/** Código de la oficina independiente Consejo Directivo (sin proceso). */
export const CONSEJO_DIRECTIVO_COD = "1001";

/** Correo del super administrador, sembrado ACTIVO fuera del flujo de aprobación. */
export const SUPER_ADMIN_EMAIL = "desarrolloweb@cotecnova.edu.co";
