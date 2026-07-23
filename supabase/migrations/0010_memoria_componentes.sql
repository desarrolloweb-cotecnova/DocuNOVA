-- =============================================================================
-- DocuNOVA — 0010 Componentes de Memoria Corporativa
-- Catálogo de "componentes" (subcategorías) por cada memoria. Se gestionan desde
-- el módulo Gestión (superadmin/rector/administrador) y alimentan la lista
-- desplegable del formulario de carga y el filtro del listado. Cada documento de
-- memoria referencia un componente. También endurece el borrado de documentos:
-- solo los aprobadores (administrador+) pueden eliminar. Depende de 0009.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Catálogo de componentes por categoría
-- -----------------------------------------------------------------------------
create table public.memoria_componentes (
  id             uuid primary key default gen_random_uuid(),
  categoria      public.categoria_memoria not null,
  nombre         text not null,
  orden          integer not null default 0,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (categoria, nombre)
);
create index memoria_componentes_categoria_idx
  on public.memoria_componentes (categoria, orden);

comment on table public.memoria_componentes is
  'Componentes (subcategorías) de cada memoria. Alimentan el formulario de carga
   y el filtro del listado de Memoria Corporativa.';

create trigger memoria_componentes_tocar_before_update
  before update on public.memoria_componentes
  for each row execute function public.tocar_actualizado();

alter table public.memoria_componentes enable row level security;

-- Lectura: cualquier rol activo (para poblar el desplegable y el filtro).
create policy "memoria_componentes_select" on public.memoria_componentes
  for select to authenticated using (public.es_lector());

-- Gestión (crear/editar/eliminar): aprobadores (superadmin/rector/administrador).
create policy "memoria_componentes_write" on public.memoria_componentes
  for all to authenticated
  using (public.puede_aprobar_trd()) with check (public.puede_aprobar_trd());

grant select, insert, update, delete on public.memoria_componentes to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Relación documento -> componente
-- -----------------------------------------------------------------------------
alter table public.memoria_documentos
  add column componente_id uuid
    references public.memoria_componentes (id) on delete set null;
create index memoria_documentos_componente_idx
  on public.memoria_documentos (componente_id);

-- -----------------------------------------------------------------------------
-- 3. Borrado de documentos: solo aprobadores (administrador+).
--    (Sustituye la política de 0009 que también permitía al autor borrar los
--     suyos no publicados.)
-- -----------------------------------------------------------------------------
drop policy if exists "memoria_delete" on public.memoria_documentos;
create policy "memoria_delete" on public.memoria_documentos
  for delete to authenticated using (public.puede_aprobar_trd());

-- -----------------------------------------------------------------------------
-- 4. Semilla de componentes (según la especificación funcional de cada memoria).
-- -----------------------------------------------------------------------------
insert into public.memoria_componentes (categoria, nombre, orden) values
  -- Memoria Histórica
  ('historica', 'Documentos de hitos históricos institucionales', 1),
  ('historica', 'Documentos antiguos de programas', 2),
  ('historica', 'Reglamentos no vigentes', 3),
  ('historica', 'Informes de gestión de PDI y PEI', 4),
  ('historica', 'Otros (memoria histórica)', 5),
  -- Memoria de Gobierno
  ('gobierno', 'Estatutos', 1),
  ('gobierno', 'Reglamentos', 2),
  ('gobierno', 'Políticas y lineamientos', 3),
  ('gobierno', 'Actos administrativos', 4),
  ('gobierno', 'Actas', 5),
  ('gobierno', 'Contratos institucionales (convenios y similares)', 6),
  ('gobierno', 'Documentos de procesos legales', 7),
  ('gobierno', 'Otros (memoria de gobierno)', 8),
  -- Memoria Activa
  ('activa', 'SIGYC – Sistema Integrado de Gestión y Control', 1),
  ('activa', 'SAI – Sistema de Aseguramiento Interno de la Calidad', 2),
  ('activa', 'Documentos de programas académicos vigentes', 3),
  ('activa', 'Contratos laborales y otros contratos vigentes', 4),
  ('activa', 'Convenios activos', 5),
  ('activa', 'Otros (memoria activa)', 6),
  -- Banco de Proyectos
  ('banco_proyectos', 'Proyectos en formulación, ejecución y cierre', 1),
  ('banco_proyectos', 'Proyectos gestionados cerrados', 2),
  ('banco_proyectos', 'Iniciativas e ideas con aval institucional', 3),
  ('banco_proyectos', 'Lecciones aprendidas', 4)
on conflict (categoria, nombre) do nothing;
