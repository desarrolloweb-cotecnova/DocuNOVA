import { construirLibro } from "@/lib/excel";
import { PLANTILLAS } from "@/lib/plantillas";

/** Descarga la plantilla de Excel para la carga masiva de usuarios (invitaciones). */
export async function GET() {
  const plantilla = PLANTILLAS.usuarios;
  return new Response(construirLibro(plantilla), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${plantilla.archivo}"`,
    },
  });
}
