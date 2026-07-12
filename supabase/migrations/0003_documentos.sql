-- =============================================================================
-- DocuNOVA — 0003 Documentos y Registros
-- Documentos (plantillas/rutas de cargue asociadas a una serie/oficina) y los
-- registros que los usuarios crean a partir de ellos. Depende de 0001 y 0002.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enumeraciones
-- -----------------------------------------------------------------------------
create type public.tipo_documento as enum ('ruta_cargue', 'diligenciable');
create type public.estado_documento as enum ('borrador', 'activo', 'archivado');
create type public.estado_registro as enum ('borrador', 'completado', 'anulado');

-- -----------------------------------------------------------------------------
-- 2. Documentos (definición/plantilla). "activo" => disponible para registrar.
-- -----------------------------------------------------------------------------
create table public.documentos (
  id                uuid primary key default gen_random_uuid(),
  serie_id          uuid references public.series (id) on delete set null,
  oficina_id        uuid not null references public.oficinas (id) on delete restrict,
  codigo            text,
  nombre            text not null,
  tipo              public.tipo_documento not null,
  es_publico        boolean not null default false,
  estado            public.estado_documento not null default 'borrador',
  url_plantilla     text,
  requiere_descarga boolean not null default false,
  creado_por        uuid references public.perfiles (usuario_id) on delete set null,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create index documentos_serie_idx on public.documentos (serie_id);
create index documentos_oficina_idx on public.documentos (oficina_id);

comment on table public.documentos is
  'Definición de documentos (ruta de cargue o diligenciable) por serie/oficina.';

create trigger documentos_tocar_before_update
  before update on public.documentos
  for each row execute function public.tocar_actualizado();

-- -----------------------------------------------------------------------------
-- 3. Registros (instancias creadas por los usuarios a partir de un documento).
-- -----------------------------------------------------------------------------
create table public.registros (
  id               uuid primary key default gen_random_uuid(),
  documento_id     uuid not null references public.documentos (id) on delete cascade,
  usuario_id       uuid not null references public.perfiles (usuario_id) on delete restrict,
  oficina_id       uuid references public.oficinas (id) on delete set null,
  url_archivo      text,
  datos_formulario jsonb not null default '{}'::jsonb,
  estado           public.estado_registro not null default 'borrador',
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
create index registros_documento_idx on public.registros (documento_id);
create index registros_usuario_idx on public.registros (usuario_id);
create index registros_oficina_idx on public.registros (oficina_id);

comment on table public.registros is
  'Registros documentales creados por los usuarios a partir de un documento.';

create trigger registros_tocar_before_update
  before update on public.registros
  for each row execute function public.tocar_actualizado();

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.documentos enable row level security;
alter table public.registros enable row level security;

-- documentos: los públicos los ve cualquier rol activo; los demás también
-- (la visibilidad fina por oficina puede endurecerse más adelante). Escritura:
-- quien elabora (gestor+). Borrado: aprobador.
create policy "documentos_select" on public.documentos
  for select to authenticated
  using (es_publico or public.es_lector());
create policy "documentos_insert" on public.documentos
  for insert to authenticated with check (public.puede_elaborar());
create policy "documentos_update" on public.documentos
  for update to authenticated
  using (public.puede_elaborar()) with check (public.puede_elaborar());
create policy "documentos_delete" on public.documentos
  for delete to authenticated using (public.puede_aprobar_trd());

-- registros: el autor ve/edita los suyos; los aprobadores ven todos. Crear:
-- cualquiera que pueda crear registros, siempre como autor de la fila.
create policy "registros_select" on public.registros
  for select to authenticated
  using (usuario_id = auth.uid() or public.puede_aprobar_trd());
create policy "registros_insert" on public.registros
  for insert to authenticated
  with check (public.puede_crear_registros() and usuario_id = auth.uid());
create policy "registros_update" on public.registros
  for update to authenticated
  using (usuario_id = auth.uid() or public.puede_aprobar_trd())
  with check (usuario_id = auth.uid() or public.puede_aprobar_trd());
create policy "registros_delete" on public.registros
  for delete to authenticated using (public.puede_aprobar_trd());

grant select, insert, update, delete on public.documentos to authenticated;
grant select, insert, update, delete on public.registros to authenticated;
