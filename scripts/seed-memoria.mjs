#!/usr/bin/env node
/**
 * Alimenta la Memoria Corporativa con documentos de ejemplo (PDFs vacíos) para
 * poder visualizar el repositorio. Genera un PDF mínimo válido por documento, lo
 * sube al bucket privado `memoria` de Supabase Storage e inserta la fila
 * correspondiente en `memoria_documentos` (estado publicado), enlazándola con el
 * componente que le corresponde por nombre.
 *
 * Requiere las variables de entorno (se leen de .env.local si existe):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (clave de servicio: solo local, nunca en el repo)
 *
 * Uso:
 *   node scripts/seed-memoria.mjs            # inserta los ejemplos (si no existen)
 *   node scripts/seed-memoria.mjs --reset    # borra los ejemplos previos y recarga
 *   npm run db:seed-memoria
 *
 * Prerrequisito: haber aplicado las migraciones 0009 y 0010 (tablas y bucket).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "memoria";
const MARCA = "Documento de ejemplo generado por seed-memoria.";

// --- Carga simple de .env.local -------------------------------------------
function cargarEnv() {
  const ruta = join(root, ".env.local");
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const l = linea.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i < 0) continue;
    const clave = l.slice(0, i).trim();
    let valor = l.slice(i + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

// --- PDF mínimo válido con el título como texto visible --------------------
function pdfDeEjemplo(texto) {
  const escapado = String(texto)
    .replace(/([\\()])/g, "\\$1")
    .slice(0, 80);
  const stream = `BT /F1 16 Tf 72 720 Td (${escapado}) Tj ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let cuerpo = "%PDF-1.4\n";
  const offsets = [];
  objetos.forEach((obj, i) => {
    offsets.push(cuerpo.length);
    cuerpo += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const inicioXref = cuerpo.length;
  let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
  return Buffer.from(cuerpo + xref + trailer, "latin1");
}

// --- Documentos de ejemplo (componente por nombre) -------------------------
const EJEMPLOS = [
  // Memoria Histórica
  ["historica", "Documentos de hitos históricos institucionales", "Acta de fundación de Cotecnova (1985)", "publico"],
  ["historica", "Reglamentos no vigentes", "Reglamento estudiantil 1998 (derogado)", "privado"],
  ["historica", "Informes de gestión de PDI y PEI", "Informe de ejecución PDI 2015-2019", "publico"],
  // Memoria de Gobierno
  ["gobierno", "Estatutos", "Estatuto general vigente", "publico"],
  ["gobierno", "Políticas y lineamientos", "Política de gestión documental", "publico"],
  ["gobierno", "Actos administrativos", "Resolución rectoral 045 de 2024", "privado"],
  // Memoria Activa
  ["activa", "SIGYC – Sistema Integrado de Gestión y Control", "Manual del SIGYC v3", "publico"],
  ["activa", "Documentos de programas académicos vigentes", "Registro calificado Técnico en Sistemas", "publico"],
  ["activa", "Convenios activos", "Convenio marco de cooperación 2025", "privado"],
  // Banco de Proyectos
  ["banco_proyectos", "Proyectos en formulación, ejecución y cierre", "Proyecto laboratorio de innovación", "publico"],
  ["banco_proyectos", "Lecciones aprendidas", "Lecciones aprendidas — modernización TI", "publico"],
  ["banco_proyectos", "Iniciativas e ideas con aval institucional", "Iniciativa campus sostenible", "privado"],
];

async function main() {
  cargarEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY " +
        "(defínelas en .env.local).",
    );
    process.exit(1);
  }
  const reset = process.argv.includes("--reset");
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ejemplos previos (por la marca en la descripción).
  const { data: previos } = await db
    .from("memoria_documentos")
    .select("id, archivo_ruta")
    .eq("descripcion", MARCA);

  if (previos && previos.length > 0) {
    if (!reset) {
      console.log(
        `Ya existen ${previos.length} documentos de ejemplo. Usa --reset para recargarlos.`,
      );
      return;
    }
    await db.storage.from(BUCKET).remove(previos.map((p) => p.archivo_ruta));
    await db
      .from("memoria_documentos")
      .delete()
      .in("id", previos.map((p) => p.id));
    console.log(`Eliminados ${previos.length} ejemplos previos.`);
  }

  // Autor de los ejemplos: un aprobador activo, si existe.
  const { data: autor } = await db
    .from("perfiles")
    .select("usuario_id")
    .in("rol", ["superadmin", "rector", "administrador"])
    .eq("activo", true)
    .limit(1)
    .maybeSingle();
  const autorId = autor?.usuario_id ?? null;

  // Componentes por (categoria, nombre).
  const { data: comps } = await db
    .from("memoria_componentes")
    .select("id, categoria, nombre");
  const compId = (categoria, nombre) =>
    comps?.find((c) => c.categoria === categoria && c.nombre === nombre)?.id ??
    null;

  let creados = 0;
  const errores = [];
  for (const [categoria, componente, titulo, visibilidad] of EJEMPLOS) {
    const componenteId = compId(categoria, componente);
    if (!componenteId) {
      errores.push(`Sin componente "${componente}" en ${categoria}; se omite "${titulo}".`);
      continue;
    }
    const ruta = `${categoria}/seed-${randomUUID()}.pdf`;
    const nombreArchivo = `${titulo}.pdf`;
    const buffer = pdfDeEjemplo(titulo);

    const { error: eUp } = await db.storage
      .from(BUCKET)
      .upload(ruta, buffer, { contentType: "application/pdf", upsert: true });
    if (eUp) {
      errores.push(`Subida "${titulo}": ${eUp.message}`);
      continue;
    }

    const { error: eIns } = await db.from("memoria_documentos").insert({
      categoria,
      componente_id: componenteId,
      titulo,
      descripcion: MARCA,
      archivo_ruta: ruta,
      archivo_nombre: nombreArchivo,
      archivo_tipo: "pdf",
      archivo_tamano: buffer.length,
      visibilidad,
      estado: "publicado",
      cargado_por: autorId,
      aprobado_por: autorId,
    });
    if (eIns) {
      await db.storage.from(BUCKET).remove([ruta]);
      errores.push(`Inserción "${titulo}": ${eIns.message}`);
      continue;
    }
    creados++;
  }

  console.log(`Documentos de ejemplo creados: ${creados}/${EJEMPLOS.length}.`);
  if (errores.length) {
    console.log("Incidencias:");
    for (const e of errores) console.log(`  - ${e}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
