import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Descarga de un documento de Memoria Corporativa. La RLS de `memoria_documentos`
 * y del bucket `memoria` decide si el usuario puede acceder: si no puede, el
 * SELECT no devuelve la fila y respondemos 404. Se genera una URL firmada de
 * corta duración y se redirige a ella.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("memoria_documentos")
    .select("archivo_ruta")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json(
      { error: "Documento no disponible." },
      { status: 404 },
    );
  }

  // URL firmada de corta duración; sin `download` para que el navegador lo
  // muestre en línea (visualizar) cuando el tipo lo permite (p. ej. PDF).
  const { data: firma, error } = await supabase.storage
    .from("memoria")
    .createSignedUrl(doc.archivo_ruta, 60);

  if (error || !firma?.signedUrl) {
    return NextResponse.json(
      { error: "No se pudo generar el enlace de descarga." },
      { status: 404 },
    );
  }

  return NextResponse.redirect(firma.signedUrl);
}
