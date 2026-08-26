"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { apruebaTRD, elabora } from "@/lib/roles";
import {
  carpetaDrive,
  driveConfigurado,
  eliminarArchivo,
  iniciarCargaReanudable,
  obtenerArchivo,
} from "@/lib/drive";
import {
  CATEGORIAS_MEMORIA,
  MAX_BYTES_MEMORIA,
  VISIBILIDADES_MEMORIA,
  type CategoriaMemoria,
  type VisibilidadMemoria,
} from "@/lib/tipos";

const BUCKET = "memoria";
/** Extensiones permitidas (documentos ofimáticos e imágenes de soporte). */
const EXT_PERMITIDAS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "txt",
  "odt",
  "ods",
  "odp",
  "jpg",
  "jpeg",
  "png",
];

export type ResultadoCarga = { ok: boolean; mensaje: string };

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function nullable(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  return punto >= 0 ? nombre.slice(punto + 1).toLowerCase() : "";
}

/** Datos comunes del formulario de carga y de edición, ya validados. */
type Metadatos = {
  categoria: CategoriaMemoria;
  titulo: string;
  descripcion: string | null;
  componenteId: string;
  unidadId: string;
  visibilidad: VisibilidadMemoria;
};

/**
 * Valida los campos del documento contra la base (el componente debe ser de la
 * categoría y el proceso debe existir). Devuelve el error como texto.
 */
async function validarMetadatos(
  supabase: Awaited<ReturnType<typeof requireCapacidad>>,
  formData: FormData,
): Promise<{ ok: true; datos: Metadatos } | { ok: false; mensaje: string }> {
  const categoria = str(formData.get("categoria")) as CategoriaMemoria;
  if (!CATEGORIAS_MEMORIA.includes(categoria)) {
    return { ok: false, mensaje: "Categoría inválida." };
  }
  const titulo = str(formData.get("titulo"));
  if (!titulo) return { ok: false, mensaje: "El título es obligatorio." };

  const visibilidad = str(formData.get("visibilidad")) as VisibilidadMemoria;
  if (!VISIBILIDADES_MEMORIA.includes(visibilidad)) {
    return { ok: false, mensaje: "Visibilidad inválida." };
  }

  const componenteId = str(formData.get("componente_id"));
  if (!componenteId) return { ok: false, mensaje: "Selecciona un componente." };
  const { data: componente } = await supabase
    .from("memoria_componentes")
    .select("id")
    .eq("id", componenteId)
    .eq("categoria", categoria)
    .maybeSingle();
  if (!componente) {
    return {
      ok: false,
      mensaje: "El componente no corresponde a esta memoria.",
    };
  }

  const unidadId = str(formData.get("unidad_id"));
  if (!unidadId) {
    return { ok: false, mensaje: "Selecciona el proceso al que pertenece." };
  }
  const { data: proceso } = await supabase
    .from("unidades")
    .select("id")
    .eq("id", unidadId)
    .eq("tipo", "proceso")
    .maybeSingle();
  if (!proceso) {
    return { ok: false, mensaje: "El proceso seleccionado no es válido." };
  }

  return {
    ok: true,
    datos: {
      categoria,
      titulo,
      descripcion: nullable(formData.get("descripcion")),
      componenteId,
      unidadId,
      visibilidad,
    },
  };
}

// -----------------------------------------------------------------------------
// Carga en dos pasos
// -----------------------------------------------------------------------------
// El navegador sube los bytes directamente al destino (Drive o Supabase
// Storage) y luego llama a `registrarDocumento` solo con los metadatos. Enviar
// el archivo dentro de la Server Action fallaba con una página de error porque
// Next.js limita el cuerpo de una acción a 1 MB (y Vercel a 4.5 MB).

export type Preparacion =
  | { ok: true; destino: "drive"; uploadUrl: string }
  | { ok: true; destino: "supabase"; ruta: string; token: string }
  | { ok: false; mensaje: string };

/**
 * Autoriza la carga de un archivo y devuelve a dónde debe subirlo el navegador:
 * una sesión reanudable de Google Drive, o una URL firmada del bucket 'memoria'
 * cuando Drive todavía no está configurado.
 */
export async function prepararCarga(entrada: {
  categoria: string;
  nombre: string;
  tipo: string;
  tamano: number;
}): Promise<Preparacion> {
  try {
    await requireCapacidad(elabora);
  } catch {
    return { ok: false, mensaje: "No tienes permiso para cargar documentos." };
  }

  if (!CATEGORIAS_MEMORIA.includes(entrada.categoria as CategoriaMemoria)) {
    return { ok: false, mensaje: "Categoría inválida." };
  }
  if (!entrada.tamano || entrada.tamano <= 0) {
    return { ok: false, mensaje: "Selecciona un archivo." };
  }
  if (entrada.tamano > MAX_BYTES_MEMORIA) {
    return { ok: false, mensaje: "El archivo supera el límite de 25 MB." };
  }
  const ext = extensionDe(entrada.nombre);
  if (!EXT_PERMITIDAS.includes(ext)) {
    return {
      ok: false,
      mensaje: `Tipo de archivo no permitido (.${ext || "?"}).`,
    };
  }

  if (driveConfigurado()) {
    try {
      const cabeceras = await headers();
      const origen =
        cabeceras.get("origin") ??
        `https://${cabeceras.get("host") ?? "localhost"}`;
      const uploadUrl = await iniciarCargaReanudable({
        nombre: entrada.nombre,
        mimeType: entrada.tipo || "application/octet-stream",
        origen,
      });
      return { ok: true, destino: "drive", uploadUrl };
    } catch (e) {
      return {
        ok: false,
        mensaje:
          e instanceof Error ? e.message : "Error al conectar con Drive.",
      };
    }
  }

  const supabase = await requireCapacidad(elabora);
  const ruta = `${entrada.categoria}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(ruta);
  if (error || !data) {
    return {
      ok: false,
      mensaje: `No se pudo preparar la carga: ${error?.message ?? "sin detalle"}`,
    };
  }
  return { ok: true, destino: "supabase", ruta, token: data.token };
}

/**
 * Registra el documento una vez que el navegador subió el archivo. Verifica
 * contra el destino que el archivo existe de verdad (y, en Drive, que quedó en
 * la carpeta institucional) antes de insertar la fila.
 */
export async function registrarDocumento(
  _prev: ResultadoCarga,
  formData: FormData,
): Promise<ResultadoCarga> {
  let supabase: Awaited<ReturnType<typeof requireCapacidad>>;
  try {
    supabase = await requireCapacidad(elabora);
  } catch {
    return { ok: false, mensaje: "No tienes permiso para cargar documentos." };
  }

  const validacion = await validarMetadatos(supabase, formData);
  if (!validacion.ok) return validacion;
  const datos = validacion.datos;

  const nombreArchivo = str(formData.get("archivo_nombre"));
  const ext = extensionDe(nombreArchivo);
  if (!EXT_PERMITIDAS.includes(ext)) {
    return {
      ok: false,
      mensaje: `Tipo de archivo no permitido (.${ext || "?"}).`,
    };
  }

  const driveFileId = nullable(formData.get("drive_file_id"));
  const ruta = nullable(formData.get("archivo_ruta"));

  let almacenamiento: {
    archivo_ruta: string | null;
    drive_file_id: string | null;
    drive_enlace: string | null;
    archivo_tamano: number | null;
  };

  if (driveFileId) {
    const archivo = await obtenerArchivo(driveFileId);
    // El archivo debe estar en la carpeta institucional: así un cliente no
    // puede registrar cualquier ID de Drive ajeno.
    if (!archivo || !archivo.parents.includes(carpetaDrive())) {
      return {
        ok: false,
        mensaje: "El archivo no llegó a la carpeta de Drive de DocuNOVA.",
      };
    }
    if (archivo.size && archivo.size > MAX_BYTES_MEMORIA) {
      await eliminarArchivo(driveFileId);
      return { ok: false, mensaje: "El archivo supera el límite de 25 MB." };
    }
    almacenamiento = {
      archivo_ruta: null,
      drive_file_id: archivo.id,
      drive_enlace: archivo.webViewLink,
      archivo_tamano: archivo.size,
    };
  } else if (ruta) {
    const barra = ruta.lastIndexOf("/");
    const carpeta = barra >= 0 ? ruta.slice(0, barra) : "";
    const nombre = ruta.slice(barra + 1);
    const { data: objetos } = await supabase.storage
      .from(BUCKET)
      .list(carpeta, { search: nombre });
    const objeto = objetos?.find((o) => o.name === nombre);
    if (!objeto) {
      return { ok: false, mensaje: "El archivo no terminó de subirse." };
    }
    const tamano = (objeto.metadata as { size?: number } | null)?.size ?? null;
    if (tamano && tamano > MAX_BYTES_MEMORIA) {
      await supabase.storage.from(BUCKET).remove([ruta]);
      return { ok: false, mensaje: "El archivo supera el límite de 25 MB." };
    }
    almacenamiento = {
      archivo_ruta: ruta,
      drive_file_id: null,
      drive_enlace: null,
      archivo_tamano: tamano,
    };
  } else {
    return { ok: false, mensaje: "Selecciona un archivo." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("memoria_documentos").insert({
    categoria: datos.categoria,
    componente_id: datos.componenteId,
    unidad_id: datos.unidadId,
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    archivo_nombre: nombreArchivo,
    archivo_tipo: ext,
    visibilidad: datos.visibilidad,
    estado: "pendiente",
    cargado_por: user?.id ?? null,
    ...almacenamiento,
  });
  if (error) {
    // Limpia el archivo huérfano si falla el registro.
    if (almacenamiento.drive_file_id) {
      await eliminarArchivo(almacenamiento.drive_file_id);
    } else if (almacenamiento.archivo_ruta) {
      await supabase.storage.from(BUCKET).remove([almacenamiento.archivo_ruta]);
    }
    return { ok: false, mensaje: error.message };
  }

  revalidatePath("/memoria");
  return {
    ok: true,
    mensaje: "Documento cargado. Quedó pendiente de aprobación.",
  };
}

/**
 * Edita los datos de un documento ya cargado (título, descripción, componente,
 * proceso y visibilidad); el archivo no cambia. La RLS decide quién puede:
 * los aprobadores cualquiera, el autor solo mientras no esté publicado.
 */
export async function actualizarDocumento(
  _prev: ResultadoCarga,
  formData: FormData,
): Promise<ResultadoCarga> {
  let supabase: Awaited<ReturnType<typeof requireCapacidad>>;
  try {
    supabase = await requireCapacidad(elabora);
  } catch {
    return { ok: false, mensaje: "No tienes permiso para editar documentos." };
  }

  const id = str(formData.get("id"));
  if (!id) return { ok: false, mensaje: "Documento no indicado." };

  const validacion = await validarMetadatos(supabase, formData);
  if (!validacion.ok) return validacion;
  const datos = validacion.datos;

  const { data: actualizado, error } = await supabase
    .from("memoria_documentos")
    .update({
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      componente_id: datos.componenteId,
      unidad_id: datos.unidadId,
      visibilidad: datos.visibilidad,
    })
    .eq("id", id)
    .eq("categoria", datos.categoria)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, mensaje: error.message };
  if (!actualizado) {
    return {
      ok: false,
      mensaje: "No puedes editar este documento (o ya está publicado).",
    };
  }

  revalidatePath("/memoria");
  return { ok: true, mensaje: "Documento actualizado." };
}

/** Publica un documento (solo aprobador). */
export async function publicarDocumento(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("memoria_documentos")
    .update({
      estado: "publicado",
      aprobado_por: user?.id ?? null,
      comentario_revision: null,
    })
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/memoria");
}

/** Rechaza un documento (solo aprobador). */
export async function rechazarDocumento(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("memoria_documentos")
    .update({
      estado: "rechazado",
      aprobado_por: user?.id ?? null,
      comentario_revision: nullable(formData.get("comentario")),
    })
    .eq("id", str(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/memoria");
}

/** Elimina un documento y su archivo. Solo aprobadores (administrador+). */
export async function eliminarDocumento(formData: FormData) {
  const supabase = await requireCapacidad(apruebaTRD);
  const id = str(formData.get("id"));

  const { data: doc } = await supabase
    .from("memoria_documentos")
    .select("archivo_ruta, drive_file_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("memoria_documentos")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (doc?.drive_file_id) {
    await eliminarArchivo(doc.drive_file_id);
  } else if (doc?.archivo_ruta) {
    await supabase.storage.from(BUCKET).remove([doc.archivo_ruta]);
  }
  revalidatePath("/memoria");
}
