"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { canonicalDocumento } from "@/lib/aprobaciones";

/** Obtiene la IP del solicitante (para la firma y la auditoría). */
async function getIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida";
}

/** Inicia un flujo de aprobación para un documento con aprobadores en secuencia. */
export async function enviarAAprobacion(formData: FormData) {
  const supabase = await createClient();
  const documento_id = String(formData.get("documento_id") ?? "");
  if (!documento_id) throw new Error("Documento no especificado.");

  const aprobadores = [1, 2, 3]
    .map((n) => String(formData.get(`aprobador_${n}`) ?? "").trim())
    .filter((v) => v !== "");

  // Elimina duplicados conservando el orden.
  const secuencia = aprobadores.filter((v, i) => aprobadores.indexOf(v) === i);
  if (secuencia.length === 0) {
    throw new Error("Selecciona al menos un aprobador.");
  }

  const { error } = await supabase.rpc("crear_solicitud", {
    p_documento: documento_id,
    p_aprobadores: secuencia,
    p_ip: await getIp(),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/documentos/${documento_id}`);
}

/** Aprueba (firma) o rechaza un paso del flujo. */
export async function decidirPaso(formData: FormData) {
  const supabase = await createClient();
  const paso_id = String(formData.get("paso_id") ?? "");
  const documento_id = String(formData.get("documento_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comentario = String(formData.get("comentario") ?? "").trim() || null;
  if (!paso_id || !documento_id) throw new Error("Datos incompletos.");
  if (decision !== "aprobado" && decision !== "rechazado") {
    throw new Error("Decisión inválida.");
  }

  // Hash del documento en el momento de la firma (huella de integridad).
  const { data: doc } = await supabase
    .from("documentos")
    .select("id, titulo, tipo, fecha_documento, contenido")
    .eq("id", documento_id)
    .maybeSingle();
  if (!doc) throw new Error("Documento inexistente.");

  const hash =
    decision === "aprobado"
      ? createHash("sha256").update(canonicalDocumento(doc)).digest("hex")
      : null;

  const { error } = await supabase.rpc("decidir_paso", {
    p_paso: paso_id,
    p_decision: decision,
    p_comentario: comentario,
    p_hash: hash,
    p_ip: await getIp(),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/documentos/${documento_id}`);
  revalidatePath("/aprobaciones");
}
