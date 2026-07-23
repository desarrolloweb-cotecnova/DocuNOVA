"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { apruebaTRD, elabora } from "@/lib/roles";
import {
  CATEGORIAS_MEMORIA,
  VISIBILIDADES_MEMORIA,
  type CategoriaMemoria,
  type VisibilidadMemoria,
} from "@/lib/tipos";

const BUCKET = "memoria";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
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

/** Carga un documento (queda en estado 'pendiente' hasta que un admin lo publique). */
export async function cargarDocumento(
  _prev: ResultadoCarga,
  formData: FormData,
): Promise<ResultadoCarga> {
  let supabase: Awaited<ReturnType<typeof requireCapacidad>>;
  try {
    supabase = await requireCapacidad(elabora);
  } catch {
    return { ok: false, mensaje: "No tienes permiso para cargar documentos." };
  }

  const categoria = str(formData.get("categoria")) as CategoriaMemoria;
  if (!CATEGORIAS_MEMORIA.includes(categoria)) {
    return { ok: false, mensaje: "Categoría inválida." };
  }
  const titulo = str(formData.get("titulo"));
  if (!titulo) {
    return { ok: false, mensaje: "El título es obligatorio." };
  }
  const visibilidad = str(formData.get("visibilidad")) as VisibilidadMemoria;
  if (!VISIBILIDADES_MEMORIA.includes(visibilidad)) {
    return { ok: false, mensaje: "Visibilidad inválida." };
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, mensaje: "Selecciona un archivo." };
  }
  if (archivo.size > MAX_BYTES) {
    return { ok: false, mensaje: "El archivo supera el límite de 25 MB." };
  }
  const ext = extensionDe(archivo.name);
  if (!EXT_PERMITIDAS.includes(ext)) {
    return {
      ok: false,
      mensaje: `Tipo de archivo no permitido (.${ext || "?"}).`,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = `${categoria}/${crypto.randomUUID()}.${ext}`;
  const { error: errSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, {
      contentType: archivo.type || undefined,
      upsert: false,
    });
  if (errSubida) {
    return { ok: false, mensaje: `No se pudo subir el archivo: ${errSubida.message}` };
  }

  const { error } = await supabase.from("memoria_documentos").insert({
    categoria,
    titulo,
    descripcion: nullable(formData.get("descripcion")),
    archivo_ruta: ruta,
    archivo_nombre: archivo.name,
    archivo_tipo: ext,
    archivo_tamano: archivo.size,
    visibilidad,
    estado: "pendiente",
    cargado_por: user?.id ?? null,
  });
  if (error) {
    // Limpia el objeto huérfano si falla el registro.
    await supabase.storage.from(BUCKET).remove([ruta]);
    return { ok: false, mensaje: error.message };
  }

  revalidatePath("/memoria");
  return {
    ok: true,
    mensaje: "Documento cargado. Quedó pendiente de aprobación.",
  };
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

/** Elimina un documento y su archivo. La RLS acota quién puede (aprobador o autor). */
export async function eliminarDocumento(formData: FormData) {
  const supabase = await requireCapacidad(elabora);
  const id = str(formData.get("id"));

  const { data: doc } = await supabase
    .from("memoria_documentos")
    .select("archivo_ruta")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("memoria_documentos")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (doc?.archivo_ruta) {
    await supabase.storage.from(BUCKET).remove([doc.archivo_ruta]);
  }
  revalidatePath("/memoria");
}
