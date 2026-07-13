import { requireCapacidad } from "@/lib/auth/roles-server";
import { apruebaTRD } from "@/lib/roles";
import { construirLibroDatos } from "@/lib/excel";
import { PLANTILLAS } from "@/lib/plantillas";
import { filasTRD } from "@/services/exportaciones";

/** Descarga la plantilla de TRD con los datos actuales (solo admin). */
export async function GET() {
  try {
    await requireCapacidad(apruebaTRD);
  } catch {
    return new Response("No autorizado", { status: 403 });
  }

  const plantilla = PLANTILLAS.trd;
  const filas = await filasTRD();
  return new Response(construirLibroDatos(plantilla, filas), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${plantilla.archivo}"`,
    },
  });
}
