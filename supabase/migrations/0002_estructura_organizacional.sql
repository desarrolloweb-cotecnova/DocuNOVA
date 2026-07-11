-- =============================================================================
-- DocuNOVA — Fase 1: Estructura organizacional (Eje → Macroproceso → Proceso →
-- Oficina Productora). Reemplaza la tabla plana `dependencias` de la Fase 0.
-- El Proceso es la unidad de permisos; la Oficina Productora es clasificación
-- interna dentro de un Proceso.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Retirar el modelo plano de la Fase 0 (aún no aplicado a producción)
-- -----------------------------------------------------------------------------
drop policy if exists "dependencias_select_authenticated" on public.dependencias;
drop policy if exists "dependencias_write_admin" on public.dependencias;
alter table public.profiles drop column if exists dependencia_id;
drop table if exists public.dependencias;

-- -----------------------------------------------------------------------------
-- 2. Jerarquía organizacional
-- -----------------------------------------------------------------------------
create table public.ejes (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.macroprocesos (
  id         uuid primary key default gen_random_uuid(),
  eje_id     uuid not null references public.ejes (id) on delete restrict,
  codigo     text not null unique,
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create index macroprocesos_eje_idx on public.macroprocesos (eje_id);

create table public.procesos (
  id              uuid primary key default gen_random_uuid(),
  macroproceso_id uuid not null references public.macroprocesos (id) on delete restrict,
  codigo          text not null unique,
  nombre          text not null,
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index procesos_macroproceso_idx on public.procesos (macroproceso_id);

-- Oficina productora: pertenece a un Proceso, salvo el Consejo Directivo (1001),
-- que es una clasificación documental independiente (proceso_id nulo).
create table public.oficinas_productoras (
  id         uuid primary key default gen_random_uuid(),
  proceso_id uuid references public.procesos (id) on delete restrict,
  codigo     text not null unique,
  nombre     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create index oficinas_proceso_idx on public.oficinas_productoras (proceso_id);

comment on table public.oficinas_productoras is
  'Oficinas productoras de la TRD. proceso_id nulo = clasificación independiente (Consejo Directivo).';

-- -----------------------------------------------------------------------------
-- 3. Enlazar el perfil al Proceso (permiso) y, opcionalmente, a una Oficina
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column proceso_id uuid references public.procesos (id) on delete set null,
  add column oficina_id uuid references public.oficinas_productoras (id) on delete set null;

create index profiles_proceso_idx on public.profiles (proceso_id);

-- -----------------------------------------------------------------------------
-- 4. Funciones auxiliares para RLS
-- -----------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'super_admin';
$$;

create or replace function public.current_user_proceso()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select proceso_id from public.profiles where id = auth.uid();
$$;

-- ¿Puede el usuario actual gestionar datos del proceso indicado?
-- super_admin y admin_archivo: cualquier proceso. jefe/funcionario: solo el suyo.
create or replace function public.can_manage_proceso(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_archivo_admin()
      or (target is not null and target = public.current_user_proceso());
$$;

-- -----------------------------------------------------------------------------
-- 5. Row Level Security del catálogo organizacional
--    Lectura: cualquier usuario autenticado. Escritura: admin de archivo.
-- -----------------------------------------------------------------------------
alter table public.ejes enable row level security;
alter table public.macroprocesos enable row level security;
alter table public.procesos enable row level security;
alter table public.oficinas_productoras enable row level security;

create policy "ejes_select" on public.ejes
  for select to authenticated using (true);
create policy "ejes_write_admin" on public.ejes
  for all to authenticated using (public.is_archivo_admin()) with check (public.is_archivo_admin());

create policy "macro_select" on public.macroprocesos
  for select to authenticated using (true);
create policy "macro_write_admin" on public.macroprocesos
  for all to authenticated using (public.is_archivo_admin()) with check (public.is_archivo_admin());

create policy "procesos_select" on public.procesos
  for select to authenticated using (true);
create policy "procesos_write_admin" on public.procesos
  for all to authenticated using (public.is_archivo_admin()) with check (public.is_archivo_admin());

create policy "oficinas_select" on public.oficinas_productoras
  for select to authenticated using (true);
create policy "oficinas_write_admin" on public.oficinas_productoras
  for all to authenticated using (public.is_archivo_admin()) with check (public.is_archivo_admin());

-- -----------------------------------------------------------------------------
-- 6. Privilegios de tabla (RLS sigue gobernando el acceso por fila)
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.ejes to authenticated;
grant select, insert, update, delete on public.macroprocesos to authenticated;
grant select, insert, update, delete on public.procesos to authenticated;
grant select, insert, update, delete on public.oficinas_productoras to authenticated;
