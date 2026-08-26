import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { descargarArchivo } from "@/lib/drive";

/**
 * Visualización de un documento de Memoria Corporativa. La RLS de
 * `memoria_documentos` decide si el usuario puede acceder: si no puede, el
 * SELECT no devuelve la fila y respondemos 404.
 *
 * Según dónde viva el archivo:
 *  * Google Drive  -> la app lo descarga con la cuenta de servicio y lo sirve
 *    en línea (el usuario no necesita permisos en Drive).
 *  * Supabase Storage -> se genera una URL firmada de corta duración y se
 *    redirige a ella.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("memoria_documentos")
    .select("archivo_ruta, drive_file_id, archivo_nombre")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json(
      { error: "Documento no disponible." },
      { status: 404 },
    );
  }

  if (doc.drive_file_id) {
    const respuesta = await descargarArchivo(doc.drive_file_id);
    if (!respuesta.ok || !respuesta.body) {
      return NextResponse.json(
        { error: "No se pudo obtener el archivo desde Google Drive." },
        { status: 502 },
      );
    }
    return new NextResponse(respuesta.body, {
      headers: {
        "content-type":
          respuesta.headers.get("content-type") ?? "application/octet-stream",
        // `inline` para que el navegador lo muestre cuando el tipo lo permite.
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(
          doc.archivo_nombre,
        )}`,
        "cache-control": "private, no-store",
      },
    });
  }

  if (!doc.archivo_ruta) {
    return NextResponse.json(
      { error: "El documento no tiene archivo asociado." },
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
