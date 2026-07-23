-- =============================================================================
-- DocuNOVA — 0009 Memoria Corporativa
-- Repositorio institucional de documentos (PDF, Word, Excel, etc.) organizado en
-- cuatro categorías: Memoria Histórica, Memoria de Gobierno, Memoria Activa y
-- Banco de Proyectos. Los documentos los cargan los gestores (queda en estado
-- 'pendiente') y los publican los aprobadores (administrador+). Cada documento
-- es público (lo consulta cualquier rol activo) o privado (solo gestor+).
-- Los archivos se guardan en el bucket privado 'memoria' de Supabase Storage.
-- Depende de 0001 (funciones de rol y perfiles).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enumeraciones
-- -----------------------------------------------------------------------------
create type public.categoria_memoria as enum (
  'historica',        -- Memoria Histórica (documentos históricos)
  'gobierno',         -- Memoria de Gobierno (normativa vigente)
  'activa',           -- Memoria Activa (uso frecuente)
  'banco_proyectos'   -- Banco de Proyectos
);

create type public.visibilidad_memoria as enum (
  'publico',   -- lo consulta cualquier rol activo
  'privado'    -- solo lo consultan los gestores (gestor+)
);

create type public.estado_memoria as enum (
  'pendiente',   -- cargado por el gestor, a la espera de aprobación
  'publicado',   -- aprobado por un administrador y disponible para consulta
  'rechazado'    -- devuelto por el administrador
);

-- -----------------------------------------------------------------------------
-- 2. Tabla de documentos
-- -----------------------------------------------------------------------------
create table public.memoria_documentos (
  id                 uuid primary key default gen_random_uuid(),
  categoria          public.categoria_memoria not null,
  titulo             text not null,
  descripcion        text,
  archivo_ruta       text not null unique,   -- ruta del objeto en el bucket 'memoria'
  archivo_nombre     text not null,          -- nombre original del archivo
  archivo_tipo       text,                   -- extensión (pdf, docx, xlsx, ...)
  archivo_tamano     bigint,                 -- tamaño en bytes
  visibilidad        public.visibilidad_memoria not null default 'publico',
  estado             public.estado_memoria not null default 'pendiente',
  comentario_revision text,                  -- motivo del rechazo (opcional)
  cargado_por        uuid references public.perfiles (usuario_id) on delete set null,
  aprobado_por       uuid references public.perfiles (usuario_id) on delete set null,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);
create index memoria_documentos_categoria_idx
  on public.memoria_documentos (categoria, estado);
create index memoria_documentos_cargado_por_idx
  on public.memoria_documentos (cargado_por);

comment on table public.memoria_documentos is
  'Documentos de la Memoria Corporativa por categoría. Los sube el gestor
   (pendiente) y los publica el aprobador. Público = cualquier rol; privado = gestor+.';

create trigger memoria_documentos_tocar_before_update
  before update on public.memoria_documentos
  for each row execute function public.tocar_actualizado();

-- -----------------------------------------------------------------------------
-- 3. Row Level Security (tabla)
-- -----------------------------------------------------------------------------
alter table public.memoria_documentos enable row level security;

-- Lectura:
--  * publicado + público  -> cualquier rol activo
--  * publicado + privado  -> gestor+ (puede_elaborar)
--  * no publicado         -> el autor o un aprobador (para revisar/aprobar)
create policy "memoria_select" on public.memoria_documentos
  for select to authenticated
  using (
    (estado = 'publicado' and visibilidad = 'publico' and public.es_lector())
    or (estado = 'publicado' and visibilidad = 'privado' and public.puede_elaborar())
    or (estado <> 'publicado'
        and (cargado_por = auth.uid() or public.puede_aprobar_trd()))
  );

-- Alta: gestor+; siempre como autor y en estado 'pendiente'.
create policy "memoria_insert" on public.memoria_documentos
  for insert to authenticated
  with check (
    public.puede_elaborar()
    and cargado_por = auth.uid()
    and estado = 'pendiente'
  );

-- Edición: los aprobadores hacen cualquier cambio (publicar/rechazar). El autor
-- solo puede tocar su documento mientras no esté publicado, y no puede
-- publicarlo él mismo (el estado resultante no puede ser 'publicado').
create policy "memoria_update" on public.memoria_documentos
  for update to authenticated
  using (
    public.puede_aprobar_trd()
    or (cargado_por = auth.uid() and estado <> 'publicado')
  )
  with check (
    public.puede_aprobar_trd()
    or (cargado_por = auth.uid() and estado <> 'publicado')
  );

-- Borrado: los aprobadores borran cualquiera; el autor solo los suyos no publicados.
create policy "memoria_delete" on public.memoria_documentos
  for delete to authenticated
  using (
    public.puede_aprobar_trd()
    or (cargado_por = auth.uid() and estado <> 'publicado')
  );

grant select, insert, update, delete on public.memoria_documentos to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Almacenamiento de archivos (bucket privado + políticas en storage.objects)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('memoria', 'memoria', false)
on conflict (id) do nothing;

-- Subir/editar/borrar objetos del bucket: gestor+ (puede_elaborar).
create policy "memoria_objetos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'memoria' and public.puede_elaborar());

create policy "memoria_objetos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'memoria' and public.puede_elaborar())
  with check (bucket_id = 'memoria' and public.puede_elaborar());

create policy "memoria_objetos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'memoria' and public.puede_elaborar());

-- Descarga (crear URL firmada): mismo criterio de visibilidad que la tabla,
-- resuelto contra el documento cuyo archivo apunta a este objeto.
create policy "memoria_objetos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memoria'
    and exists (
      select 1
      from public.memoria_documentos d
      where d.archivo_ruta = storage.objects.name
        and (
          (d.estado = 'publicado' and d.visibilidad = 'publico' and public.es_lector())
          or (d.estado = 'publicado' and d.visibilidad = 'privado' and public.puede_elaborar())
          or (d.estado <> 'publicado'
              and (d.cargado_por = auth.uid() or public.puede_aprobar_trd()))
        )
    )
  );
