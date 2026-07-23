#!/usr/bin/env node
/**
 * Genera supabase/INSTALACION_COMPLETA.sql a partir de las migraciones de
 * supabase/migrations/. El archivo resultante se pega completo en el SQL Editor
 * de Supabase y se ejecuta UNA vez: primero limpia cualquier objeto de una
 * instalación previa (esquema nuevo y antiguo) y luego aplica las migraciones
 * en orden.
 *
 * Uso:  node scripts/build-installer.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migDir = join(root, "supabase", "migrations");
const OUT = join(root, "supabase", "INSTALACION_COMPLETA.sql");

const PREAMBULO = `-- =============================================================================
-- DocuNOVA — INSTALACIÓN COMPLETA (generado desde supabase/migrations/)
-- Pega TODO este archivo en el SQL Editor de Supabase y presiona RUN una vez.
-- Regenerar con: node scripts/build-installer.mjs
--
-- PASO 0 (limpieza): elimina cualquier objeto de DocuNOVA de un intento previo
-- (esquema nuevo y también el antiguo), para que la instalación sea siempre
-- limpia. No afecta el esquema \`auth\` (Google/MFA) ni nada ajeno a DocuNOVA.
-- =============================================================================

drop trigger if exists on_auth_user_created on auth.users;

-- Políticas de almacenamiento (bucket 'memoria'): se recrean en la migración.
drop policy if exists "memoria_objetos_insert" on storage.objects;
drop policy if exists "memoria_objetos_update" on storage.objects;
drop policy if exists "memoria_objetos_delete" on storage.objects;
drop policy if exists "memoria_objetos_select" on storage.objects;

-- Tablas del esquema NUEVO
drop table if exists
  public.memoria_documentos,
  public.notificaciones,
  public.registros,
  public.documentos,
  public.aprobaciones_trd,
  public.series,
  public.responsables_oficina,
  public.datos_personales,
  public.usuarios_semilla,
  public.oficinas,
  public.perfiles,
  public.unidades
  cascade;

-- Tablas del esquema ANTIGUO (por si se actualiza desde una versión previa)
drop table if exists
  public.notificaciones,
  public.auditoria,
  public.firmas,
  public.aprobacion_pasos,
  public.aprobacion_solicitudes,
  public.documentos_old,
  public.expedientes,
  public.datos_sensibles,
  public.subseries,
  public.oficinas_productoras,
  public.procesos,
  public.macroprocesos,
  public.ejes,
  public.profiles,
  public.dependencias
  cascade;

-- Funciones (nuevas y antiguas)
drop function if exists
  public.handle_new_user(),
  public.proteger_privilegios_perfil(),
  public.proteger_estado_trd(),
  public.tocar_actualizado(),
  public.rol_actual(),
  public.es_admin_usuarios(),
  public.puede_aprobar_trd(),
  public.puede_elaborar(),
  public.puede_crear_registros(),
  public.es_lector(),
  public.current_user_role(),
  public.current_user_proceso(),
  public.is_archivo_admin(),
  public.is_super_admin(),
  public.can_manage_proceso(uuid),
  public.protect_profile_privileges()
  cascade;

-- Tipos (nuevos y antiguos)
drop type if exists
  public.categoria_memoria,
  public.visibilidad_memoria,
  public.estado_memoria,
  public.tipo_notificacion,
  public.estado_registro,
  public.estado_documento,
  public.tipo_documento,
  public.estado_trd,
  public.nivel_serie,
  public.tipo_unidad,
  public.rol_usuario,
  public.user_role
  cascade;

-- =============================================================================
-- Migraciones (en orden)
-- =============================================================================
`;

function main() {
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const parts = [PREAMBULO];
  for (const f of files) {
    const sql = readFileSync(join(migDir, f), "utf8");
    parts.push(`\n-- >>>>>>>>>> ${f} <<<<<<<<<<\n`);
    parts.push(sql.trimEnd());
    parts.push("");
  }

  writeFileSync(OUT, parts.join("\n") + "\n", "utf8");
  console.log(
    `INSTALACION_COMPLETA.sql generado desde ${files.length} migraciones:`,
  );
  for (const f of files) console.log(`  - ${f}`);
}

main();
