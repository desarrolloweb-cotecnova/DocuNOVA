"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidad } from "@/lib/auth/roles-server";
import { creaRegistros } from "@/lib/roles";
import {
  emitirNotificaciones,
  getResponsablesIds,
} from "@/lib/notificaciones-server";
import type { EstadoRegistro } from "@/lib/tipos";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function nullable(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

/** Crea un registro a partir de un documento activo (como autor). */
export async function crearRegistro(formData: FormData) {
  const supabase = await requireCapacidad(creaRegistros);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("registros").insert({
    documento_id: str(formData.get("documento_id")),
    usuario_id: user!.id,
    oficina_id: nullable(formData.get("oficina_id")),
    url_archivo: nullable(formData.get("url_archivo")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/registros");
}

/** Cambia el estado de un registro (completar / anular). */
export async function setEstadoRegistro(formData: FormData) {
  const supabase = await requireCapacidad(creaRegistros);
  const estado = str(formData.get("estado")) as EstadoRegistro;
  const id = str(formData.get("id"));

  const { error } = await supabase
    .from("registros")
    .update({ estado })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Notificar a los responsables de la oficina cuando el registro se
  // completa o se anula (los estados con impacto operativo).
  if (estado === "completado" || estado === "anulado") {
    const { data: reg } = await supabase
      .from("registros")
      .select("oficina_id, documentos(nombre)")
      .eq("id", id)
      .maybeSingle();
    const oficinaId = reg?.oficina_id as string | null | undefined;
    if (oficinaId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const responsables = await getResponsablesIds(supabase, oficinaId);
      const destinatarios = responsables.filter((uid) => uid !== user?.id);
      const docNombre =
        (reg?.documentos as unknown as { nombre: string } | null)?.nombre ??
        "Registro";
      const etiqueta = estado === "completado" ? "completado" : "anulado";
      await emitirNotificaciones(supabase, {
        destinatarios,
        tipo:
          estado === "completado" ? "registro_completado" : "registro_anulado",
        asunto: `Registro ${etiqueta} — ${docNombre}`,
        entidadTipo: "registro",
        entidadId: id,
      });
    }
  }

  revalidatePath("/registros");
  revalidatePath("/notificaciones");
}
