-- =============================================================================
-- DocuNOVA — Fase 1: Catálogo TRD (Series → Subseries / Tipos documentales).
-- Importado desde la Tabla de Retención Documental real de Cotecnova
-- (data/trd_cotecnova.csv). Cada serie pertenece a una Oficina Productora; cada
-- subserie/tipo documental hereda su Oficina y, por ella, su Proceso.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Series documentales
-- -----------------------------------------------------------------------------
create table public.series (
  id         uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas_productoras (id) on delete restrict,
  cod_serie  text not null,
  nombre     text not null,
  activa     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (oficina_id, cod_serie, nombre)
);
create index series_oficina_idx on public.series (oficina_id);

-- -----------------------------------------------------------------------------
-- 2. Subseries / tipos documentales (atributos de la TRD)
-- -----------------------------------------------------------------------------
create table public.subseries (
  id                       uuid primary key default gen_random_uuid(),
  serie_id                 uuid not null references public.series (id) on delete cascade,
  nombre                   text not null,
  soporte_fisico           boolean not null default false,
  soporte_electronico      boolean not null default false,
  retencion_gestion        text,
  retencion_central        text,
  disp_conservacion_total  boolean not null default false,
  disp_eliminacion         boolean not null default false,
  disp_seleccion           boolean not null default false,
  disp_medio_digital       boolean not null default false,
  procedimiento            text,
  orden                    integer not null default 0,
  activa                   boolean not null default true,
  created_at               timestamptz not null default now()
);
create index subseries_serie_idx on public.subseries (serie_id);

comment on table public.subseries is
  'Subseries / tipos documentales de la TRD, con soporte, retención y disposición final.';

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
--    Lectura: cualquier usuario autenticado. Escritura: admin de archivo.
--    (El acceso a EXPEDIENTES/DOCUMENTOS por proceso llega en la Fase 2; el
--    catálogo TRD es institucional y de consulta general.)
-- -----------------------------------------------------------------------------
alter table public.series enable row level security;
alter table public.subseries enable row level security;

create policy "series_select" on public.series
  for select to authenticated using (true);
create policy "series_write_admin" on public.series
  for all to authenticated using (public.is_archivo_admin()) with check (public.is_archivo_admin());

create policy "subseries_select" on public.subseries
  for select to authenticated using (true);
create policy "subseries_write_admin" on public.subseries
  for all to authenticated using (public.is_archivo_admin()) with check (public.is_archivo_admin());

grant select, insert, update, delete on public.series to authenticated;
grant select, insert, update, delete on public.subseries to authenticated;
