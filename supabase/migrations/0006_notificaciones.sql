-- =============================================================================
-- DocuNOVA — 0006 Notificaciones
-- Sistema de notificaciones internas: cada evento relevante (TRD enviada a
-- revisión, aprobada/rechazada; documento activado/archivado; registro
-- completado/anulado) genera notificaciones para sus destinatarios naturales.
-- El destinatario las ve en la campanita del topbar y en la página /notificaciones.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enumeración de tipos de notificación
-- -----------------------------------------------------------------------------
create type public.tipo_notificacion as enum (
  'trd_enviada_revision',
  'trd_aprobada',
  'trd_rechazada',
  'documento_activado',
  'documento_archivado',
  'registro_completado',
  'registro_anulado'
);

-- -----------------------------------------------------------------------------
-- 2. Tabla
-- -----------------------------------------------------------------------------
create table public.notificaciones (
  id            uuid primary key default gen_random_uuid(),
  destinatario  uuid not null references public.perfiles (usuario_id) on delete cascade,
  tipo          public.tipo_notificacion not null,
  asunto        text not null,
  mensaje       text,
  entidad_tipo  text,     -- 'serie' | 'oficina' | 'documento' | 'registro'
  entidad_id    uuid,
  leida         boolean not null default false,
  creado_en     timestamptz not null default now()
);
create index notificaciones_destinatario_idx
  on public.notificaciones (destinatario, leida, creado_en desc);

comment on table public.notificaciones is
  'Notificaciones internas dirigidas a un destinatario (usuario). Se emiten
   automáticamente desde las server actions al ocurrir eventos relevantes.';

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.notificaciones enable row level security;

-- El destinatario ve sus notificaciones; el admin de usuarios ve todas.
create policy "notificaciones_select_propias" on public.notificaciones
  for select to authenticated
  using (destinatario = auth.uid() or public.es_admin_usuarios());

-- Solo el destinatario marca como leída (o cualquier otro cambio menor).
create policy "notificaciones_update_propias" on public.notificaciones
  for update to authenticated
  using (destinatario = auth.uid())
  with check (destinatario = auth.uid());

-- Cualquier rol activo puede insertar: las server actions actuales corren con
-- el rol authenticated del usuario que dispara el evento (elabora/aprueba/etc.)
-- y necesitan poder crear filas para otros destinatarios. La RLS de lectura
-- garantiza que el destinatario solo verá lo suyo.
create policy "notificaciones_insert_lector" on public.notificaciones
  for insert to authenticated
  with check (public.es_lector());

-- Borrado solo para el admin de usuarios (limpieza).
create policy "notificaciones_delete_admin" on public.notificaciones
  for delete to authenticated using (public.es_admin_usuarios());

grant select, insert, update, delete on public.notificaciones to authenticated;
