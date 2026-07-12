-- =============================================================================
-- DocuNOVA — 0002 TRD (Tablas de Retención Documental)
-- Series como árbol autorreferente (serie -> subserie -> tipo) y bitácora de
-- aprobación por oficina. Depende de 0001 (oficinas, perfiles, helpers RLS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enumeraciones
-- -----------------------------------------------------------------------------
create type public.nivel_serie as enum ('serie', 'subserie', 'tipo');
create type public.estado_trd as enum
  ('borrador', 'en_revision', 'aprobado', 'rechazado');

-- -----------------------------------------------------------------------------
-- 2. Series documentales (árbol autorreferente por oficina).
-- -----------------------------------------------------------------------------
create table public.series (
  id                uuid primary key default gen_random_uuid(),
  oficina_id        uuid not null references public.oficinas (id) on delete restrict,
  padre_id          uuid references public.series (id) on delete cascade,
  codigo            text not null,
  nombre            text not null,
  nivel             public.nivel_serie not null,
  -- Soportes
  soporte_fisico    boolean not null default false,
  soporte_digital   boolean not null default false,
  -- Retención (años)
  anios_gestion     int,
  anios_central     int,
  -- Disposición final
  disp_conservacion boolean not null default false,
  disp_seleccion    boolean not null default false,
  disp_eliminacion  boolean not null default false,
  disp_digital      boolean not null default false,
  procedimiento     text,
  -- Estado del flujo de aprobación de la TRD de la oficina
  estado_aprobacion public.estado_trd not null default 'borrador',
  version           int not null default 1,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  unique (oficina_id, codigo, nivel)
);
create index series_oficina_idx on public.series (oficina_id);
create index series_padre_idx on public.series (padre_id);

comment on table public.series is
  'Entradas de la TRD (series, subseries y tipos documentales) por oficina.';

create trigger series_tocar_before_update
  before update on public.series
  for each row execute function public.tocar_actualizado();

-- -----------------------------------------------------------------------------
-- 3. Bitácora de aprobación de la TRD (append-only) por oficina.
-- -----------------------------------------------------------------------------
create table public.aprobaciones_trd (
  id         uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas (id) on delete cascade,
  estado     public.estado_trd not null,
  usuario_id uuid references public.perfiles (usuario_id) on delete set null,
  comentario text,
  creado_en  timestamptz not null default now()
);
create index aprobaciones_trd_oficina_idx on public.aprobaciones_trd (oficina_id);

comment on table public.aprobaciones_trd is
  'Historial de cambios de estado de la TRD de una oficina (solo inserciones).';

-- -----------------------------------------------------------------------------
-- 4. Protección del estado de aprobación: solo un aprobador (admin+) puede
--    pasar una serie a 'aprobado' o 'rechazado'. El gestor elabora pero no
--    aprueba.
-- -----------------------------------------------------------------------------
create or replace function public.proteger_estado_trd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado_aprobacion in ('aprobado', 'rechazado')
     and old.estado_aprobacion is distinct from new.estado_aprobacion
     and not public.puede_aprobar_trd() then
    raise exception 'Solo un aprobador puede aprobar o rechazar la TRD';
  end if;
  return new;
end;
$$;

create trigger series_proteger_estado_before_update
  before update on public.series
  for each row execute function public.proteger_estado_trd();

-- -----------------------------------------------------------------------------
-- 5. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.series enable row level security;
alter table public.aprobaciones_trd enable row level security;

-- series: lectura para cualquier rol activo; escritura para quien elabora
-- (gestor+). El cambio a aprobado/rechazado lo controla el trigger de arriba.
create policy "series_select" on public.series
  for select to authenticated using (public.es_lector());
create policy "series_insert" on public.series
  for insert to authenticated with check (public.puede_elaborar());
create policy "series_update" on public.series
  for update to authenticated
  using (public.puede_elaborar()) with check (public.puede_elaborar());
create policy "series_delete" on public.series
  for delete to authenticated using (public.puede_aprobar_trd());

-- aprobaciones_trd: lectura para cualquier rol activo; inserción solo aprobador.
create policy "aprobaciones_trd_select" on public.aprobaciones_trd
  for select to authenticated using (public.es_lector());
create policy "aprobaciones_trd_insert" on public.aprobaciones_trd
  for insert to authenticated with check (public.puede_aprobar_trd());

grant select, insert, update, delete on public.series to authenticated;
grant select, insert on public.aprobaciones_trd to authenticated;
