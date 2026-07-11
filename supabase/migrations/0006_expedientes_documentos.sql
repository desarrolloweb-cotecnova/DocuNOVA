-- =============================================================================
-- DocuNOVA — Fase 2: Expedientes y Documentos (físicos y electrónicos).
-- Cada expediente/documento se clasifica por una subserie de la TRD, lo que
-- fija automáticamente su Oficina Productora y su Proceso. La RLS aísla el
-- acceso por Proceso: un usuario del Proceso X no lee ni escribe los del
-- Proceso Y (salvo administradores de archivo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Funciones de autorización por proceso (lectura / escritura)
-- -----------------------------------------------------------------------------
-- Lectura: administrador de archivo (todo) o usuario del mismo proceso.
create or replace function public.can_read_proceso(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_archivo_admin()
      or (target is not null and target = public.current_user_proceso());
$$;

-- Escritura: administrador de archivo, o funcionario/jefe del mismo proceso.
-- El rol `consulta` nunca escribe (solo lectura).
create or replace function public.can_write_proceso(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_archivo_admin()
      or (
        target is not null
        and target = public.current_user_proceso()
        and public.current_user_role() in ('funcionario', 'jefe_dependencia')
      );
$$;

-- Deriva (proceso_id, oficina_id) a partir de una subserie de la TRD.
create or replace function public.clasificacion_de_subserie(p_subserie uuid)
returns table (proceso_id uuid, oficina_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select o.proceso_id, o.id
  from public.subseries sub
  join public.series se on se.id = sub.serie_id
  join public.oficinas_productoras o on o.id = se.oficina_id
  where sub.id = p_subserie;
$$;

-- -----------------------------------------------------------------------------
-- 2. Expedientes (agrupan documentos de una misma subserie)
-- -----------------------------------------------------------------------------
create table public.expedientes (
  id             uuid primary key default gen_random_uuid(),
  codigo         text,
  titulo         text not null,
  descripcion    text,
  subserie_id    uuid not null references public.subseries (id) on delete restrict,
  -- Denormalizados desde la subserie (los fija un trigger) para la RLS y filtros.
  proceso_id     uuid references public.procesos (id) on delete restrict,
  oficina_id     uuid references public.oficinas_productoras (id) on delete restrict,
  responsable_id uuid references public.profiles (id) on delete set null,
  estado         text not null default 'abierto'
                   check (estado in ('abierto', 'cerrado', 'archivado')),
  fecha_apertura date not null default current_date,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index expedientes_proceso_idx on public.expedientes (proceso_id);
create index expedientes_subserie_idx on public.expedientes (subserie_id);

-- -----------------------------------------------------------------------------
-- 3. Documentos (físicos: solo metadatos; electrónicos: contenido buscable)
-- -----------------------------------------------------------------------------
create table public.documentos (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid not null references public.expedientes (id) on delete cascade,
  tipo           text not null check (tipo in ('fisico', 'electronico')),
  titulo         text not null,
  descripcion    text,
  fecha_documento date,
  -- Denormalizados desde el expediente (trigger) para la RLS y filtros.
  proceso_id     uuid references public.procesos (id) on delete restrict,
  oficina_id     uuid references public.oficinas_productoras (id) on delete restrict,

  -- Metadatos de ubicación física (solo tipo = 'fisico').
  caja           text,
  estante        text,
  carpeta        text,
  folio_inicial  integer,
  folio_final    integer,
  estado_conservacion text,
  custodio_id    uuid references public.profiles (id) on delete set null,

  -- Contenido de documentos electrónicos (buscable por texto).
  contenido      text,

  -- Índice de texto completo (título + descripción + contenido), español.
  busqueda tsvector generated always as (
    to_tsvector(
      'spanish',
      coalesce(titulo, '') || ' ' ||
      coalesce(descripcion, '') || ' ' ||
      coalesce(contenido, '')
    )
  ) stored,

  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index documentos_expediente_idx on public.documentos (expediente_id);
create index documentos_proceso_idx on public.documentos (proceso_id);
create index documentos_busqueda_idx on public.documentos using gin (busqueda);

comment on table public.documentos is
  'Documentos físicos (metadatos de ubicación) y electrónicos (contenido buscable).';

-- -----------------------------------------------------------------------------
-- 4. Triggers de clasificación y auditoría de fechas
-- -----------------------------------------------------------------------------
-- Expediente: fija proceso/oficina desde la subserie y el autor.
create or replace function public.set_expediente_clasificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proc uuid;
  v_ofi  uuid;
begin
  select proceso_id, oficina_id into v_proc, v_ofi
  from public.clasificacion_de_subserie(new.subserie_id);
  new.proceso_id := v_proc;
  new.oficina_id := v_ofi;
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger expedientes_clasificacion
  before insert or update on public.expedientes
  for each row execute function public.set_expediente_clasificacion();

-- Documento: hereda proceso/oficina del expediente padre.
create or replace function public.set_documento_clasificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proc uuid;
  v_ofi  uuid;
begin
  select proceso_id, oficina_id into v_proc, v_ofi
  from public.expedientes where id = new.expediente_id;
  new.proceso_id := v_proc;
  new.oficina_id := v_ofi;
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger documentos_clasificacion
  before insert or update on public.documentos
  for each row execute function public.set_documento_clasificacion();

-- -----------------------------------------------------------------------------
-- 5. Row Level Security por Proceso
-- -----------------------------------------------------------------------------
alter table public.expedientes enable row level security;
alter table public.documentos enable row level security;

-- Expedientes
create policy "expedientes_select" on public.expedientes
  for select to authenticated
  using (public.can_read_proceso(proceso_id));

create policy "expedientes_insert" on public.expedientes
  for insert to authenticated
  with check (public.can_write_proceso(proceso_id));

create policy "expedientes_update" on public.expedientes
  for update to authenticated
  using (public.can_write_proceso(proceso_id))
  with check (public.can_write_proceso(proceso_id));

create policy "expedientes_delete" on public.expedientes
  for delete to authenticated
  using (public.can_write_proceso(proceso_id));

-- Documentos
create policy "documentos_select" on public.documentos
  for select to authenticated
  using (public.can_read_proceso(proceso_id));

create policy "documentos_insert" on public.documentos
  for insert to authenticated
  with check (public.can_write_proceso(proceso_id));

create policy "documentos_update" on public.documentos
  for update to authenticated
  using (public.can_write_proceso(proceso_id))
  with check (public.can_write_proceso(proceso_id));

create policy "documentos_delete" on public.documentos
  for delete to authenticated
  using (public.can_write_proceso(proceso_id));

grant select, insert, update, delete on public.expedientes to authenticated;
grant select, insert, update, delete on public.documentos to authenticated;
