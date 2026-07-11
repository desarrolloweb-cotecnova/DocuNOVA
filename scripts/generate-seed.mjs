#!/usr/bin/env node
/**
 * Genera supabase/migrations/0005_seed_datos.sql a partir de los CSV reales de
 * Cotecnova (data/trd_cotecnova.csv y data/usuarios_seed.csv).
 *
 * Uso:  node scripts/generate-seed.mjs
 *
 * El SQL resultante es idempotente (usa `on conflict do nothing` sobre las claves
 * naturales) y queda versionado para revisión. Reejecutable sin efectos
 * secundarios: los UUID se derivan de forma determinista de las claves naturales.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildModel } from "./lib/seed-model.mjs";
import { SUPER_ADMIN_EMAIL } from "./lib/org-data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "supabase", "migrations", "0005_seed_datos.sql");

/** Escapa un valor de texto para SQL (comillas simples). null -> NULL. */
function q(v) {
  if (v === null || v === undefined || v === "") return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function b(v) {
  return v ? "true" : "false";
}
function id(v) {
  return v === null ? "NULL" : `'${v}'`;
}

function main() {
  const trdText = readFileSync(join(root, "data", "trd_cotecnova.csv"), "utf8");
  const usuariosText = readFileSync(
    join(root, "data", "usuarios_seed.csv"),
    "utf8",
  );
  const m = buildModel(trdText, usuariosText);

  const out = [];
  out.push(
    "-- =============================================================================",
  );
  out.push(
    "-- DocuNOVA — Semilla de datos (GENERADO AUTOMÁTICAMENTE, no editar a mano)",
  );
  out.push("-- Fuente: data/trd_cotecnova.csv y data/usuarios_seed.csv");
  out.push("-- Regenerar con: node scripts/generate-seed.mjs");
  out.push(
    `-- Conteos: ${m.ejes.length} ejes, ${m.macroprocesos.length} macroprocesos, ` +
      `${m.procesos.length} procesos, ${m.oficinas.length} oficinas, ` +
      `${m.series.length} series, ${m.subseries.length} subseries, ` +
      `${m.usuariosSemilla.length} usuarios.`,
  );
  out.push(
    "-- =============================================================================",
  );
  out.push("");
  out.push("begin;");
  out.push("");

  out.push("-- Ejes");
  for (const e of m.ejes) {
    out.push(
      `insert into public.ejes (id, codigo, nombre) values (${id(e.id)}, ${q(e.codigo)}, ${q(e.nombre)}) on conflict (codigo) do nothing;`,
    );
  }
  out.push("");
  out.push("-- Macroprocesos");
  for (const x of m.macroprocesos) {
    out.push(
      `insert into public.macroprocesos (id, eje_id, codigo, nombre) values (${id(x.id)}, ${id(x.eje_id)}, ${q(x.codigo)}, ${q(x.nombre)}) on conflict (codigo) do nothing;`,
    );
  }
  out.push("");
  out.push("-- Procesos");
  for (const p of m.procesos) {
    out.push(
      `insert into public.procesos (id, macroproceso_id, codigo, nombre) values (${id(p.id)}, ${id(p.macroproceso_id)}, ${q(p.codigo)}, ${q(p.nombre)}) on conflict (codigo) do nothing;`,
    );
  }
  out.push("");
  out.push("-- Oficinas productoras");
  for (const o of m.oficinas) {
    out.push(
      `insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values (${id(o.id)}, ${id(o.proceso_id)}, ${q(o.codigo)}, ${q(o.nombre)}) on conflict (codigo) do nothing;`,
    );
  }
  out.push("");
  out.push("-- Series documentales");
  for (const s of m.series) {
    out.push(
      `insert into public.series (id, oficina_id, cod_serie, nombre) values (${id(s.id)}, ${id(s.oficina_id)}, ${q(s.cod_serie)}, ${q(s.nombre)}) on conflict (id) do nothing;`,
    );
  }
  out.push("");
  out.push("-- Subseries / tipos documentales");
  for (const s of m.subseries) {
    out.push(
      `insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values (` +
        `${id(s.id)}, ${id(s.serie_id)}, ${q(s.nombre)}, ${b(s.soporte_fisico)}, ${b(s.soporte_electronico)}, ${q(s.retencion_gestion)}, ${q(s.retencion_central)}, ${b(s.disp_conservacion_total)}, ${b(s.disp_eliminacion)}, ${b(s.disp_seleccion)}, ${b(s.disp_medio_digital)}, ${q(s.procedimiento)}, ${s.orden}) on conflict (id) do nothing;`,
    );
  }
  out.push("");
  out.push(
    "-- Usuarios semilla (pre-registro). NO son cuentas activas: el perfil real",
  );
  out.push(
    "-- se crea al primer inicio de sesión con Google (trigger handle_new_user).",
  );
  for (const u of m.usuariosSemilla) {
    out.push(
      `insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values (` +
        `${q(u.email)}, ${q(u.nombre)}, ${q(u.cedula)}, ${id(u.proceso_id)}, ${id(u.oficina_id)}, ${q(u.rol)}, ${b(u.requiere_cuenta)}, ${q(u.notas)}) on conflict (email) do nothing;`,
    );
  }
  out.push("");
  out.push(
    `-- Recordatorio: ${SUPER_ADMIN_EMAIL} se activa como super_admin desde el trigger,`,
  );
  out.push("-- no desde esta semilla (no requiere fila de pre-registro).");
  out.push("");
  out.push("commit;");
  out.push("");

  writeFileSync(OUT, out.join("\n"), "utf8");

  // Resumen en consola (sirve de verificación rápida).
  console.log("0005_seed_datos.sql generado.");
  console.log(`  Ejes:          ${m.ejes.length}`);
  console.log(`  Macroprocesos: ${m.macroprocesos.length}`);
  console.log(`  Procesos:      ${m.procesos.length}`);
  console.log(`  Oficinas:      ${m.oficinas.length}`);
  console.log(`  Series:        ${m.series.length}`);
  console.log(`  Subseries:     ${m.subseries.length}`);
  console.log(`  Usuarios:      ${m.usuariosSemilla.length}`);
}

main();
