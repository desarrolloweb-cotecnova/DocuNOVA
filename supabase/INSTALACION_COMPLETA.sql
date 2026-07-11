-- =============================================================================
-- DocuNOVA — INSTALACIÓN COMPLETA (generado a partir de supabase/migrations/)
-- Pega TODO este archivo en el SQL Editor de Supabase y presiona RUN una sola vez.
-- Ejecuta las migraciones 0001 a 0008 en orden.
-- =============================================================================


-- >>>>>>>>>> supabase/migrations/0001_init.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — Migración inicial (Fase 0: Fundación)
-- Crea el modelo base de usuarios/roles/dependencias con RLS activada.
-- Los módulos de TRD, expedientes, documentos y flujos llegan en migraciones
-- posteriores (fases 1 a 4).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum de roles del sistema (debe coincidir con src/lib/roles.ts)
-- -----------------------------------------------------------------------------
create type public.user_role as enum (
  'super_admin',      -- administra todo el sistema
  'admin_archivo',    -- administra TRD y configuración archivística
  'jefe_dependencia', -- aprueba/gestiona documentos de su dependencia
  'funcionario',      -- crea y gestiona documentos de su dependencia
  'consulta'          -- solo lectura (rol por defecto, mínimo privilegio)
);

-- -----------------------------------------------------------------------------
-- 2. Dependencias (oficinas / unidades administrativas productoras)
-- -----------------------------------------------------------------------------
create table public.dependencias (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  nombre      text not null,
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.dependencias is
  'Unidades administrativas de Cotecnova que producen documentos.';

-- -----------------------------------------------------------------------------
-- 3. Perfiles (1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  full_name      text,
  role           public.user_role not null default 'consulta',
  dependencia_id uuid references public.dependencias (id) on delete set null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de cada empleado. El rol por defecto es "consulta" (mínimo privilegio).';

create index profiles_dependencia_idx on public.profiles (dependencia_id);

-- -----------------------------------------------------------------------------
-- 4. Trigger: crear perfil automáticamente al registrarse un usuario
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 5. Función auxiliar para políticas RLS
--    SECURITY DEFINER para leer el rol sin provocar recursión en las políticas
--    de la propia tabla profiles.
-- -----------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_archivo_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('super_admin', 'admin_archivo');
$$;

-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.dependencias enable row level security;

-- profiles: cada quien ve su propio perfil; los administradores ven todos.
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_archivo_admin());

-- profiles: el usuario puede actualizar su propio perfil; los admins, cualquiera.
-- (El cambio de rol se controlará con reglas adicionales en fases posteriores.)
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_archivo_admin())
  with check (id = auth.uid() or public.is_archivo_admin());

-- dependencias: cualquier usuario autenticado puede consultarlas.
create policy "dependencias_select_authenticated"
  on public.dependencias for select
  to authenticated
  using (true);

-- dependencias: solo administradores de archivo pueden crearlas/editarlas/borrarlas.
create policy "dependencias_write_admin"
  on public.dependencias for all
  to authenticated
  using (public.is_archivo_admin())
  with check (public.is_archivo_admin());

-- -----------------------------------------------------------------------------
-- 7. Privilegios de tabla (RLS sigue gobernando el acceso por fila)
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.dependencias to authenticated;

-- =============================================================================
-- NOTA OPERATIVA — Promover al primer super administrador
-- Tras el primer inicio de sesión, ejecuta en el SQL Editor de Supabase:
--
--   update public.profiles
--   set role = 'super_admin'
--   where email = 'TU_CORREO@cotecnova.edu.co';
-- =============================================================================


-- >>>>>>>>>> supabase/migrations/0002_estructura_organizacional.sql <<<<<<<<<<

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


-- >>>>>>>>>> supabase/migrations/0003_trd_catalogo.sql <<<<<<<<<<

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


-- >>>>>>>>>> supabase/migrations/0004_semilla_y_activacion.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — Fase 1: Pre-registro de usuarios, datos sensibles y flujo de
-- activación manual. Los perfiles nacen INACTIVOS (pendientes de aprobación),
-- salvo el super administrador. La cédula se guarda aparte, con acceso
-- restringido (Ley 1581 de 2012 — habeas data).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Pre-registro (semilla): datos conocidos de cada empleado ANTES de que
--    inicie sesión por primera vez con Google. Contiene cédula -> sensible.
-- -----------------------------------------------------------------------------
create table public.usuarios_semilla (
  email           text primary key,
  nombre          text not null,
  cedula          text,
  proceso_id      uuid references public.procesos (id) on delete set null,
  oficina_id      uuid references public.oficinas_productoras (id) on delete set null,
  rol             public.user_role not null default 'consulta',
  requiere_cuenta boolean not null default true,
  notas           text,
  created_at      timestamptz not null default now()
);

comment on table public.usuarios_semilla is
  'Pre-registro de empleados. El perfil real se crea al primer login (trigger).';

-- -----------------------------------------------------------------------------
-- 2. Datos sensibles del perfil (cédula). Tabla aparte para poder ocultarla de
--    los listados generales mediante RLS: solo el dueño y el super admin.
-- -----------------------------------------------------------------------------
create table public.datos_sensibles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  cedula     text,
  updated_at timestamptz not null default now()
);

comment on table public.datos_sensibles is
  'Datos personales sensibles (cédula). Acceso restringido: dueño y super_admin.';

-- -----------------------------------------------------------------------------
-- 3. Los perfiles nuevos nacen INACTIVOS (pendientes de aprobación).
-- -----------------------------------------------------------------------------
alter table public.profiles alter column is_active set default false;

-- -----------------------------------------------------------------------------
-- 4. Reescribir el trigger de creación de perfil para enriquecerlo desde la
--    semilla y aplicar el flujo de activación.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text := lower(new.email);
  v_semilla public.usuarios_semilla%rowtype;
  v_role    public.user_role := 'consulta';
  v_active  boolean := false;
  v_name    text;
  v_proceso uuid;
  v_oficina uuid;
  v_cedula  text;
begin
  v_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.email
  );

  if v_email = 'desarrolloweb@cotecnova.edu.co' then
    -- Super administrador: única cuenta que nace ACTIVA (activa a las demás).
    v_role := 'super_admin';
    v_active := true;
  else
    select * into v_semilla from public.usuarios_semilla where email = v_email;
    if found then
      v_role := v_semilla.rol;
      v_name := coalesce(v_semilla.nombre, v_name);
      v_proceso := v_semilla.proceso_id;
      v_oficina := v_semilla.oficina_id;
      v_cedula := v_semilla.cedula;
      -- v_active permanece false: requiere activación manual del super admin.
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role, proceso_id, oficina_id, is_active)
  values (new.id, new.email, v_name, v_role, v_proceso, v_oficina, v_active);

  if v_cedula is not null then
    insert into public.datos_sensibles (profile_id, cedula)
    values (new.id, v_cedula)
    on conflict (profile_id) do update set cedula = excluded.cedula;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Guard anti-escalada: un usuario no super_admin no puede cambiar su propio
--    rol, estado, proceso ni oficina (aunque la política le permita editar su
--    perfil para actualizar nombre/correo).
-- -----------------------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    new.proceso_id := old.proceso_id;
    new.oficina_id := old.oficina_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_profile_privileges_before_update
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileges();

-- -----------------------------------------------------------------------------
-- 6. Políticas de acceso a perfiles (reemplazan las de la Fase 0)
-- -----------------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;

-- Lectura: el propio perfil; el super admin ve todos; el jefe ve los de su proceso.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or (
      public.current_user_role() = 'jefe_dependencia'
      and proceso_id is not null
      and proceso_id = public.current_user_proceso()
    )
  );

-- Actualización: el propio perfil (campos no privilegiados, ver guard) o el
-- super admin (activación, rol, proceso).
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 7. RLS de las tablas sensibles
-- -----------------------------------------------------------------------------
alter table public.usuarios_semilla enable row level security;
alter table public.datos_sensibles enable row level security;

-- Pre-registro (contiene cédulas): solo el super admin.
create policy "semilla_super_admin" on public.usuarios_semilla
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Datos sensibles: el dueño los ve; el super admin, todos. Escritura: super admin.
create policy "datos_sensibles_select" on public.datos_sensibles
  for select to authenticated
  using (profile_id = auth.uid() or public.is_super_admin());
create policy "datos_sensibles_write" on public.datos_sensibles
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

grant select, insert, update, delete on public.usuarios_semilla to authenticated;
grant select, insert, update, delete on public.datos_sensibles to authenticated;


-- >>>>>>>>>> supabase/migrations/0005_seed_datos.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — Semilla de datos (GENERADO AUTOMÁTICAMENTE, no editar a mano)
-- Fuente: data/trd_cotecnova.csv y data/usuarios_seed.csv
-- Regenerar con: node scripts/generate-seed.mjs
-- Conteos: 3 ejes, 10 macroprocesos, 16 procesos, 25 oficinas, 128 series, 230 subseries, 38 usuarios.
-- =============================================================================

begin;

-- Ejes
insert into public.ejes (id, codigo, nombre) values ('e2114d1f-499f-5f28-b4e5-e6cbc99461e6', 'E', 'Estratégico') on conflict (codigo) do nothing;
insert into public.ejes (id, codigo, nombre) values ('23a58c10-a75b-5648-9fd0-ae0c588f94c2', 'M', 'Misional') on conflict (codigo) do nothing;
insert into public.ejes (id, codigo, nombre) values ('41fb5189-123d-5b5a-87d6-c9a3a3b21845', 'A', 'Apoyo') on conflict (codigo) do nothing;

-- Macroprocesos
insert into public.macroprocesos (id, eje_id, codigo, nombre) values ('2043bfcc-c895-5d32-b52c-6d099b95d22c', 'e2114d1f-499f-5f28-b4e5-e6cbc99461e6', 'GI', 'Gobierno Institucional') on conflict (codigo) do nothing;
insert into public.macroprocesos (id, eje_id, codigo, nombre) values ('cd0360ec-26f8-5312-8fd1-39c1c524e56a', 'e2114d1f-499f-5f28-b4e5-e6cbc99461e6', 'GC', 'Gestión de Calidad y Mejoramiento Institucional') on conflict (codigo) do nothing;
insert into public.macroprocesos (id, eje_id, codigo, nombre) values ('f0a55259-395c-5b92-9b0a-d1ede299c0ae', '23a58c10-a75b-5648-9fd0-ae0c588f94c2', 'GF', 'Gestión de Formación') on conflict (codigo) do nothing;
insert into public.macroprocesos (id, eje_id, codigo, nombre) values ('5a3a58c2-b5ef-5aff-9231-e4fb794a02de', '23a58c10-a75b-5648-9fd0-ae0c588f94c2', 'IC', 'Investigación, Innovación y Creación') on conflict (codigo) do nothing;
insert into public.macroprocesos (id, eje_id, codigo, nombre) values ('445c1717-878b-59ea-89a3-f2716114bcb7', '23a58c10-a75b-5648-9fd0-ae0c588f94c2', 'ER', 'Extensión y Relacionamiento') on conflict (codigo) do nothing;
insert into public.macroprocesos (id, eje_id, codigo, nombre) values ('3a2e87e1-8f31-5a2d-a6f8-d992cf0cbbe9', '23a58c10-a75b-5648-9fd0-ae0c588f94c2', 'BI', 'Bienestar Institucional') on conflict (codigo) do nothing;
insert into public.macroprocesos (id, eje_id, codigo, nombre) values ('5dffa481-abdb-5545-ad98-e54316ad8144', '41fb5189-123d-5b5a-87d6-c9a3a3b21845', 'CI', 'Capital Intelectual') on conflict (codigo) do nothing;
insert into public.macroprocesos (id, eje_id, codigo, nombre) values ('f7384a3e-2d8c-5688-afaf-12ec1f45bc31', '41fb5189-123d-5b5a-87d6-c9a3a3b21845', 'GT', 'Gestión de TIC') on conflict (codigo) do nothing;
insert into public.macroprocesos (id, eje_id, codigo, nombre) values ('791e2827-0e15-5367-a96f-e4a8848ff00f', '41fb5189-123d-5b5a-87d6-c9a3a3b21845', 'FI', 'Financiera') on conflict (codigo) do nothing;
insert into public.macroprocesos (id, eje_id, codigo, nombre) values ('588e0097-04c1-5b82-985e-994366ea6402', '41fb5189-123d-5b5a-87d6-c9a3a3b21845', 'GR', 'Gestión de Recursos Logísticos') on conflict (codigo) do nothing;

-- Procesos
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('54174274-32f2-5c8e-b216-90865652de87', '2043bfcc-c895-5d32-b52c-6d099b95d22c', 'E-GI - Gestión Institucional', 'Gestión Institucional') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('be0e3eaa-305b-5e42-88d2-a4f555ede2fd', '2043bfcc-c895-5d32-b52c-6d099b95d22c', 'E-GI - Gestión de Calidad', 'Gestión de Calidad') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('a38726d6-f6c2-5835-8242-3acf68df3240', '2043bfcc-c895-5d32-b52c-6d099b95d22c', 'E-GI - Gestión Jurídica', 'Gestión Jurídica') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('9c8eca2d-e14d-5c87-b99c-470f4b3d9196', '2043bfcc-c895-5d32-b52c-6d099b95d22c', 'E-GI - Gestión de Mercadeo', 'Gestión de Mercadeo') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('df43aeda-dae2-5580-bdf4-58428f97d54d', 'cd0360ec-26f8-5312-8fd1-39c1c524e56a', 'E-GC - Sistemas Integrados de Gestión', 'Sistemas Integrados de Gestión') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('b873aeec-3250-5f5f-a798-668d94b26dcb', 'cd0360ec-26f8-5312-8fd1-39c1c524e56a', 'E-GC - Sistema de Aseguramiento Interno de Calidad', 'Sistema de Aseguramiento Interno de Calidad') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('54357430-b487-523e-b6a2-05d2560e32c1', 'f0a55259-395c-5b92-9b0a-d1ede299c0ae', 'M-GF - Formación', 'Formación') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('018c88da-962e-58f6-ab40-df0a48b060a9', '5a3a58c2-b5ef-5aff-9231-e4fb794a02de', 'M-IC - Investigación', 'Investigación') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('8c22b2f9-a997-5be9-b78a-0c6f9dee1160', '445c1717-878b-59ea-89a3-f2716114bcb7', 'M-ER - Relación con el Sector Externo', 'Relación con el Sector Externo') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('ea08162f-89f1-58b0-9565-27972753d2c1', '3a2e87e1-8f31-5a2d-a6f8-d992cf0cbbe9', 'M-BI - Bienestar Institucional', 'Bienestar Institucional') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('26330852-b029-57d8-bb58-19d485a05ff6', '5dffa481-abdb-5545-ad98-e54316ad8144', 'A-CI - Talento Humano', 'Talento Humano') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('99a2f096-5665-555b-8904-df6af9f93c52', 'f7384a3e-2d8c-5688-afaf-12ec1f45bc31', 'A-GT - Gestión de TIC', 'Gestión de TIC') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('c6df12e5-be61-547b-b476-8bd315244e07', '791e2827-0e15-5367-a96f-e4a8848ff00f', 'A-FI - Financiera', 'Financiera') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('01abdc65-1a5b-5e01-aac8-e5e57dbbe3c2', '588e0097-04c1-5b82-985e-994366ea6402', 'A-GR - Gestión Documental', 'Gestión Documental') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('244303d4-4223-528f-8bd8-bc7ce67fbff0', '588e0097-04c1-5b82-985e-994366ea6402', 'A-GR - Infraestructura Física', 'Infraestructura Física') on conflict (codigo) do nothing;
insert into public.procesos (id, macroproceso_id, codigo, nombre) values ('9a5d44ad-162a-5b35-b3e5-583623f7c0f8', '588e0097-04c1-5b82-985e-994366ea6402', 'A-GR - Medios Educativos', 'Medios Educativos') on conflict (codigo) do nothing;

-- Oficinas productoras
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('d9c11af4-ab4a-5984-9795-58a1943c6a12', NULL, '1001', 'Consejo Directivo') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('a2961400-2974-5902-a693-aec6aca0bb98', 'a38726d6-f6c2-5835-8242-3acf68df3240', '1110', 'Gestion Juridica - Secretaría General') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('b99d3a29-f0e2-5bb5-925e-b81141dab901', '54174274-32f2-5c8e-b216-90865652de87', '1100', 'Gestion Institucional - Secretaria Rectoria') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('96beb166-6c6d-5347-88d3-e33179741221', '54174274-32f2-5c8e-b216-90865652de87', '1120', 'Recepción') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('f7738818-9cf2-5b3f-a417-6459e4188b04', 'be0e3eaa-305b-5e42-88d2-a4f555ede2fd', '1210', 'Gestión de Calidad') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('8308c023-b09b-5427-9af4-cc22d2201183', '9c8eca2d-e14d-5c87-b99c-470f4b3d9196', '1220', 'Gestión de Mercadeo') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('2d813051-0144-5a34-a56f-b0a1398f1095', '244303d4-4223-528f-8bd8-bc7ce67fbff0', '1230', 'Infraestructura física') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('e5682a2b-3de3-5f10-a717-5b4a362773f7', '26330852-b029-57d8-bb58-19d485a05ff6', '1240', 'Talento Humano') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('c5c1d308-6393-57d1-8a6c-869ec95923e7', 'c6df12e5-be61-547b-b476-8bd315244e07', '1251', 'Contabilidad') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('cf27ed3a-e480-5eb8-840f-193c1c0b1e00', 'c6df12e5-be61-547b-b476-8bd315244e07', '1253', 'Crédito y Cartera') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('9ae7ec87-7182-546e-a2fa-f2576667e4ba', 'c6df12e5-be61-547b-b476-8bd315244e07', '1252', 'Tesorería') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('2bf99808-00fe-574c-896f-088d2c2b8686', '99a2f096-5665-555b-8904-df6af9f93c52', '1260', 'Gestión de TIC') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('0625cdbf-fbf8-503d-b3c8-593b6cb12e35', '01abdc65-1a5b-5e01-aac8-e5e57dbbe3c2', '1270', 'Gestión documental') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('888eaada-08b0-5a6b-bdf9-3c7df8702920', '54357430-b487-523e-b6a2-05d2560e32c1', '1300', 'Formacion - Vicerrectoría Académica') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('6568f4a1-9e0a-5e14-89eb-d2930ce9d119', '54357430-b487-523e-b6a2-05d2560e32c1', '1311', 'Formacion - Direcciones de Unidad:
-Agronomía, Veterinaria y Afines
-Económicas, Administrativas y Contables
-Ingenierías, Arquitectura, Urbanismo y Afines') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('0cd33941-5d37-5593-b17f-27c487e45ae8', '54357430-b487-523e-b6a2-05d2560e32c1', '1313', 'Dirección Unidad Económicas, Administrativas y Contables') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('46adc54b-afc6-5cb6-87bb-ac105f84d8ae', '54357430-b487-523e-b6a2-05d2560e32c1', '1316', 'Dirección Unidad de Ingenierías, Arquitectura, Urbanismo y Afines') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('3d787b15-bb44-5d5a-a264-639742b90568', '54357430-b487-523e-b6a2-05d2560e32c1', '1314', 'Formacion - CEAD') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('a883e337-094a-5f1d-a976-41aee794fb71', '54357430-b487-523e-b6a2-05d2560e32c1', '1317', 'Formacion - CETDH') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('9023d173-88f0-5ad2-83d4-cadd3f60baf3', '018c88da-962e-58f6-ab40-df0a48b060a9', '1320', 'Investigación') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('d6baebc3-1268-5458-8391-a5ad91602974', 'ea08162f-89f1-58b0-9565-27972753d2c1', '1330', 'Bienestar institucional') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('7601fe66-dd43-5175-ace8-d96dd377596a', '8c22b2f9-a997-5be9-b78a-0c6f9dee1160', '1340', 'Relación con el sector externo') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('4590d38f-e784-52b8-8e12-2098cd56fca7', '54357430-b487-523e-b6a2-05d2560e32c1', '1350', 'Formacion - Registro y control académico') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('a50bd321-b7b5-503b-9cd7-22a1fd2e840c', '9a5d44ad-162a-5b35-b3e5-583623f7c0f8', '1360', 'Medios Educativos - Biblioteca') on conflict (codigo) do nothing;
insert into public.oficinas_productoras (id, proceso_id, codigo, nombre) values ('93ddfc3c-0f63-5d63-912b-c1128e23c4be', '9a5d44ad-162a-5b35-b3e5-583623f7c0f8', '1370', 'Medios Educativos - Laboratorios') on conflict (codigo) do nothing;

-- Series documentales
insert into public.series (id, oficina_id, cod_serie, nombre) values ('7c49bc1d-70e9-5e9a-b905-46f8b477415b', 'd9c11af4-ab4a-5984-9795-58a1943c6a12', '1001', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('736f1f4f-659a-5a5e-ab84-15aef6db0b58', 'd9c11af4-ab4a-5984-9795-58a1943c6a12', '1001', 'ACTOS ADMINISTRATIVOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('d57404ff-0ecc-5789-af3c-cdb5debb66fa', 'd9c11af4-ab4a-5984-9795-58a1943c6a12', '1001', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('24dc7864-f1be-59bc-8fb6-d71110bb88ce', 'd9c11af4-ab4a-5984-9795-58a1943c6a12', '1001', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('e308e5b7-97b3-5498-8bf9-3853b28cffaa', 'a2961400-2974-5902-a693-aec6aca0bb98', '1110', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('2aace40f-f669-58e1-b4be-e0295acf6cae', 'a2961400-2974-5902-a693-aec6aca0bb98', '1110', 'ACTOS ADMINISTRATIVOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('d02da641-e63e-5bf4-9227-e129e291acc5', 'a2961400-2974-5902-a693-aec6aca0bb98', '1110', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('00fc1956-79b0-5af1-b00c-6872890c440c', 'a2961400-2974-5902-a693-aec6aca0bb98', '1001', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('cc6079c8-d0aa-55a3-9af4-ac9658ddeb08', 'a2961400-2974-5902-a693-aec6aca0bb98', '1110', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('981b5440-b8ae-5526-8d50-6901322b4c07', 'b99d3a29-f0e2-5bb5-925e-b81141dab901', '1100', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('966185d5-0a0a-51bb-a58d-d3bc20530fd4', 'b99d3a29-f0e2-5bb5-925e-b81141dab901', '1100', 'ACTOS ADMINISTRATIVOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('b0f7f0d7-6001-58e3-838a-968ea631bf70', 'b99d3a29-f0e2-5bb5-925e-b81141dab901', '1100', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('418f8fde-756e-5963-bd55-e6e2d0b95d16', 'b99d3a29-f0e2-5bb5-925e-b81141dab901', '1100', 'CONVENIOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('4994bdcd-f3cb-5223-93a2-fc6f0da0605c', 'b99d3a29-f0e2-5bb5-925e-b81141dab901', '1100', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('b601bac1-978c-5b3b-8ad0-84e09540e1c7', 'b99d3a29-f0e2-5bb5-925e-b81141dab901', '1100', 'LINEAMIENTOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('48d18ee5-095d-5724-ad83-3a4f175e4f41', 'b99d3a29-f0e2-5bb5-925e-b81141dab901', '1100', 'PLANES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('b4619228-1da9-5cb3-8f32-066fb0c7e990', 'b99d3a29-f0e2-5bb5-925e-b81141dab901', '1100', 'PROYECTOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('745ee985-4f4b-539a-a36e-5016aeb96f03', '96beb166-6c6d-5347-88d3-e33179741221', '1120', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('78bc204a-b6c9-5ef2-83a6-6bec6b2825a4', '96beb166-6c6d-5347-88d3-e33179741221', '1120', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('59f28c14-26f0-5bb6-b241-932d82a5b4e7', 'f7738818-9cf2-5b3f-a417-6459e4188b04', '1210', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('ebdac103-58e6-5472-84bc-2754aa97b6b6', 'f7738818-9cf2-5b3f-a417-6459e4188b04', '1210', 'AUDITORÍAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('1af88fe0-3cee-56df-a7a6-f5ec9bf10cd7', 'f7738818-9cf2-5b3f-a417-6459e4188b04', '1210', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('35a54ff4-3f91-5ce9-890d-e830c0d0a336', 'f7738818-9cf2-5b3f-a417-6459e4188b04', '1210', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('250c1d32-6b08-52fa-a39d-12b66337d970', 'f7738818-9cf2-5b3f-a417-6459e4188b04', '1210', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('a1562e9e-a29a-5bf3-b7b5-6598eee5ae17', '8308c023-b09b-5427-9af4-cc22d2201183', '1220', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('9eafe491-3868-502a-8015-d11a89c569bf', '8308c023-b09b-5427-9af4-cc22d2201183', '1220', 'AUTORIZACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('2ada0f0d-0733-509f-863f-121f3465ec62', '8308c023-b09b-5427-9af4-cc22d2201183', '1220', 'BASES DE DATOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('27205300-183c-56c2-80f4-21ed80fbd5a3', '8308c023-b09b-5427-9af4-cc22d2201183', '1220', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('02bc4f41-8607-5da5-988e-a2a072f9f160', '8308c023-b09b-5427-9af4-cc22d2201183', '1220', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('9d96f5a8-e277-569c-b6d4-84eb0ea9dbe2', '8308c023-b09b-5427-9af4-cc22d2201183', '1220', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('0c485c92-6776-5bbc-b74b-383a4dee56fd', '2d813051-0144-5a34-a56f-b0a1398f1095', '1230', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('79e44eac-88b1-5b0e-b1e3-eedff0ccc66b', '2d813051-0144-5a34-a56f-b0a1398f1095', '1230', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('8bf0b39a-0c90-50fa-b9e6-aa08e555343e', '2d813051-0144-5a34-a56f-b0a1398f1095', '1230', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('c0ad1546-e5d8-59cc-a31b-19cee9151c94', '2d813051-0144-5a34-a56f-b0a1398f1095', '1230', 'PLANES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('edd594cd-5835-5581-81c2-849736e0dc56', '2d813051-0144-5a34-a56f-b0a1398f1095', '1230', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('75988e11-4b66-5af1-876f-abee353235cf', 'e5682a2b-3de3-5f10-a717-5b4a362773f7', '1240', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('628b8e6d-ead9-5cca-8590-8e0f298df107', 'e5682a2b-3de3-5f10-a717-5b4a362773f7', '1240', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('b59db403-695f-5469-8470-feab1346f2de', 'e5682a2b-3de3-5f10-a717-5b4a362773f7', '1240', 'EVALUACIÓN DE DESEMPEÑO') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('e3b22d90-df96-554a-93bc-6b7ac4c4a10e', 'e5682a2b-3de3-5f10-a717-5b4a362773f7', '1240', 'HISTORIAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('29c68a4c-9a6f-55da-b5c5-d39a64c5d2cd', 'e5682a2b-3de3-5f10-a717-5b4a362773f7', '1240', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('b18a227c-7883-5c56-92b4-81e5fb6ce93e', 'e5682a2b-3de3-5f10-a717-5b4a362773f7', '1240', 'PLANES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('bcd1ea44-7220-59ca-80ef-395b3e1f1d51', 'e5682a2b-3de3-5f10-a717-5b4a362773f7', '1240', 'PROCESOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('c2f5b468-eb30-5ea6-9114-4123ab2ebc74', 'e5682a2b-3de3-5f10-a717-5b4a362773f7', '1240', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('b68cd9c1-7b1e-582c-8afa-be6294cab8cc', 'e5682a2b-3de3-5f10-a717-5b4a362773f7', '1240', 'REPORTES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('d22f926d-4e57-5980-83bd-2ebf16cc578b', 'e5682a2b-3de3-5f10-a717-5b4a362773f7', '1240', 'SISTEMAS DE GESTIÓN') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('5d012e1c-d7dc-5147-84cf-24b61eeb9514', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('34518cc5-75ff-5e7b-aea7-992522b674fd', 'cf27ed3a-e480-5eb8-840f-193c1c0b1e00', '1250', 'CARTERA MOROSA Y CASTIGADA') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('09c5c0de-789f-52eb-85f5-f0827d546c6e', '9ae7ec87-7182-546e-a2fa-f2576667e4ba', '1250', 'COMPROBANTES DE PAGO') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('559e3fb3-2f67-5b62-804d-3e1cf217c448', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('88881910-a130-5cb2-9926-61bdb7d7598c', '9ae7ec87-7182-546e-a2fa-f2576667e4ba', '1250', 'CONCILIACIÓN  BANCARIA') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('e4bd6c54-71b3-584c-9cef-11bdf8ed3c9c', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'ESTADOS FINANCIEROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('5f3865c6-1e72-5a57-8c17-e07ba93e8b8f', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'IMPUESTOS
*Industria y comercio
*Predial
*Retención en la fuente
*Declaración de renta') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('292adeef-3429-5900-b16f-a51c452d60ef', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('e6f18fbe-6ec7-5b74-a7db-b1f6a911295f', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'LIBROS OFICIALES
*Libro diario
*Libro de mayor y balances
*Libro de inventarios') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('90186c27-ad61-5121-949f-32fc148caf58', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'MEDIOS MAGNÉTICOS
*Información exógena, tributaria e industria y comercio') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('1dce258b-ba9b-5f3e-821f-a52c554777bc', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'MOVIMIENTO CONTABLE
*Ajustes contables
*Comprobantes de egreso
*Notas contables
*Documento soporte
*Facturas de compra
*Recibos de caja menor') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('784e9e94-8047-5420-9e49-0ca8d4a611af', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'NÓMINA') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('d551f740-31b4-5acb-8daa-6d15d5cbe049', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'PRESUPUESTO GENERAL') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('cb8dd1a9-623f-5e02-8487-be9c86f322f0', '9ae7ec87-7182-546e-a2fa-f2576667e4ba', '1250', 'RECIBOS DE CAJA') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('73d9bcfc-9e47-525d-a1f5-6c474a68f30b', 'cf27ed3a-e480-5eb8-840f-193c1c0b1e00', '1250', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('7782d67a-1b8a-51d5-827f-f08cbec8c66b', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', '1250', 'SEGURIDAD SOCIAL') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('95bce969-71b5-5c05-818c-3ee17dbc89c8', '2bf99808-00fe-574c-896f-088d2c2b8686', '1260', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('5b840405-dfa9-5970-86b0-ec52466e5fa3', '2bf99808-00fe-574c-896f-088d2c2b8686', '1260', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('db228884-8104-5249-b881-fc5d236bfeea', '2bf99808-00fe-574c-896f-088d2c2b8686', '1260', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('5e350915-1515-5086-a966-307d2b3d9b9f', '2bf99808-00fe-574c-896f-088d2c2b8686', '1260', 'PROYECTOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('8cc9fc4c-ea28-55f3-99a4-f70f0ad9c440', '2bf99808-00fe-574c-896f-088d2c2b8686', '1260', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('ee3bea18-03bd-5fd0-afe7-875d05e0e63f', '0625cdbf-fbf8-503d-b3c8-593b6cb12e35', '1270', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('ccb770d5-971c-5c31-a75b-21a8c609cb03', '0625cdbf-fbf8-503d-b3c8-593b6cb12e35', '1270', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('96c8d358-3587-5b01-8345-5c7c103799cc', '0625cdbf-fbf8-503d-b3c8-593b6cb12e35', '1270', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('f05ff870-440d-5f33-8a5a-e01a30f45601', '0625cdbf-fbf8-503d-b3c8-593b6cb12e35', '1270', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('bb05b536-cfc0-55cb-aeb5-eaf2146ca9f2', '888eaada-08b0-5a6b-bdf9-3c7df8702920', '1300', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('bdf2b1d1-149e-5ee9-9902-097138dff1dd', '888eaada-08b0-5a6b-bdf9-3c7df8702920', '1300', 'ACTOS ADMINISTRATIVOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('3d4b34aa-a633-5fd3-af8e-8c23a1825fe1', '888eaada-08b0-5a6b-bdf9-3c7df8702920', '1300', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('7e688411-5e7b-5111-96dc-bb09a02adb7c', '888eaada-08b0-5a6b-bdf9-3c7df8702920', '1300', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('e92b602d-c1bb-58bc-b3f3-1e9fdc0a3b0d', '888eaada-08b0-5a6b-bdf9-3c7df8702920', '1300', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('f3821bee-0d3b-580b-846c-181e4b89c911', '6568f4a1-9e0a-5e14-89eb-d2930ce9d119', '1311', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('372198b0-f274-52cd-91a7-a54a7835fc0e', '6568f4a1-9e0a-5e14-89eb-d2930ce9d119', '1311', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('ca8aef79-03d6-5e3f-985a-7f904fef0afe', '6568f4a1-9e0a-5e14-89eb-d2930ce9d119', '1311', 'MODALIDADES DE GRADO') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('f71d6096-fb02-5710-81e5-d21a697d6b89', '0cd33941-5d37-5593-b17f-27c487e45ae8', '1313', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('26040bde-487d-5f22-b8f5-94dcc5fe9402', '0cd33941-5d37-5593-b17f-27c487e45ae8', '1313', 'MODALIDADES DE GRADO') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('ec761f14-b9db-597e-a2eb-929edba3d947', '46adc54b-afc6-5cb6-87bb-ac105f84d8ae', '1316', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('a611a2ae-6896-507b-bedf-5a02be9e3b43', '46adc54b-afc6-5cb6-87bb-ac105f84d8ae', '1316', 'MODALIDADES DE GRADO') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('5432ba53-32c0-5c99-bea8-9c53724f2a65', '3d787b15-bb44-5d5a-a264-639742b90568', '1314', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('b207355f-9876-5fac-b5df-ad0b80804b77', '3d787b15-bb44-5d5a-a264-639742b90568', '1314', 'CONVENIOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('8513013d-a558-51c1-aad2-faf0595beecc', '3d787b15-bb44-5d5a-a264-639742b90568', '1314', 'MODALIDADES DE GRADO') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('01aa115a-1893-5fee-bc26-1e704bfa428c', 'a883e337-094a-5f1d-a976-41aee794fb71', '1317', 'CALIFICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('2be1b5c2-a993-5878-bf01-f911bdf202b2', 'a883e337-094a-5f1d-a976-41aee794fb71', '1317', 'HISTORIAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('5928f333-d223-583f-aa94-3c21f0a9973e', '9023d173-88f0-5ad2-83d4-cadd3f60baf3', '1320', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('de8021e0-efa2-55df-8526-6db1588dc3c0', '9023d173-88f0-5ad2-83d4-cadd3f60baf3', '1320', 'CAPACITACIONES
*Informe capacitaciones
*Asistencia') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('116e6357-585e-5d69-a48e-cdef91354828', '9023d173-88f0-5ad2-83d4-cadd3f60baf3', '1320', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('38f05492-5339-5d3c-853e-dad831d8ebfd', '9023d173-88f0-5ad2-83d4-cadd3f60baf3', '1320', 'EVENTOS
*Informe
*Asistencia') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('acfb1f92-93c4-56ee-8f92-7ffe5ab641ec', '9023d173-88f0-5ad2-83d4-cadd3f60baf3', '1320', 'GRUPOS DE INVESTIGACIÓN
*Inscripción grupo de investigación
*Inscripción integrantes grupo de investigación
*Actas') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('64960b42-61d3-576d-8bd6-d4eb9e1e8402', '9023d173-88f0-5ad2-83d4-cadd3f60baf3', '1320', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('443b16f1-b092-505f-b7ae-68e2775150c8', '9023d173-88f0-5ad2-83d4-cadd3f60baf3', '1320', 'PROGRAMAS Y PROYECTOS
*Plan de trabajo
*Actas de reunión
*Comunicaciones') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('2bc4e73d-06ab-5f0f-9c3d-3c248d288d31', '9023d173-88f0-5ad2-83d4-cadd3f60baf3', '1320', 'REDES DE APOYO
*Informes') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('4629c126-fcfb-5251-8f3d-006259032d65', '9023d173-88f0-5ad2-83d4-cadd3f60baf3', '1320', 'SEMILLEROS DE INVESTIGACIÓN
*Asistencia convocatoria
*Inscripción semillero
*Inscripción integrante
*Actas
*Certificados participación encuentros') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('e0aba796-3582-5aba-ae08-b835d0565b49', '9023d173-88f0-5ad2-83d4-cadd3f60baf3', '1320', 'UNIDAD DE INNOVACIÓN Y DESARROLLO
*Actas de inicio y finalización
*Lista de verificación
*Actas de reunión y asesorías
*Planes') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('cbfd29c1-09d1-5335-9a46-eec7266f7c81', 'd6baebc3-1268-5458-8391-a5ad91602974', '1330', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('8ef868b4-e0fb-5b20-b273-f6ce220c517b', 'd6baebc3-1268-5458-8391-a5ad91602974', '1330', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('bc5e0c1a-3ecf-51b8-9e40-a18e482747cc', 'd6baebc3-1268-5458-8391-a5ad91602974', '1330', 'CONVENIOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('a4db15b8-8fa8-50f7-bce5-d48a8454bab6', 'd6baebc3-1268-5458-8391-a5ad91602974', '1330', 'ESTADÍSTICAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('63cbfa19-ee9e-5f25-8c5c-584b720227e7', 'd6baebc3-1268-5458-8391-a5ad91602974', '1330', 'HISTORIAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('d2e6708c-c8d7-511f-8177-a4a626a78831', 'd6baebc3-1268-5458-8391-a5ad91602974', '1330', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('5be0cbb6-80c0-5e46-b1d9-c77f70b65a58', '7601fe66-dd43-5175-ace8-d96dd377596a', '1340', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('b225292f-d3d2-5983-a4a1-c31f4596259c', '7601fe66-dd43-5175-ace8-d96dd377596a', '1340', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('393e619e-7d86-5b79-aaab-babbf3a749da', '7601fe66-dd43-5175-ace8-d96dd377596a', '1340', 'CONVENIOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('c13bcbf9-e434-5840-bd45-fc8525e247f5', '7601fe66-dd43-5175-ace8-d96dd377596a', '1340', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('9b9a97ff-7363-5f4e-8ba5-e1b22da249d3', '7601fe66-dd43-5175-ace8-d96dd377596a', '1340', 'PROYECTOS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('ac6cc6f0-89e0-5249-8942-26d2c1ed26af', '7601fe66-dd43-5175-ace8-d96dd377596a', '1340', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('2f02193d-1dd2-5efa-8756-66d26d52f68c', '4590d38f-e784-52b8-8e12-2098cd56fca7', '1350', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('036b8370-9f5a-5fb9-8e54-6270639a728f', '4590d38f-e784-52b8-8e12-2098cd56fca7', '1350', 'Estado de estudiantes por periodo académico.') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('39b2a290-a2e6-5c08-a5cf-ba9e92953e4b', '4590d38f-e784-52b8-8e12-2098cd56fca7', '1350', 'Exámenes opcionales') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('44d35a5a-ebbf-505d-baa4-f871a859fdfe', '4590d38f-e784-52b8-8e12-2098cd56fca7', '1350', 'Habilitaciones') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('04b84290-6e2e-506b-b216-f79d17d11112', '4590d38f-e784-52b8-8e12-2098cd56fca7', '1350', 'Inscripciones') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('260bfc3e-d11a-5241-867b-a1d1b0665cb8', '4590d38f-e784-52b8-8e12-2098cd56fca7', '1350', 'Seguimiento trámites académicos') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('d108501c-8682-5656-84e8-9cac20956119', '4590d38f-e784-52b8-8e12-2098cd56fca7', '1350', 'CORRECCIONES DE NOTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('bb36ae00-2a81-5010-b093-eb4e410e1a26', '4590d38f-e784-52b8-8e12-2098cd56fca7', '1350', 'FICHAS DE DESERCIÓN') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('298a4b1a-1e15-5319-9016-582057737bb8', '4590d38f-e784-52b8-8e12-2098cd56fca7', '1350', 'HISTORIAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('14ccc4e0-97f7-5bd2-850d-5a0307c897bd', '4590d38f-e784-52b8-8e12-2098cd56fca7', '1350', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('38c457cc-0626-5410-97b5-66aa4553796a', 'a50bd321-b7b5-503b-9cd7-22a1fd2e840c', '1360', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('47ac32c3-8f08-5982-ba68-0ef39421da8e', 'a50bd321-b7b5-503b-9cd7-22a1fd2e840c', '1360', 'ESTADÍSTICAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('bbbba396-3021-578c-b909-487d9c6b1226', 'a50bd321-b7b5-503b-9cd7-22a1fd2e840c', '1360', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('34fd6143-20ae-544a-b928-6023937fee3a', 'a50bd321-b7b5-503b-9cd7-22a1fd2e840c', '1360', 'REGISTROS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('e362b507-d643-51df-be83-d74e8918510b', '93ddfc3c-0f63-5d63-912b-c1128e23c4be', '1370', 'ACTAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('c229996d-c132-5b12-9cff-b96ac36bdee1', '93ddfc3c-0f63-5d63-912b-c1128e23c4be', '1370', 'COMUNICACIONES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('1e1cb9de-7c79-5f4d-8042-2760b9950c0e', '93ddfc3c-0f63-5d63-912b-c1128e23c4be', '1370', 'ESTADÍSTICAS') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('e8290502-68b9-54d8-8773-5b023f4d3c71', '93ddfc3c-0f63-5d63-912b-c1128e23c4be', '1370', 'INFORMES') on conflict (id) do nothing;
insert into public.series (id, oficina_id, cod_serie, nombre) values ('c037f5b6-365c-5062-9524-26a0995e3074', '93ddfc3c-0f63-5d63-912b-c1128e23c4be', '1370', 'REGISTROS') on conflict (id) do nothing;

-- Subseries / tipos documentales
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b9966417-cfac-5f84-8ced-c6dd9936acbb', '7c49bc1d-70e9-5e9a-b905-46f8b477415b', 'Actas comité de presupuesto', true, false, '5 años', '10 años', true, false, false, true, 'Cumplido el tiempo de retención se conserva la serie totalmente por poseer valores secundarios para la Institución.', 1) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('5da8b085-18e1-5787-a4a3-4bbdf8d39986', '7c49bc1d-70e9-5e9a-b905-46f8b477415b', 'Actas de asamblea general', true, false, '5 años', '10 años', true, false, false, true, NULL, 2) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f498d32c-36da-5876-990c-a3f1cc276ec8', '7c49bc1d-70e9-5e9a-b905-46f8b477415b', 'Actas de consejo directivo', true, false, '5 años', '10 años', true, false, false, true, NULL, 3) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f0b7dfc0-ee12-5dce-a885-251dc90b5f4b', '736f1f4f-659a-5a5e-ab84-15aef6db0b58', 'Acuerdos consejo directivo', true, false, '5 años', '10 años', true, false, false, true, 'Cumplido el tiempo de retención se conserva la serie totalmente por poseer valores secundarios para la Institución.', 4) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('97a20979-733d-5f64-ab1f-41a82c311cda', 'd57404ff-0ecc-5789-af3c-cdb5debb66fa', 'Comunicaciones internas', true, false, '1 año', '1 año', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 5) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('7798227a-41a4-5c8e-bbb9-019f880d85f9', 'd57404ff-0ecc-5789-af3c-cdb5debb66fa', 'Comunicaciones externas', true, false, '1 año', '1 año', false, false, true, false, NULL, 6) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('c77f4ffd-bf5f-5107-bcd6-ae9090a26377', '24dc7864-f1be-59bc-8fb6-d71110bb88ce', 'Informe de actividades', true, false, '1 año', '5 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 7) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('d243c0d0-dfd3-595d-8d4a-4b0c11fd54af', 'e308e5b7-97b3-5498-8bf9-3853b28cffaa', 'Actas comité de presupuesto', true, false, '5 años', '10 años', true, false, false, true, 'Cumplido el tiempo de retención se conserva la serie totalmente por poseer valores secundarios para la Institución.', 8) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('8120339f-2c82-552f-af31-6d385c39506c', 'e308e5b7-97b3-5498-8bf9-3853b28cffaa', 'Actas de asamblea general', true, false, '5 años', '10 años', true, false, false, true, NULL, 9) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('6be68ca6-455a-5b00-86bb-357114c0243c', 'e308e5b7-97b3-5498-8bf9-3853b28cffaa', 'Actas de consejo directivo', true, false, '5 años', '10 años', true, false, false, true, NULL, 10) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('a0d8857a-fba0-5a0a-a8ce-a2bc31cdd6de', '2aace40f-f669-58e1-b4be-e0295acf6cae', 'Acuerdos consejo directivo', true, false, '5 años', '10 años', true, false, false, true, 'Cumplido el tiempo de retención se conserva la serie totalmente por poseer valores secundarios para la Institución.', 11) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('1a8ed631-4c9e-51ee-8d1b-92d2e61ec620', 'd02da641-e63e-5bf4-9227-e129e291acc5', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 12) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('126329bb-8af5-5130-a20a-2c0262f2a4e7', 'd02da641-e63e-5bf4-9227-e129e291acc5', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 13) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('df64d2a2-84c7-57f5-82f0-62bbcb53f2f2', '00fc1956-79b0-5af1-b00c-6872890c440c', 'Informe de actividades', true, false, '1 año', '5 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 14) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('2064d5b5-0d1c-543d-9af0-ba1a45039a82', 'cc6079c8-d0aa-55a3-9af4-ac9658ddeb08', 'Registro de diplomas', true, false, '50 años', '25 años', true, false, false, true, 'Cumplido el tiempo de retención se conserva la serie totalmente por poseer valores secundarios para la Institución.', 15) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('8dd4be05-19fc-5a2e-8a96-b4f15cf69e67', '981b5440-b8ae-5526-8d50-6901322b4c07', 'Actas de reuniones', true, false, '2 años', '5 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 16) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f7774926-0abc-5dd2-96c8-6ff03efd87c6', '966185d5-0a0a-51bb-a58d-d3bc20530fd4', 'Resoluciones', true, true, '3 años', '10 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 17) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('44549f10-7d60-5153-8980-e25071908af4', 'b0f7f0d7-6001-58e3-838a-968ea631bf70', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 18) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('18af717e-67ff-5752-8b83-1b37ad4f8166', 'b0f7f0d7-6001-58e3-838a-968ea631bf70', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 19) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('06959804-ef65-59a7-a6ec-5828b7e88a79', '418f8fde-756e-5963-bd55-e6e2d0b95d16', 'Convenio específico', true, false, '5 años', '5 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 20) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('75780006-a566-598b-ae29-8c945571c4ed', '418f8fde-756e-5963-bd55-e6e2d0b95d16', 'Convenio marco', true, false, '5 años', '5 años', false, true, false, false, NULL, 21) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('aee1eaaa-f902-51bd-9c15-e7677102a7e0', '4994bdcd-f3cb-5223-93a2-fc6f0da0605c', 'Informes de comisión', true, false, '1 año', '2 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 22) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('55f21f49-1f8a-51be-ae95-6f1c24a5bded', '4994bdcd-f3cb-5223-93a2-fc6f0da0605c', 'Informes de gestión', true, true, '1 año', '20 años', false, true, false, false, NULL, 23) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('e2a20cd9-bc4f-5a56-b460-157e86e2c1fa', 'b601bac1-978c-5b3b-8ad0-84e09540e1c7', 'Lineamientos institucionales', false, true, '15 años', '5 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 24) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('4712ac25-455f-5a4c-a003-16e53d5591cf', '48d18ee5-095d-5724-ad83-3a4f175e4f41', 'Plan de inversión', true, false, '10 años', '2 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 25) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b0bd41c2-8632-53dc-bdc0-d24b9186af1c', '48d18ee5-095d-5724-ad83-3a4f175e4f41', 'Planes de acción', true, false, '10 años', '2 años', false, true, false, false, NULL, 26) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('5fdd2a00-35f1-5174-ac99-a620c0ae7d83', '48d18ee5-095d-5724-ad83-3a4f175e4f41', 'Planes operativos', true, false, '10 años', '1 año', false, true, false, false, NULL, 27) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('964e0aac-9215-5bac-a036-b33e8bab428f', 'b4619228-1da9-5cb3-8f32-066fb0c7e990', 'Proyectos institucionales', true, false, '1 año', '5 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 28) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b17c926a-d5be-5c1f-8d3e-174cee023945', '745ee985-4f4b-539a-a36e-5016aeb96f03', 'Comunicaciones internas', true, false, NULL, NULL, false, false, false, false, NULL, 29) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('e02f8b6a-39a6-5ced-9cef-11051abd16a1', '745ee985-4f4b-539a-a36e-5016aeb96f03', 'Comunicaciones externas', true, false, NULL, NULL, false, false, false, false, NULL, 30) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('50b2e507-67f7-58a8-90f7-56c3d4eb0775', '78bc204a-b6c9-5ef2-83a6-6bec6b2825a4', 'Registro controles de correspondencia', true, false, NULL, NULL, false, false, false, false, NULL, 31) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('2ec79d54-1358-5dd3-b738-5be2aefa4d2e', '59f28c14-26f0-5bb6-b241-932d82a5b4e7', 'Actas comité de calidad institucional', true, true, '2 años', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 32) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('917030ea-937b-5364-9537-ff1a89adfacb', '59f28c14-26f0-5bb6-b241-932d82a5b4e7', 'Actas de gestión del riesgo', true, true, '1 año', '3 años', false, true, false, false, NULL, 33) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('cf13cbd6-3a56-5ce7-a119-3e04465b8b76', '59f28c14-26f0-5bb6-b241-932d82a5b4e7', 'Actas de evaluación y reevaluación de proveedores', true, true, '2 años', '3 años', false, true, false, false, NULL, 34) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('105d0933-a60d-58bf-b777-013093f7584e', 'ebdac103-58e6-5472-84bc-2754aa97b6b6', 'Auditoría interna
*Plan de auditoría interna
*Programa de auditoría interna
*Informes de auditoría interna', true, true, '1 año', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 35) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('00ca88c5-fcfb-58df-a135-5f8f5f99f1b2', '1af88fe0-3cee-56df-a7a6-f5ec9bf10cd7', 'Comunicaciones internas', true, true, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 36) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('d69c1960-2a48-5279-b45a-6e438e642e20', '1af88fe0-3cee-56df-a7a6-f5ec9bf10cd7', 'Comunicaciones externas', true, true, '1 año', '2 años', false, false, true, false, NULL, 37) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('43e4d6b1-6b80-5a0e-a233-c9092e775132', '35a54ff4-3f91-5ce9-890d-e830c0d0a336', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 38) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('21347fe9-ee2c-5622-abcd-c62f0200e8a2', '250c1d32-6b08-52fa-a39d-12b66337d970', 'Brigada de calidad', true, true, '1 año', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 39) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('6f5f082d-9de0-5013-ad26-50f91f5e704d', '250c1d32-6b08-52fa-a39d-12b66337d970', 'Registro revisión de buzones de sugerencia
*Formulario de "Registro SQR"', true, false, '1 año', '3 años', false, true, false, false, NULL, 40) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('8a639497-309d-55b2-b253-422523ce884a', '250c1d32-6b08-52fa-a39d-12b66337d970', 'Registro revisión por la dirección', true, false, '2 años', '3 años', false, true, false, false, NULL, 41) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('69c6e785-364b-500d-bd71-678c68f6b265', '250c1d32-6b08-52fa-a39d-12b66337d970', 'Registro SQR', true, false, '1 año', '3 años', false, true, false, false, NULL, 42) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('7fca649c-fca0-5cb7-8fb0-859d6fc4a950', 'a1562e9e-a29a-5bf3-b7b5-6598eee5ae17', 'Actas de reuniones', true, false, '1 año', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 43) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('cbc79618-a8c0-57e8-a3b7-119fd198ce11', '9eafe491-3868-502a-8015-d11a89c569bf', 'Autorización uso de imagen', true, false, '5 años', '15 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 44) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('a521bd31-8c27-5f04-9cac-95c87423ca48', '2ada0f0d-0733-509f-863f-121f3465ec62', 'Bases de datos de aspirantes o de interesados en programas académicos', false, true, '2 años', '1 año', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 45) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('45c08b2c-f127-5441-bb17-365d1dd3ee73', '27205300-183c-56c2-80f4-21ed80fbd5a3', 'Circular informativa', true, false, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 46) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('7a027371-c0ea-58f7-8b7d-9a595f5de7b9', '27205300-183c-56c2-80f4-21ed80fbd5a3', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 47) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('5b49e7e2-9114-5903-a252-75a84473ecce', '27205300-183c-56c2-80f4-21ed80fbd5a3', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 48) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('e020a8d1-5aa9-5310-94a6-a1bb5972e0f8', '02bc4f41-8607-5da5-988e-a2a072f9f160', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 49) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('5f47917d-383a-5cc7-baea-86d0d3ab44cb', '02bc4f41-8607-5da5-988e-a2a072f9f160', 'Informe de investigación de mercados', true, false, '3 años', '7 años', false, true, false, false, NULL, 50) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('9ade265b-7b6d-5fc9-bc5a-4e7b969cf495', '9d96f5a8-e277-569c-b6d4-84eb0ea9dbe2', 'Asistencia a eventos', true, false, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 51) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('12505d80-7a18-56ae-946e-b715d27de3c8', '9d96f5a8-e277-569c-b6d4-84eb0ea9dbe2', 'Lista de chequeo para aprobación de medios y elementos publicitarios', true, false, '1 año', '1 año', false, true, false, false, NULL, 52) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('100af92b-f821-5947-9b9d-640a8908b7a9', '9d96f5a8-e277-569c-b6d4-84eb0ea9dbe2', 'Solicitud de servicio', true, false, '1 año', '1 año', false, true, false, false, NULL, 53) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('7f6d18cb-8d0f-5e83-9746-713a33eb9896', '0c485c92-6776-5bbc-b74b-383a4dee56fd', 'Actas de reuniones', true, false, '1 año', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 54) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('ccaf98d0-da10-527b-9d3e-c13469b29fbc', '79e44eac-88b1-5b0e-b1e3-eedff0ccc66b', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 55) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b239cd73-73c6-52a5-aaa3-3891e6a9b7b6', '79e44eac-88b1-5b0e-b1e3-eedff0ccc66b', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 56) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('e62eb6c3-9367-5408-80cf-0f483851d23f', '8bf0b39a-0c90-50fa-b9e6-aa08e555343e', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 57) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('a1af30ff-f9a2-5e2f-a32d-14f493b1c214', 'c0ad1546-e5d8-59cc-a31b-19cee9151c94', 'Plan de mantenimiento, reparación y construcción', false, true, '7 años', '1 año', false, false, true, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 58) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f24d9ac2-2e3a-5646-bf6c-dd5410bcdbcb', 'edd594cd-5835-5581-81c2-849736e0dc56', 'Acta entrega de inventario', true, false, '1 año', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 59) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('228c1a8e-772d-5295-8cb3-9cc7be841f2b', 'edd594cd-5835-5581-81c2-849736e0dc56', 'Acta retiro de inventario', true, false, '1 año', '3 años', false, true, false, false, NULL, 60) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('3d8703f7-ef9c-58c5-87b2-248b6a6f6af1', 'edd594cd-5835-5581-81c2-849736e0dc56', 'Baja de equipos y partes', true, false, '1 año', '3 años', false, true, false, false, NULL, 61) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('6ab80a46-509e-5bc1-8253-1bdddb0f75d8', 'edd594cd-5835-5581-81c2-849736e0dc56', 'Ficha de Inscripción de Proveedores', true, false, '1 año', '3 años', false, true, false, false, NULL, 62) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('7672a739-8df6-5036-9e47-d644a9cde358', 'edd594cd-5835-5581-81c2-849736e0dc56', 'Sostenimiento planta física y mobiliario verificación condiciones físicas', true, false, '1 año', '1 año', false, true, false, false, NULL, 63) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('78048b94-f86a-5e0f-881f-0e85f7cb378a', '75988e11-4b66-5af1-876f-abee353235cf', 'Actas de comité de convivencia laboral', true, false, '5 años', '5 años', true, false, false, true, 'Cumplido el tiempo de retención se conserva la serie totalmente por poseer valores secundarios para la Institución.', 64) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('0c92f916-4907-5dcf-98cf-ccba59331c60', '75988e11-4b66-5af1-876f-abee353235cf', 'Actas de comité paritario de seguridad y salud en el trabajo', true, false, '5 años', '5 años', true, false, false, true, NULL, 65) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('2bd388b6-c752-5141-af99-ef170c4e7fb0', '75988e11-4b66-5af1-876f-abee353235cf', 'Actas de reuniones', true, false, '2 años', '3 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 66) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('861cd8d0-b321-5a9e-8327-fad3b0d4121d', '628b8e6d-ead9-5cca-8590-8e0f298df107', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 67) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b187e25a-5072-5668-8a23-a786e80da2d8', '628b8e6d-ead9-5cca-8590-8e0f298df107', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 68) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('544daf63-0104-5955-80e6-a30dbaee02b2', 'b59db403-695f-5469-8470-feab1346f2de', NULL, true, true, '2 años', '78 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 69) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('fc58469c-f4c8-5dca-8287-7e0892d679c6', 'e3b22d90-df96-554a-93bc-6b7ac4c4a10e', 'Historias de aprendíz SENA', true, true, '2 años', '78 años', false, false, true, false, 'Cumplido el tiempo de retención en el archivo de gestión, se seleccionan las historias laborales que ya no se encuentran activas y se realiza transferencia al archivo central para su conservación en el tiempo establecido. 
Nota: Durante la etapa de archivo de gestión los documentos son digitalizados.', 70) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('38bbc09a-aa80-5def-b076-1335f0074b33', 'e3b22d90-df96-554a-93bc-6b7ac4c4a10e', 'Historias laborales personal docente', true, true, '2 años', '78 años', false, false, true, false, NULL, 71) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('53bd6057-c09a-5546-a642-bbce01208f3e', 'e3b22d90-df96-554a-93bc-6b7ac4c4a10e', 'Historias laborales personal de planta', true, true, '2 años', '78 años', false, false, true, false, NULL, 72) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('4d78c51c-b505-513a-bb33-6806b6e7022b', 'e3b22d90-df96-554a-93bc-6b7ac4c4a10e', 'Historia ocupacional', true, true, '2 años', '78 años', false, false, true, false, NULL, 73) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('07f3b09e-c54f-5d2d-9b1c-86bc01f88fd7', '29c68a4c-9a6f-55da-b5c5-d39a64c5d2cd', 'Informes a entes de control', false, true, '2 años', '8 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 74) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('0135bf8f-1ff2-5447-8f83-6e6554ce0082', '29c68a4c-9a6f-55da-b5c5-d39a64c5d2cd', 'Informes de gestión', false, true, '2 años', '8 años', false, false, true, false, NULL, 75) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('6b3bb56d-d2df-51bc-aeb7-ab4f1f7c9275', '29c68a4c-9a6f-55da-b5c5-d39a64c5d2cd', 'Informes de medición de riesgo psicosocial', true, true, '6 años', '4 años', false, true, false, false, NULL, 76) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('d2243edd-fdb6-5f54-9ee5-34be11faef11', 'b18a227c-7883-5c56-92b4-81e5fb6ce93e', 'Plan de beneficios y/o incentivos', true, true, '2 años', '4 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 77) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('3c19f9ac-2b96-5b19-985e-1f30ce84e581', 'b18a227c-7883-5c56-92b4-81e5fb6ce93e', 'Plan de capacitación y/o formación', false, true, '5 años', '5 años', false, true, false, false, NULL, 78) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('15ab68e7-d179-5979-87bc-9bc72443e9ea', 'b18a227c-7883-5c56-92b4-81e5fb6ce93e', 'Plan de emergencias', true, true, '3 años', '1 año', false, true, false, false, NULL, 79) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('81780fbb-f69d-5a3f-9cfa-9df9c77c2d1e', 'b18a227c-7883-5c56-92b4-81e5fb6ce93e', 'Plan estratégico de seguridad vial (PESV)', true, true, '2 años', '8 años', true, false, true, false, 'Cumplido el tiempo de retención se selecciona la tipologia matriz de riesgos, politicas, procesos y procedimientos para su conservación total . 
Estos documentos deben de reposar publicados en el SGC', 80) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('c07ba87e-594d-5c4c-a524-cb1849ab1e42', 'bcd1ea44-7220-59ca-80ef-395b3e1f1d51', 'Procesos de inducción al personal', true, true, '2 años', '18 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 81) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('393c0256-8405-5690-b95a-af78888ad62f', 'bcd1ea44-7220-59ca-80ef-395b3e1f1d51', 'Procesos de selección de personal administrativo / docente', false, true, '1 año', '3 años', false, true, false, false, NULL, 82) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('96ff6a6b-f225-5e73-a9a8-8bc73e5cfdf9', 'c2f5b468-eb30-5ea6-9114-4123ab2ebc74', 'Acta de entrega de dotación', true, false, '2 años', '78 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 83) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('625210c2-60d4-5e88-8475-936833804c68', 'c2f5b468-eb30-5ea6-9114-4123ab2ebc74', 'Acta de entrega individual de elementos de protección personal (EPP)', true, false, '2 años', '18 años', false, false, true, false, NULL, 84) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('83f71c17-b8f0-54e9-a312-39ddf8877306', 'b68cd9c1-7b1e-582c-8afa-be6294cab8cc', 'Reporte de accidente de trabajo', true, true, '2 años', '18 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 85) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('1428b4a3-b971-591e-93b6-77eae6dcf2bc', 'd22f926d-4e57-5980-83bd-2ebf16cc578b', 'Capacitación en SST', true, true, '2 años', '18 años', false, false, true, false, 'Cumplido el tiempo de retención se selecciona la tipologia matriz de riesgos, politicas, procesos y procedimientos para su conservación total . 
Estos documentos deben de reposar publicados en el SGC', 86) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('4cf17dd5-14c1-54e0-9776-6af1da71d629', 'd22f926d-4e57-5980-83bd-2ebf16cc578b', 'Condiciones de salud evaluaciones médicas', true, true, '1 año', '19 años', false, false, true, false, NULL, 87) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b416e0fb-5687-5990-bef6-c2c31a931ecd', 'd22f926d-4e57-5980-83bd-2ebf16cc578b', 'Programas de SST
*Incluye los requisitos mínimos de aplicación para la organización', true, false, '2 años', '18 años', false, false, true, false, NULL, 88) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('10d9b6be-08b9-5d03-bb9a-0b4c2e4a2943', 'd22f926d-4e57-5980-83bd-2ebf16cc578b', 'Sistemas de Gestión de Seguridad y Salud en el Trabajo', true, false, '2 años', '8 años', true, false, true, false, NULL, 89) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('7a519c5d-a537-5154-b148-56bac6b8d1ec', '5d012e1c-d7dc-5147-84cf-24b61eeb9514', 'Actas de reuniones', true, false, '1 año', '5 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 90) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b0378ab0-59fc-5515-985a-88ecfcfff974', '34518cc5-75ff-5e7b-aea7-992522b674fd', NULL, true, false, '5 años', '5 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados
Nota: Historias financieras de estudiantes en mora se conservarán hasta la cancelación de la deuda.', 91) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('eb5f4919-b125-55ed-8169-96dee1763e80', '09c5c0de-789f-52eb-85f5-f0827d546c6e', NULL, true, false, '1 año', '4 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 92) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('a4548e22-0c72-51d1-a77a-b691f8071156', '559e3fb3-2f67-5b62-804d-3e1cf217c448', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 93) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('7e8a5e73-bafa-5fc0-9c0f-c7d65e92773f', '559e3fb3-2f67-5b62-804d-3e1cf217c448', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 94) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('bfce0ad7-35ce-570e-ae20-27bcb08ecbb7', '88881910-a130-5cb2-9926-61bdb7d7598c', NULL, true, false, '1 año', '9 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 95) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('2dfc19d8-ad97-5294-9dc2-5e5ad4e7f8d8', 'e4bd6c54-71b3-584c-9cef-11bdf8ed3c9c', NULL, true, false, '5 años', '15 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 96) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('8110c1fe-45b3-5dc9-9098-edfc9431dc49', '5f3865c6-1e72-5a57-8c17-e07ba93e8b8f', NULL, true, false, '5 años', '15 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 97) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('81a1d5cb-9419-575e-b070-a984e211bd3d', '292adeef-3429-5900-b16f-a51c452d60ef', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 98) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('93e256e4-c748-57cf-983f-cadb686a72eb', 'e6f18fbe-6ec7-5b74-a7db-b1f6a911295f', NULL, true, false, '2 años', '18 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 99) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('3dc2b7e2-3777-5e17-a995-d17b9dfdd95f', '90186c27-ad61-5121-949f-32fc148caf58', NULL, false, true, '2 años', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 100) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('fcf1cb17-83ff-5711-a6d0-230b90f5438a', '1dce258b-ba9b-5f3e-821f-a52c554777bc', NULL, true, false, '1 año', '19 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 101) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('458315da-ed87-5796-a192-2eade3620596', '784e9e94-8047-5420-9e49-0ca8d4a611af', NULL, true, false, '2 años', '58 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 102) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('95258131-c20d-5698-bbe9-68b9ed744924', 'd551f740-31b4-5acb-8daa-6d15d5cbe049', NULL, true, false, '5 años', '7 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 103) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('571927a5-93b1-5948-b530-cc7b5dcf3fea', 'cb8dd1a9-623f-5e02-8487-be9c86f322f0', NULL, true, false, '1 año', '4 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 104) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('9e0b81d3-5ae6-5f66-ab77-b20d66ad14ec', '73d9bcfc-9e47-525d-a1f5-6c474a68f30b', 'Registro cuadre de cartera', true, false, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 105) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('fff6139d-7661-55d1-a0ae-702a651363bf', '7782d67a-1b8a-51d5-827f-f08cbec8c66b', NULL, true, false, '2 años', '58 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 106) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('af95cd26-5eaa-5142-84e0-7d65efef5bfe', '95bce969-71b5-5c05-818c-3ee17dbc89c8', 'Actas de reuniones', true, false, '1 año', '3 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 107) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('dd31063f-1ad5-5ef7-a973-32641dd754a2', '5b840405-dfa9-5970-86b0-ec52466e5fa3', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 108) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('39045329-41c3-503f-8d63-8aa7fa6779e0', '5b840405-dfa9-5970-86b0-ec52466e5fa3', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 109) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b8c799f4-c58b-56d2-99e3-cf6b8dd3eb29', 'db228884-8104-5249-b881-fc5d236bfeea', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 110) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('af2ca66d-c6aa-5e17-8fa4-e1b001b3f66b', 'db228884-8104-5249-b881-fc5d236bfeea', 'Informes técnicos', true, false, '1 año', '3 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 111) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b06c9ab6-144f-5a9a-a2ff-d78e125147a2', '5e350915-1515-5086-a966-307d2b3d9b9f', 'Software', true, false, '1 año', '3 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 112) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('bef58d60-7a8b-5008-96ac-8b5bff668124', '5e350915-1515-5086-a966-307d2b3d9b9f', 'Intraestructura de T.I', true, false, '1 año', '3 años', false, false, true, false, NULL, 113) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('20fb616c-8f1a-59ab-bbc8-aae8bdc46e5c', '8cc9fc4c-ea28-55f3-99a4-f70f0ad9c440', 'Registro derechos de autor', true, true, '5 años', '15 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 114) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('67209c85-2279-5881-8877-feee168dfc15', '8cc9fc4c-ea28-55f3-99a4-f70f0ad9c440', 'Registro desarrollo y/o mejoramiento de software', true, false, '5 años', '1 año', false, false, true, false, NULL, 115) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('73308aeb-961c-561b-9775-95d5970f31c8', '8cc9fc4c-ea28-55f3-99a4-f70f0ad9c440', 'Registro manteniniento de T.I', true, false, '1 año', '1 año', false, false, true, false, NULL, 116) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f6450795-9978-58dd-b9f4-19c5c51c97d7', '8cc9fc4c-ea28-55f3-99a4-f70f0ad9c440', 'Registro soporte de T.I', true, false, '1 año', '1 año', false, false, true, false, NULL, 117) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('3d3f9fc8-dbd0-590d-88fe-c15ec0c330d7', '8cc9fc4c-ea28-55f3-99a4-f70f0ad9c440', 'Registro soporte del software desarrollado', true, false, '1 año', '1 año', false, false, true, false, NULL, 118) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('0b982594-5d98-5da3-97d5-96cd71b5af83', 'ee3bea18-03bd-5fd0-afe7-875d05e0e63f', 'Actas de reuniones', true, false, '1 año', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se conserva la serie totalmente por poseer valores secundarios para la Institución.', 119) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b5ffed28-0644-529d-87ae-bcb1edac9d17', 'ee3bea18-03bd-5fd0-afe7-875d05e0e63f', 'Actas de eliminación de documentos', true, false, '1 año', '5 años', true, false, false, true, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 120) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('ea974643-7199-5814-9a02-274adbd193d0', 'ccb770d5-971c-5c31-a75b-21a8c609cb03', 'Comunicaciones internas', true, false, '1 año', '2 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 121) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('0f5e271f-199f-5e4c-b882-dc4a2d8a00cc', 'ccb770d5-971c-5c31-a75b-21a8c609cb03', 'Comunicaciones externas', true, false, '1 año', '2 años', false, true, false, false, NULL, 122) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('befca3d9-1625-515c-849b-e9d47548118d', '96c8d358-3587-5b01-8345-5c7c103799cc', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 123) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('9f4b31eb-e9c3-513e-99f5-5abc0b538d72', 'f05ff870-440d-5f33-8a5a-e01a30f45601', 'Registro controles de correspondencia', true, false, '1 año', '2 años', false, true, false, false, 'La gestión de este registro, se realiza desde la dependencia de mercadeo.', 124) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('6a2513d2-3792-5ef2-87a7-452373956103', 'f05ff870-440d-5f33-8a5a-e01a30f45601', 'Inventario único documental', true, true, '1 año', '2 años', false, true, false, false, NULL, 125) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f23446ef-039f-5765-88e2-ebc9926266be', 'f05ff870-440d-5f33-8a5a-e01a30f45601', 'Registro de temperatura y humedad relativa en archivos', true, false, '1 año', '2 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 126) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('e7b37ae1-2557-5df7-8e12-e5cc2fa9ac1e', 'f05ff870-440d-5f33-8a5a-e01a30f45601', 'Préstamo y Devolución Documental en Archivos Centrales e Histórico', true, false, '1 año', '2 años', false, true, false, false, NULL, 127) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('77dedd7e-3c31-53b7-b34d-345e10667642', 'bb05b536-cfc0-55cb-aeb5-eaf2146ca9f2', 'Actas de consejo académico', true, false, '3 años', '5 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 128) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('cfc8e47c-fa10-5c65-8bf0-5f30e414b3d9', 'bb05b536-cfc0-55cb-aeb5-eaf2146ca9f2', 'Actas de reuniones', true, false, '1 año', '3 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 129) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('d22c766d-f0ce-5ef6-b498-1951418cb791', 'bdf2b1d1-149e-5ee9-9902-097138dff1dd', 'Acuerdos consejo académico', true, false, '3 años', '10 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 130) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('ac6c5d22-27df-5baf-bc0b-95a56e045199', '3d4b34aa-a633-5fd3-af8e-8c23a1825fe1', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 131) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f68680d4-6fc5-5ced-8fce-6be038034b4c', '3d4b34aa-a633-5fd3-af8e-8c23a1825fe1', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 132) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b5b8e707-5d92-5e2e-981d-23086ef9c845', '7e688411-5e7b-5111-96dc-bb09a02adb7c', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 133) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('06fb0d4e-bf5e-5a26-9592-1fbca240be2d', 'e92b602d-c1bb-58bc-b3f3-1e9fdc0a3b0d', 'Registro acuerdos pedagógicos', true, false, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 134) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('2136f62f-a585-5beb-8cbf-b38c56793a3d', 'e92b602d-c1bb-58bc-b3f3-1e9fdc0a3b0d', 'Registro de asistencia', true, false, '2 años', '2 años', false, true, false, false, NULL, 135) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('ac696921-6c14-58c1-a33c-65a084bcda26', 'f3821bee-0d3b-580b-846c-181e4b89c911', 'Actas de reuniones', true, false, '2 años', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 136) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f9d33daf-1525-5407-b3c3-58036f89eeff', '372198b0-f274-52cd-91a7-a54a7835fc0e', 'Informes de autoevaluación', false, true, '10 años', '10 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 137) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('c956a5ee-3357-51ea-81d9-a435b7b4fbf7', 'ca8aef79-03d6-5e3f-985a-7f904fef0afe', 'Mejoramiento empresarial', true, false, '2 años', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 138) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('03e4679b-cba9-5878-8070-472d94978e71', 'ca8aef79-03d6-5e3f-985a-7f904fef0afe', 'Pasantía', true, false, '2 años', '1 año', false, true, false, false, NULL, 139) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('d6e11f4e-216b-5713-b8ee-f00ee7694eea', 'ca8aef79-03d6-5e3f-985a-7f904fef0afe', 'Plan de negocios', true, false, '2 años', '1 año', false, true, false, false, NULL, 140) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('72ad9500-4c7e-58b1-bbd9-bb15226785c0', 'ca8aef79-03d6-5e3f-985a-7f904fef0afe', 'Trabajo de investigación', true, false, '2 años', '1 año', false, true, false, false, NULL, 141) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('db84beb3-5ea8-5ea7-95f5-d546c58615ad', 'ca8aef79-03d6-5e3f-985a-7f904fef0afe', 'Proyecto integrador', true, false, '2 años', '1 año', false, true, false, false, NULL, 142) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('5885f36d-cc09-5b96-a77e-ddfa2411de9a', 'ca8aef79-03d6-5e3f-985a-7f904fef0afe', 'Recepción opciones de grado', true, false, '2 años', '1 año', false, true, false, false, NULL, 143) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('9e920d79-6141-56d5-b9ad-dcf16d4503eb', 'ca8aef79-03d6-5e3f-985a-7f904fef0afe', 'Seminario de grado', true, false, '2 años', '1 año', false, true, false, false, NULL, 144) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('d43c0f37-43cd-54df-b1ca-523e6d1be54c', 'f71d6096-fb02-5710-81e5-d21a697d6b89', 'Actas de reuniones', true, false, '1 año', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 145) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('63124cf3-11a9-5850-be5c-e3812cbd26d2', '26040bde-487d-5f22-b8f5-94dcc5fe9402', 'Mejoramiento empresarial', true, false, '2 años', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 146) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('74bab676-ca3d-55be-8f3b-237af3cccf32', '26040bde-487d-5f22-b8f5-94dcc5fe9402', 'Pasantía', true, false, '2 años', '3 años', false, true, false, false, NULL, 147) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('4abe7865-239e-5dc9-9288-d81d5a570b5a', '26040bde-487d-5f22-b8f5-94dcc5fe9402', 'Plan de negocios', true, false, '2 años', '3 años', false, true, false, false, NULL, 148) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('9341933b-ef01-506b-ba3d-97e2f1efd526', '26040bde-487d-5f22-b8f5-94dcc5fe9402', 'Proyecto de investigación', true, false, '2 años', '3 años', false, true, false, false, NULL, 149) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('641fb586-0619-51ed-bd73-31ce1e68112e', '26040bde-487d-5f22-b8f5-94dcc5fe9402', 'Recepción opciones de grado', true, false, '2 años', '3 años', false, true, false, false, NULL, 150) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('a87d5508-0793-5d98-b330-f27f0ff27d5d', '26040bde-487d-5f22-b8f5-94dcc5fe9402', 'Seminario de grado', true, false, '2 años', '3 años', false, true, false, false, NULL, 151) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('865c229a-c7f0-5e2e-8936-078b8469cf5e', 'ec761f14-b9db-597e-a2eb-929edba3d947', 'Actas de reuniones', true, false, '1 año', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 152) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('7edf9361-ca3c-5f58-9507-f113a1f77f75', 'a611a2ae-6896-507b-bedf-5a02be9e3b43', 'Mejoramiento empresarial', true, false, '2 años', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 153) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('668c3c52-2d37-532e-98af-34ef6f57078a', 'a611a2ae-6896-507b-bedf-5a02be9e3b43', 'Pasantía', true, false, '2 años', '3 años', false, true, false, false, NULL, 154) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('4065f5bd-5eea-5ed4-95e9-218171084392', 'a611a2ae-6896-507b-bedf-5a02be9e3b43', 'Plan de negocios', true, false, '2 años', '3 años', false, true, false, false, NULL, 155) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('872f6558-ecba-558b-b432-30712c28e716', 'a611a2ae-6896-507b-bedf-5a02be9e3b43', 'Proyecto integrador', true, false, '2 años', '3 años', false, true, false, false, NULL, 156) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('5a550757-d953-5cb1-99ac-2d42329d58f0', 'a611a2ae-6896-507b-bedf-5a02be9e3b43', 'Proyecto de investigación', true, false, '2 años', '3 años', false, true, false, false, NULL, 157) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('19613947-6631-5bc3-8bec-28b579cd4c7c', 'a611a2ae-6896-507b-bedf-5a02be9e3b43', 'Recepción opciones de grado', true, false, '2 años', '3 años', false, true, false, false, NULL, 158) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('873c6309-1cf1-5de7-96f2-0533863c9ac3', 'a611a2ae-6896-507b-bedf-5a02be9e3b43', 'Seminario de grado', true, false, '2 años', '3 años', false, true, false, false, NULL, 159) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('4758c6eb-83e0-5209-986e-11852b5931e4', '5432ba53-32c0-5c99-bea8-9c53724f2a65', 'Actas de reuniones', true, false, '2 años', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 160) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('5dd0e349-34ed-542f-8bd6-119f3699fae3', 'b207355f-9876-5fac-b5df-ad0b80804b77', 'Convenios con IES', true, false, '10 años', '5 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 161) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('fbb66f29-7529-5f89-86ff-27c524750275', '8513013d-a558-51c1-aad2-faf0595beecc', 'Proyecto de grado', true, false, '2 años', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 162) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b141004f-f2df-58ad-aa93-a6df6c91bd5d', '8513013d-a558-51c1-aad2-faf0595beecc', 'Recepción opciones de grado', true, false, '2 años', '1 año', false, true, false, false, NULL, 163) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('a092a653-31e8-52e8-bbfa-e66a5ea4c08e', '8513013d-a558-51c1-aad2-faf0595beecc', 'Seminario de grado', true, false, '2 años', '1 año', false, true, false, false, NULL, 164) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('53079eb4-9315-52dd-ac1f-b081117c69b4', '01aa115a-1893-5fee-bc26-1e704bfa428c', NULL, true, false, '1 año', '5 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 165) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('fbd950cb-2a2e-5d39-a8a8-f4944a4d9384', '2be1b5c2-a993-5878-bf01-f911bdf202b2', 'Historias Académicas CETDH
*Formulario de Inscripción
*Fotocopia del documento de identidad
*Acta de grado de bachiller, copia de diploma de bachiller o Acta de certificado de Educación Básica Secundaria
*Acta práctica etapa productiva
*Matrículas
*Pensum académico
*Tabulados de nota', true, false, '5 años', '80 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 166) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('18079da8-80f1-56ce-8fa4-11963a1ab051', '5928f333-d223-583f-aa94-3c21f0a9973e', 'Actas comité de investigaciones', true, false, '5 años', '3 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 167) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('88ec8722-87fe-5eb3-8ba9-47ce9370044f', '5928f333-d223-583f-aa94-3c21f0a9973e', 'Actas de núcleo de investigación', true, false, '2 años', '3 años', false, false, true, false, NULL, 168) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('0b32abae-e3b4-5fe5-8fbc-e4423d8d8132', '5928f333-d223-583f-aa94-3c21f0a9973e', 'Actas de reuniones', true, false, '2 años', '3 años', false, false, true, false, NULL, 169) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('21f4b4dc-198c-5ed0-8476-1a425d50e5a0', 'de8021e0-efa2-55df-8526-6db1588dc3c0', NULL, true, false, '2 años', '7 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 170) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('5a524abc-0007-598c-a370-59297675f2b2', '116e6357-585e-5d69-a48e-cdef91354828', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 171) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('4d2c92f6-e997-515e-95a4-c98f27180c19', '116e6357-585e-5d69-a48e-cdef91354828', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 172) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f93793b7-fed9-5337-a5c2-8d7d6a37e162', '38f05492-5339-5d3c-853e-dad831d8ebfd', NULL, true, false, '1 año', '7 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 173) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('db8a255e-6997-5e87-a36d-b4a66e89c175', 'acfb1f92-93c4-56ee-8f92-7ffe5ab641ec', NULL, true, false, '7 años', '7 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 174) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('05db4820-279c-544c-b6e4-1d14c670998e', '64960b42-61d3-576d-8bd6-d4eb9e1e8402', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 175) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('747d7e18-1b5c-5c09-ab91-207108841a9b', '443b16f1-b092-505f-b7ae-68e2775150c8', NULL, true, false, '7 años', '7 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 176) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b5d02599-db51-55cf-8123-2d78c1d96324', '2bc4e73d-06ab-5f0f-9c3d-3c248d288d31', NULL, true, false, '2 años', '7 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 177) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('89a588ac-0da6-5d7c-bddc-07cacfa613ac', '4629c126-fcfb-5251-8f3d-006259032d65', NULL, true, false, '7 años', '7 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 178) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('49524afa-651b-5f12-bf76-20d80f3dd0e5', 'e0aba796-3582-5aba-ae08-b835d0565b49', NULL, true, false, '7 años', '7 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 179) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('15e67beb-e4f7-5a8f-a297-c9ee60d0d950', 'cbfd29c1-09d1-5335-9a46-eec7266f7c81', 'Actas comité de becas', true, false, '7 años', '3 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 180) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('c7e7e480-5aca-5478-ae5a-3a3e16775bb4', 'cbfd29c1-09d1-5335-9a46-eec7266f7c81', 'Actas de reuniones', true, false, '7 años', '3 años', false, false, true, false, NULL, 181) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('99012f4b-7534-50ca-b768-0915429c0ad6', '8ef868b4-e0fb-5b20-b273-f6ce220c517b', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 182) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('8e73160f-1370-517b-88ce-516b54c12e6c', '8ef868b4-e0fb-5b20-b273-f6ce220c517b', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 183) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('531bfc69-cf80-5685-9b67-091bdd7dbbe2', 'bc5e0c1a-3ecf-51b8-9e40-a18e482747cc', 'Convenio específico', true, false, '5 años', '1 año', false, false, true, false, 'Cumplido el tiempo de retención en el archivo de gestión, se seleccionan los convenios que ya no se encuentran activos y se realiza transferencia al archivo central para su conservación en el tiempo establecido.', 184) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('3f3ce6c4-06b6-5c0a-9d94-fcd46c6e39d5', 'a4db15b8-8fa8-50f7-bce5-d48a8454bab6', 'Consolidado de estadísticas servicios de bienestar Institucional', false, true, '7 años', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 185) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('9465b033-1dca-5ccb-832e-d6fca3151bcc', '63cbfa19-ee9e-5f25-8c5c-584b720227e7', 'Historias de servicios asistenciales', true, false, '5 años', '15 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 186) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('682a53f8-9952-5e4d-8e0b-0c51937d6071', 'd2e6708c-c8d7-511f-8177-a4a626a78831', 'Informe de actividades', true, true, '7 años', '1 año', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 187) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('a422733a-8faa-5e17-b4fd-9b5726813a0d', 'd2e6708c-c8d7-511f-8177-a4a626a78831', 'Informe de permanencia estudiantil', true, false, '7 años', '1 año', false, false, true, false, NULL, 188) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('8392452b-28c3-57e4-8b8e-53ec8fd6175a', 'd2e6708c-c8d7-511f-8177-a4a626a78831', 'Informe estudios de egresados', false, true, '7 años', '1 año', false, false, true, false, NULL, 189) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('dbedcc09-8e0a-51f3-9090-a9989a6096b6', 'd2e6708c-c8d7-511f-8177-a4a626a78831', 'Informe seguimiento a egresados', false, true, '7 años', '1 año', false, false, true, false, NULL, 190) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('4e24e906-9ff3-5245-b502-76db34f35873', 'd2e6708c-c8d7-511f-8177-a4a626a78831', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 191) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f820e2de-e0ce-5673-a7de-0480b794f213', '5be0cbb6-80c0-5e46-b1d9-c77f70b65a58', 'Actas de reuniones Extensión', true, false, '7 años', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 192) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('82411fea-659a-52b7-8173-696c471774df', '5be0cbb6-80c0-5e46-b1d9-c77f70b65a58', 'Actas de reuniones Internacionalización', true, false, '7 años', '3 años', false, true, false, false, NULL, 193) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('51553376-89c3-54aa-b0d6-40ffcad2c28e', '5be0cbb6-80c0-5e46-b1d9-c77f70b65a58', 'Actas de reuniones Proyección Social', true, false, '7 años', '3 años', false, true, false, false, NULL, 194) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('0c3d50ef-a5ca-5853-a31f-902e09d43f43', 'b225292f-d3d2-5983-a4a1-c31f4596259c', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que serán eliminados', 195) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('76227466-ffaa-5c02-905f-1a74fa07adcf', 'b225292f-d3d2-5983-a4a1-c31f4596259c', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 196) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f04dc42d-6433-5bbf-8aa7-276eabc45376', '393e619e-7d86-5b79-aaab-babbf3a749da', 'Convenio específico', true, false, '5 años', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 197) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('2e012e24-e38e-508b-b283-b870b7ac490e', '393e619e-7d86-5b79-aaab-babbf3a749da', 'Convenio marco', true, false, '5 años', '1 año', false, true, false, false, NULL, 198) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('aad57096-8e31-547d-a300-38f3c9eccef0', 'c13bcbf9-e434-5840-bd45-fc8525e247f5', 'Informe de comisión', false, true, '7 años', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 199) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('734b83c1-0182-530a-a91e-2e5adc54678b', 'c13bcbf9-e434-5840-bd45-fc8525e247f5', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, NULL, 200) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('17841008-0109-5e5d-8375-3f9487def901', '9b9a97ff-7363-5f4e-8ba5-e1b22da249d3', 'Proyectos de extensión universitaria y educación continuada', false, true, '7 años', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 201) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('97ff1413-7166-52a4-a30f-9ed5740c925c', '9b9a97ff-7363-5f4e-8ba5-e1b22da249d3', 'Proyectos de internacionalización', false, true, '7 años', '1 año', false, true, false, false, NULL, 202) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b6ead4db-0289-5060-b67e-699a740a661d', '9b9a97ff-7363-5f4e-8ba5-e1b22da249d3', 'Proyectos de proyección social y responsabilidad social universitaria', false, true, '7 años', '1 año', false, true, false, false, NULL, 203) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b42bbc2a-d502-567a-9301-8b653d3ffaaf', 'ac6cc6f0-89e0-5249-8942-26d2c1ed26af', 'Registro de certificaciones', false, true, '7 años', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 204) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('73f7f8c1-f41c-5458-b9d5-635d2aedb424', '2f02193d-1dd2-5efa-8756-66d26d52f68c', 'Actas de entrega de diplomas', true, false, '20 años', '20 años', true, false, false, true, 'Cumplido el tiempo de retención se conserva la serie totalmente por poseer valores secundarios para la Institución.', 205) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('42d9f865-9bd7-5cf4-a4ee-3221143c5d80', '2f02193d-1dd2-5efa-8756-66d26d52f68c', 'Actas de grado', true, false, '20 años', '20 años', true, false, false, true, NULL, 206) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('21d10755-1b75-59d4-9725-ddd7e0e996f0', '036b8370-9f5a-5fb9-8e54-6270639a728f', NULL, false, true, '20 años', '80 años', true, false, false, true, 'Cumplido el tiempo de retención se conserva la serie totalmente por poseer valores secundarios para la Institución.', 207) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('1cda1fe7-ca97-53cb-b4a2-564c8efea79d', '39b2a290-a2e6-5c08-a5cf-ba9e92953e4b', NULL, false, true, '5 años', '5 años', true, false, false, true, NULL, 208) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('2361fa48-6503-54a9-aec2-9d18782ec926', '44d35a5a-ebbf-505d-baa4-f871a859fdfe', NULL, false, true, '5 años', '5 años', true, false, false, true, NULL, 209) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('30764936-df4b-58d3-9b6f-b90b697b1f7b', '04b84290-6e2e-506b-b216-f79d17d11112', NULL, false, true, '20 años', '20 años', true, false, false, true, NULL, 210) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('7f6e7208-d64a-57c8-9902-18744fa84e65', '260bfc3e-d11a-5241-867b-a1d1b0665cb8', NULL, false, true, '5 años', '5 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que  serán eliminados', 211) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('cf7062e2-5db0-5556-9bbd-c90b21b0fab4', 'd108501c-8682-5656-84e8-9cac20956119', NULL, true, false, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 212) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('5e248b9b-2a8e-5891-8823-3cd9628675ad', 'bb36ae00-2a81-5010-b093-eb4e410e1a26', NULL, false, true, '5 años', '5 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que  serán eliminados', 213) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('5da5587e-5d41-54b9-bbb8-7a0a7844f2d4', '298a4b1a-1e15-5319-9016-582057737bb8', 'Historias académicas
*Formulario de inscripción
*Fotocopia del documento de identidad
*Prueba de Estado Saber 11
*Acta de grado de bachiller o copia de diploma de bachiller o Acta de certificado de Educación Básica Secundaria para programas Técnicos profesionales
*Matrículas
*Acta de sustentación trabajo de grado
*Pruebas saber Pro - Pruebas Saber TyT
*Acta de grado de Título de Educación Superior (solo para graduados)
*Plan de Estudios
*Tabulados de notas
*Sanciones', true, false, '7 años', '80 años', false, false, true, true, 'En caso que el estudiante no renueve su matricula se convierte en desertor y se traslada historia académica al archivo central con la totalidad de los documentos que conforman su historia académica conservandolos según el tiempo establecido en la TRD. 
Para graduados se realiza selección de documentos, eliminanado examen médico general, contenidos programáticos (en caso de homologaciones), soportes de pruebas académicas y comunicaciones.', 214) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('52a698c9-8ec5-50a5-8330-c4efdcc964e2', '14ccc4e0-97f7-5bd2-850d-5a0307c897bd', 'Registro de notas', false, true, '5 años', '5 años', true, false, false, true, 'Cumplido el tiempo de retención se conserva la serie totalmente por poseer valores secundarios para la Institución.', 215) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('1e2a334f-35b7-5f81-b4c3-cb4cc36c666a', '38c457cc-0626-5410-97b5-66aa4553796a', 'Actas de baja de material bibliográfico', true, false, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 216) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f28006f0-b3c0-55df-b00a-021dbedf047f', '47ac32c3-8f08-5982-ba68-0ef39421da8e', 'Consolidado de estadísticas servicios de la biblioteca', false, true, '7 años', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 217) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('105ecdf8-8fb8-5b62-9fa5-fb5d0ac23f94', 'bbbba396-3021-578c-b909-487d9c6b1226', 'Informes de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 218) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('2ef8b9d8-3e76-5c2a-8107-61b36bd6ccc7', '34fd6143-20ae-544a-b928-6023937fee3a', 'Planilla de registro inventario y catalogación de material bibliográfico', false, true, '1 año', '1 año', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que  serán eliminados', 219) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('210d36aa-e0b0-52c2-a738-2279d57b9d7f', '34fd6143-20ae-544a-b928-6023937fee3a', 'Planilla de registro préstamo material bibliográfico', true, false, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 220) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('f37b28a3-cfd5-5606-ab29-565fd328d066', '34fd6143-20ae-544a-b928-6023937fee3a', 'Planilla de registro uso de biblioteca virtual', true, false, '1 año', '1 año', false, true, false, false, NULL, 221) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('b8e0313a-15ec-5101-a8c8-a12d69226a2a', '34fd6143-20ae-544a-b928-6023937fee3a', 'Planilla de Registro uso Servicios de Biblioteca', true, false, '1 año', '1 año', false, true, false, false, NULL, 222) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('e082ac87-b137-5312-9cc8-cdde5ca4761e', '34fd6143-20ae-544a-b928-6023937fee3a', 'Recomendación bibliográfica', false, true, '1 año', '1 año', false, true, false, false, NULL, 223) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('038182e4-4a1f-54d7-bf91-f73d66adbb7b', 'e362b507-d643-51df-be83-d74e8918510b', 'Actas de reuniones', true, false, '1 año', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 224) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('3ffb664e-651b-55f1-9b58-c151c4d29a9d', 'c229996d-c132-5b12-9cff-b96ac36bdee1', 'Comunicaciones internas', true, false, '1 año', '2 años', false, false, true, false, 'Cumplido el tiempo de retención se seleccionan los documentos que deben ser conservados de aquellos que  serán eliminados', 225) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('7f49987a-ac1f-5a33-b553-0740eb5e43b0', 'c229996d-c132-5b12-9cff-b96ac36bdee1', 'Comunicaciones externas', true, false, '1 año', '2 años', false, false, true, false, NULL, 226) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('47a9b6a1-dd3b-5d98-b7ed-dae08e1422ec', '1e1cb9de-7c79-5f4d-8042-2760b9950c0e', 'Consolidado estadístico uso de laboratorios y auditorios', false, true, '7 años', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 227) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('426f0b45-c194-5c88-9150-3181997a99f2', 'e8290502-68b9-54d8-8773-5b023f4d3c71', 'Informe de gestión', false, true, '1 año', '1 año', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 228) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('a43e44c3-e576-5f81-bcaa-5026d0fb5fa3', 'c037f5b6-365c-5062-9524-26a0995e3074', 'Registro calendario de mantenimiento de equipos de cómputo', false, true, '1 año', '3 años', false, true, false, false, 'Cumplido el tiempo de retención se elimina la serie documental por perder sus valores primarios y carecer de valores secundarios para la Institución', 229) on conflict (id) do nothing;
insert into public.subseries (id, serie_id, nombre, soporte_fisico, soporte_electronico, retencion_gestion, retencion_central, disp_conservacion_total, disp_eliminacion, disp_seleccion, disp_medio_digital, procedimiento, orden) values ('812120c4-9ff4-54a2-a0e0-ae97b643d892', 'c037f5b6-365c-5062-9524-26a0995e3074', 'Registro uso de espacios académicos', false, true, '1 año', '3 años', false, true, false, false, NULL, 230) on conflict (id) do nothing;

-- Usuarios semilla (pre-registro). NO son cuentas activas: el perfil real
-- se crea al primer inicio de sesión con Google (trigger handle_new_user).
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('presidencia@cotecnova.edu.co', 'Presidencia Consejo Directivo', '891401313', '54174274-32f2-5c8e-b216-90865652de87', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('rector@cotecnova.edu.co', 'Heynar Ramirez Becerra', '14568572', '54174274-32f2-5c8e-b216-90865652de87', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('aux.infraestructura@cotecnova.edu.co', 'Juan Manuel Atehortua Cano', '1006319577', '244303d4-4223-528f-8bd8-bc7ce67fbff0', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('cotecnova@cotecnova.edu.co', 'Leidy Tatiana Rebellón Lugo', '31435245-0', 'a38726d6-f6c2-5835-8242-3acf68df3240', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('aseguramiento@cotecnova.edu.co', 'Ramón Fredy Quebrada Martinez', '16229340-2', 'b873aeec-3250-5f5f-a798-668d94b26dcb', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('gestiontic@cotecnova.edu.co', 'Ramón Fredy Quebrada Martinez', '16229340', '99a2f096-5665-555b-8904-df6af9f93c52', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('mercadeo@cotecnova.edu.co', 'Javier Andres Vasquez Salazar', '14567388', '9c8eca2d-e14d-5c87-b99c-470f4b3d9196', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('secretaria@cotecnova.edu.co', 'Lina María Gomez Esquivel', '31430969', '244303d4-4223-528f-8bd8-bc7ce67fbff0', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('gestiondocumental@cotecnova.edu.co', 'Luisa Fernanda Martinez Arias', '1112790650', '01abdc65-1a5b-5e01-aac8-e5e57dbbe3c2', NULL, 'admin_archivo', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('gcalidad@cotecnova.edu.co', 'Kelly Yohana Piedrahita Alarcon', '1112792669', 'df43aeda-dae2-5580-bdf4-58428f97d54d', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('vicerrectoria@cotecnova.edu.co', 'Leidy Tatiana Rebellón Lugo', '31435245', '54357430-b487-523e-b6a2-05d2560e32c1', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('contador@cotecnova.edu.co', 'Jairo Restrepo Peña', '79396975', 'c6df12e5-be61-547b-b476-8bd315244e07', 'c5c1d308-6393-57d1-8a6c-869ec95923e7', 'jefe_dependencia', true, 'Responsable del Proceso Financiera completo; también responsable directo de la oficina Contabilidad.') on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('talentoh@cotecnova.edu.co', 'Leidy Yohanna Mondragón Bernal', '1112758842', '26330852-b029-57d8-bb58-19d485a05ff6', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('laboratorios@cotecnova.edu.co', 'Juan Manuel Cardona Valencia', '1112786720', '9a5d44ad-162a-5b35-b3e5-583623f7c0f8', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('relacionsectorexterno@cotecnova.edu.co', 'Edinson Jair Mosquera Angel', '1112773368', '8c22b2f9-a997-5be9-b78a-0c6f9dee1160', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('bienestar@cotecnova.edu.co', 'Adel Guerrero Quintero', '1144084512', 'ea08162f-89f1-58b0-9565-27972753d2c1', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('investigacion@cotecnova.edu.co', 'Marlene Rocio Moscoso Quiceno', '42008481', '018c88da-962e-58f6-ab40-df0a48b060a9', NULL, 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('tesoreria@cotecnova.edu.co', 'Albeiro Quiceno Escobar', '1112765805', 'c6df12e5-be61-547b-b476-8bd315244e07', '9ae7ec87-7182-546e-a2fa-f2576667e4ba', 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('creditoycartera@cotecnova.edu.co', 'Valentina Crespo Giraldo', '1004738040', 'c6df12e5-be61-547b-b476-8bd315244e07', 'cf27ed3a-e480-5eb8-840f-193c1c0b1e00', 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('auxiliarmercadeo@cotecnova.edu.co', 'Juan Camilo Trejos Arias', '1112786239', '9c8eca2d-e14d-5c87-b99c-470f4b3d9196', NULL, 'funcionario', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('monitor@cotecnova.edu.co', 'Andrés Felipe Mejía Suaza', '1113860156', '9a5d44ad-162a-5b35-b3e5-583623f7c0f8', NULL, 'consulta', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('biblioteca@cotecnova.edu.co', 'Edward Alejandro Carvajal Alvarez', '1112774899', '9a5d44ad-162a-5b35-b3e5-583623f7c0f8', NULL, 'funcionario', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('atencionusuario@cotecnova.edu.co', 'Alejandra Betancourt Mejia', '31434671', '54357430-b487-523e-b6a2-05d2560e32c1', NULL, 'funcionario', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('ingsistemas@cotecnova.edu.co', 'Arvey Barahona Gómez', '16222451', '54357430-b487-523e-b6a2-05d2560e32c1', '46adc54b-afc6-5cb6-87bb-ac105f84d8ae', 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('cadministrativa@cotecnova.edu.co', 'Yuri Marcela Llano Castaño', '1093217849', '54357430-b487-523e-b6a2-05d2560e32c1', '0cd33941-5d37-5593-b17f-27c487e45ae8', 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('agropecuaria@cotecnova.edu.co', 'Jorge Mario Arce Serna', '1098337061', '54357430-b487-523e-b6a2-05d2560e32c1', '6568f4a1-9e0a-5e14-89eb-d2930ce9d119', 'jefe_dependencia', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('registroycontrol@cotecnova.edu.co', 'Liliana Marcela Reyes Ruiz', '1112766775', '54357430-b487-523e-b6a2-05d2560e32c1', '4590d38f-e784-52b8-8e12-2098cd56fca7', 'funcionario', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('aux-talentoh@cotecnova.edu.co', 'Yasmin Lice Ramirez Cardona', '1004626357', '26330852-b029-57d8-bb58-19d485a05ff6', NULL, 'funcionario', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('serviciosgenerales+amilkar@cotecnova.edu.co', 'Jose Amilkar Cardona Sanchez', '2471491', '244303d4-4223-528f-8bd8-bc7ce67fbff0', NULL, 'consulta', false, 'Personal de Servicios Generales: no genera documentos en el sistema, no necesita cuenta activa en DocuNOVA (confirmado).') on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('serviciosgenerales+martin@cotecnova.edu.co', 'Juan Martin Betancourt Serna', '1006341474', '244303d4-4223-528f-8bd8-bc7ce67fbff0', NULL, 'consulta', false, 'Personal de Servicios Generales: no genera documentos en el sistema, no necesita cuenta activa en DocuNOVA (confirmado).') on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('serviciosgenerales+james@cotecnova.edu.co', 'James Salazar Mena', '1112760116', '244303d4-4223-528f-8bd8-bc7ce67fbff0', NULL, 'consulta', false, 'Personal de Servicios Generales: no genera documentos en el sistema, no necesita cuenta activa en DocuNOVA (confirmado).') on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('serviciosgenerales+camilo@cotecnova.edu.co', 'Juan Camilo Ceballos Salaz', '1111777151', '244303d4-4223-528f-8bd8-bc7ce67fbff0', NULL, 'consulta', false, 'Personal de Servicios Generales: no genera documentos en el sistema, no necesita cuenta activa en DocuNOVA (confirmado).') on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('serviciosgenerales+yovanna@cotecnova.edu.co', 'Miryam Yovanna Cardenas Oyola', '1112763873', '244303d4-4223-528f-8bd8-bc7ce67fbff0', NULL, 'consulta', false, 'Personal de Servicios Generales: no genera documentos en el sistema, no necesita cuenta activa en DocuNOVA (confirmado).') on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('serviciosgenerales+francisco@cotecnova.edu.co', 'Francisco Luis Castaño Restrepo', '3378761', '244303d4-4223-528f-8bd8-bc7ce67fbff0', NULL, 'consulta', false, 'Personal de Servicios Generales: no genera documentos en el sistema, no necesita cuenta activa en DocuNOVA (confirmado).') on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('serviciosgenerales+andrea@cotecnova.edu.co', 'Yulie Andrea Henao Rivera', '24551832', '244303d4-4223-528f-8bd8-bc7ce67fbff0', NULL, 'consulta', false, 'Personal de Servicios Generales: no genera documentos en el sistema, no necesita cuenta activa en DocuNOVA (confirmado).') on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('jloaiza@cotecnova.edu.co', 'Jorge Ariel Loaiza Loaiza', '14567769', '018c88da-962e-58f6-ab40-df0a48b060a9', NULL, 'funcionario', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('sgodoyh@cotecnova.edu.co', 'Sonia Elena Godoy Hortua', '51853342', '018c88da-962e-58f6-ab40-df0a48b060a9', NULL, 'funcionario', true, NULL) on conflict (email) do nothing;
insert into public.usuarios_semilla (email, nombre, cedula, proceso_id, oficina_id, rol, requiere_cuenta, notas) values ('bkf_aux_tic@cotecnova.edu.co', 'José David Zuluaga Barco', '1114150832', '99a2f096-5665-555b-8904-df6af9f93c52', NULL, 'funcionario', true, NULL) on conflict (email) do nothing;

-- Recordatorio: desarrolloweb@cotecnova.edu.co se activa como super_admin desde el trigger,
-- no desde esta semilla (no requiere fila de pre-registro).

commit;


-- >>>>>>>>>> supabase/migrations/0006_expedientes_documentos.sql <<<<<<<<<<

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


-- >>>>>>>>>> supabase/migrations/0007_aprobacion_firma_auditoria.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — Fase 3: Flujos de aprobación, firma electrónica simple y auditoría.
--
-- Un documento puede enviarse a un flujo de aprobación con uno o varios
-- aprobadores en secuencia. Cada aprobación registra una firma electrónica
-- simple (usuario, rol, fecha/hora, IP y hash del documento). Toda acción del
-- flujo se anota en una bitácora de auditoría append-only (Ley 527 de 1999
-- para la firma; §7 del alcance para la trazabilidad).
--
-- La lógica del flujo vive en funciones SECURITY DEFINER (crear_solicitud /
-- decidir_paso) que validan la autorización con auth.uid(): así la integridad
-- del flujo no depende del cliente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Solicitudes de aprobación (una por "ronda" de aprobación de un documento)
-- -----------------------------------------------------------------------------
create table public.aprobacion_solicitudes (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  proceso_id   uuid references public.procesos (id) on delete restrict,
  estado       text not null default 'en_curso'
                 check (estado in ('en_curso', 'aprobado', 'rechazado', 'cancelado')),
  paso_actual  integer not null default 1,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index aprob_solic_documento_idx on public.aprobacion_solicitudes (documento_id);
create index aprob_solic_proceso_idx on public.aprobacion_solicitudes (proceso_id);

-- -----------------------------------------------------------------------------
-- 2. Pasos del flujo (aprobadores en secuencia)
-- -----------------------------------------------------------------------------
create table public.aprobacion_pasos (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.aprobacion_solicitudes (id) on delete cascade,
  orden        integer not null,
  aprobador_id uuid not null references public.profiles (id) on delete restrict,
  estado       text not null default 'pendiente'
                 check (estado in ('pendiente', 'aprobado', 'rechazado')),
  comentario   text,
  decidido_at  timestamptz,
  proceso_id   uuid references public.procesos (id) on delete restrict,
  created_at   timestamptz not null default now(),
  unique (solicitud_id, orden)
);
create index aprob_pasos_solicitud_idx on public.aprobacion_pasos (solicitud_id);
create index aprob_pasos_aprobador_idx on public.aprobacion_pasos (aprobador_id);

-- -----------------------------------------------------------------------------
-- 3. Firmas electrónicas (append-only). tipo_firma deja abierto un proveedor
--    externo de firma certificada en una fase posterior (no implementado aún).
-- -----------------------------------------------------------------------------
create table public.firmas (
  id             uuid primary key default gen_random_uuid(),
  documento_id   uuid not null references public.documentos (id) on delete cascade,
  paso_id        uuid references public.aprobacion_pasos (id) on delete set null,
  firmante_id    uuid references public.profiles (id) on delete set null,
  rol_snapshot   text,
  tipo_firma     text not null default 'simple',
  hash_documento text,
  ip             text,
  proceso_id     uuid references public.procesos (id) on delete restrict,
  created_at     timestamptz not null default now()
);
create index firmas_documento_idx on public.firmas (documento_id);

-- -----------------------------------------------------------------------------
-- 4. Bitácora de auditoría (append-only)
-- -----------------------------------------------------------------------------
create table public.auditoria (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles (id) on delete set null,
  accion       text not null,
  entidad_tipo text,
  entidad_id   uuid,
  detalle      jsonb,
  ip           text,
  created_at   timestamptz not null default now()
);
create index auditoria_entidad_idx on public.auditoria (entidad_tipo, entidad_id);
create index auditoria_actor_idx on public.auditoria (actor_id);

comment on table public.auditoria is
  'Bitácora append-only de acciones sensibles. Sin UPDATE ni DELETE (ver grants).';

-- -----------------------------------------------------------------------------
-- 5. Función interna de auditoría (reutilizable)
-- -----------------------------------------------------------------------------
create or replace function public.registrar_auditoria(
  p_accion text,
  p_entidad_tipo text,
  p_entidad_id uuid,
  p_detalle jsonb default '{}'::jsonb,
  p_ip text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.auditoria (actor_id, accion, entidad_tipo, entidad_id, detalle, ip)
  values (auth.uid(), p_accion, p_entidad_tipo, p_entidad_id, coalesce(p_detalle, '{}'::jsonb), p_ip);
$$;

-- -----------------------------------------------------------------------------
-- 6. Crear una solicitud de aprobación con sus pasos (aprobadores en orden)
-- -----------------------------------------------------------------------------
create or replace function public.crear_solicitud(
  p_documento uuid,
  p_aprobadores uuid[],
  p_ip text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proceso uuid;
  v_solicitud uuid;
  v_aprobador uuid;
  v_orden int := 0;
begin
  if array_length(p_aprobadores, 1) is null then
    raise exception 'Debe indicar al menos un aprobador';
  end if;

  select proceso_id into v_proceso from public.documentos where id = p_documento;
  if v_proceso is null then
    raise exception 'Documento inexistente';
  end if;

  -- Autorización: solo quien puede escribir en el proceso puede iniciar el flujo.
  if not public.can_write_proceso(v_proceso) then
    raise exception 'No autorizado para iniciar la aprobación de este documento';
  end if;

  -- No permitir dos flujos en curso para el mismo documento.
  if exists (
    select 1 from public.aprobacion_solicitudes
    where documento_id = p_documento and estado = 'en_curso'
  ) then
    raise exception 'El documento ya tiene un flujo de aprobación en curso';
  end if;

  insert into public.aprobacion_solicitudes (documento_id, proceso_id, created_by)
  values (p_documento, v_proceso, auth.uid())
  returning id into v_solicitud;

  foreach v_aprobador in array p_aprobadores loop
    v_orden := v_orden + 1;
    insert into public.aprobacion_pasos (solicitud_id, orden, aprobador_id, proceso_id)
    values (v_solicitud, v_orden, v_aprobador, v_proceso);
  end loop;

  perform public.registrar_auditoria(
    'aprobacion.solicitud_creada', 'documento', p_documento,
    jsonb_build_object('solicitud_id', v_solicitud, 'pasos', array_length(p_aprobadores, 1)),
    p_ip
  );

  return v_solicitud;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Decidir un paso (aprobar -> firma electrónica simple; o rechazar)
-- -----------------------------------------------------------------------------
create or replace function public.decidir_paso(
  p_paso uuid,
  p_decision text,
  p_comentario text default null,
  p_hash text default null,
  p_ip text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paso public.aprobacion_pasos%rowtype;
  v_solic public.aprobacion_solicitudes%rowtype;
  v_total int;
  v_rol public.user_role;
begin
  if p_decision not in ('aprobado', 'rechazado') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_paso from public.aprobacion_pasos where id = p_paso;
  if not found then raise exception 'Paso inexistente'; end if;

  -- Solo el aprobador asignado puede decidir su paso.
  if v_paso.aprobador_id <> auth.uid() then
    raise exception 'Solo el aprobador asignado puede decidir este paso';
  end if;

  select * into v_solic from public.aprobacion_solicitudes where id = v_paso.solicitud_id;
  if v_solic.estado <> 'en_curso' then
    raise exception 'La solicitud no está en curso';
  end if;
  if v_paso.orden <> v_solic.paso_actual then
    raise exception 'Aún no es el turno de este paso';
  end if;
  if v_paso.estado <> 'pendiente' then
    raise exception 'El paso ya fue decidido';
  end if;

  select role into v_rol from public.profiles where id = auth.uid();

  update public.aprobacion_pasos
    set estado = p_decision, comentario = p_comentario, decidido_at = now()
    where id = p_paso;

  if p_decision = 'rechazado' then
    update public.aprobacion_solicitudes
      set estado = 'rechazado', updated_at = now() where id = v_solic.id;

    perform public.registrar_auditoria(
      'aprobacion.paso_rechazado', 'documento', v_solic.documento_id,
      jsonb_build_object('solicitud_id', v_solic.id, 'paso', v_paso.orden), p_ip);
    return;
  end if;

  -- Aprobado: registrar firma electrónica simple.
  insert into public.firmas (
    documento_id, paso_id, firmante_id, rol_snapshot, tipo_firma,
    hash_documento, ip, proceso_id
  ) values (
    v_solic.documento_id, p_paso, auth.uid(), v_rol::text, 'simple',
    p_hash, p_ip, v_paso.proceso_id
  );

  perform public.registrar_auditoria(
    'aprobacion.paso_aprobado', 'documento', v_solic.documento_id,
    jsonb_build_object('solicitud_id', v_solic.id, 'paso', v_paso.orden, 'hash', p_hash), p_ip);

  -- ¿Era el último paso?
  select count(*) into v_total from public.aprobacion_pasos where solicitud_id = v_solic.id;
  if v_paso.orden >= v_total then
    update public.aprobacion_solicitudes
      set estado = 'aprobado', updated_at = now() where id = v_solic.id;
    perform public.registrar_auditoria(
      'aprobacion.completada', 'documento', v_solic.documento_id,
      jsonb_build_object('solicitud_id', v_solic.id), p_ip);
  else
    update public.aprobacion_solicitudes
      set paso_actual = v_paso.orden + 1, updated_at = now() where id = v_solic.id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Row Level Security (lectura por proceso o por implicado; escritura vía RPC)
-- -----------------------------------------------------------------------------
alter table public.aprobacion_solicitudes enable row level security;
alter table public.aprobacion_pasos enable row level security;
alter table public.firmas enable row level security;
alter table public.auditoria enable row level security;

create policy "solic_select" on public.aprobacion_solicitudes
  for select to authenticated
  using (public.can_read_proceso(proceso_id) or created_by = auth.uid());

create policy "pasos_select" on public.aprobacion_pasos
  for select to authenticated
  using (public.can_read_proceso(proceso_id) or aprobador_id = auth.uid());

create policy "firmas_select" on public.firmas
  for select to authenticated
  using (public.can_read_proceso(proceso_id) or firmante_id = auth.uid());

-- Auditoría: solo administradores de archivo o el propio actor. Nunca editable.
create policy "auditoria_select" on public.auditoria
  for select to authenticated
  using (public.is_archivo_admin() or actor_id = auth.uid());

-- Privilegios: solo SELECT desde el cliente. Las escrituras las hacen las
-- funciones SECURITY DEFINER (crear_solicitud / decidir_paso / registrar_auditoria).
grant select on public.aprobacion_solicitudes to authenticated;
grant select on public.aprobacion_pasos to authenticated;
grant select on public.firmas to authenticated;
grant select on public.auditoria to authenticated;


-- >>>>>>>>>> supabase/migrations/0008_notificaciones.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — Fase 4: Notificaciones (backbone) + tablero.
--
-- Las notificaciones se ENCOLAN en la base de datos cuando ocurre un evento
-- (p. ej. un documento queda pendiente de tu firma). El ENVÍO real por Gmail
-- (Google Workspace) es un paso posterior: un worker/Edge Function leerá las
-- filas en estado 'pendiente' y las enviará usando el scope
-- https://www.googleapis.com/auth/gmail.send, marcándolas como 'enviada'.
-- Este archivo deja lista toda esa infraestructura salvo el envío externo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cola / bitácora de notificaciones
-- -----------------------------------------------------------------------------
create table public.notificaciones (
  id               uuid primary key default gen_random_uuid(),
  destinatario_id  uuid references public.profiles (id) on delete cascade,
  destinatario_email text,
  tipo             text not null,
  asunto           text not null,
  cuerpo           text,
  entidad_tipo     text,
  entidad_id       uuid,
  proceso_id       uuid references public.procesos (id) on delete set null,
  canal            text not null default 'gmail',
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente', 'enviada', 'fallida')),
  leida            boolean not null default false,
  error            text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
create index notif_destinatario_idx on public.notificaciones (destinatario_id);
create index notif_estado_idx on public.notificaciones (estado);

comment on table public.notificaciones is
  'Cola de notificaciones. El envío por Gmail (scope gmail.send) es un paso externo pendiente.';

-- -----------------------------------------------------------------------------
-- 2. Encolar una notificación (uso interno de las funciones del flujo)
-- -----------------------------------------------------------------------------
create or replace function public.crear_notificacion(
  p_destinatario uuid,
  p_tipo text,
  p_asunto text,
  p_cuerpo text,
  p_entidad_tipo text,
  p_entidad_id uuid,
  p_proceso uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from public.profiles where id = p_destinatario;
  insert into public.notificaciones (
    destinatario_id, destinatario_email, tipo, asunto, cuerpo,
    entidad_tipo, entidad_id, proceso_id
  ) values (
    p_destinatario, v_email, p_tipo, p_asunto, p_cuerpo,
    p_entidad_tipo, p_entidad_id, p_proceso
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Marcar una notificación como leída (solo el destinatario)
-- -----------------------------------------------------------------------------
create or replace function public.marcar_notificacion_leida(p_notif uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notificaciones
    set leida = true
    where id = p_notif and destinatario_id = auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS: cada quien ve sus notificaciones; el admin de archivo, todas.
-- -----------------------------------------------------------------------------
alter table public.notificaciones enable row level security;

create policy "notif_select" on public.notificaciones
  for select to authenticated
  using (destinatario_id = auth.uid() or public.is_archivo_admin());

grant select on public.notificaciones to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Redefinir las funciones del flujo (Fase 3) para encolar notificaciones.
--    Avisa al aprobador en turno cuando le toca, y al autor al cerrarse el flujo.
-- -----------------------------------------------------------------------------
create or replace function public.crear_solicitud(
  p_documento uuid,
  p_aprobadores uuid[],
  p_ip text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proceso uuid;
  v_solicitud uuid;
  v_aprobador uuid;
  v_orden int := 0;
  v_titulo text;
begin
  if array_length(p_aprobadores, 1) is null then
    raise exception 'Debe indicar al menos un aprobador';
  end if;

  select proceso_id into v_proceso from public.documentos where id = p_documento;
  if v_proceso is null then
    raise exception 'Documento inexistente';
  end if;
  if not public.can_write_proceso(v_proceso) then
    raise exception 'No autorizado para iniciar la aprobación de este documento';
  end if;
  if exists (
    select 1 from public.aprobacion_solicitudes
    where documento_id = p_documento and estado = 'en_curso'
  ) then
    raise exception 'El documento ya tiene un flujo de aprobación en curso';
  end if;

  insert into public.aprobacion_solicitudes (documento_id, proceso_id, created_by)
  values (p_documento, v_proceso, auth.uid())
  returning id into v_solicitud;

  foreach v_aprobador in array p_aprobadores loop
    v_orden := v_orden + 1;
    insert into public.aprobacion_pasos (solicitud_id, orden, aprobador_id, proceso_id)
    values (v_solicitud, v_orden, v_aprobador, v_proceso);
  end loop;

  perform public.registrar_auditoria(
    'aprobacion.solicitud_creada', 'documento', p_documento,
    jsonb_build_object('solicitud_id', v_solicitud, 'pasos', array_length(p_aprobadores, 1)),
    p_ip
  );

  -- Notificar al primer aprobador.
  select titulo into v_titulo from public.documentos where id = p_documento;
  perform public.crear_notificacion(
    p_aprobadores[1], 'aprobacion_pendiente',
    'Tienes un documento pendiente de aprobación',
    format('El documento «%s» espera tu revisión y firma.', v_titulo),
    'documento', p_documento, v_proceso
  );

  return v_solicitud;
end;
$$;

create or replace function public.decidir_paso(
  p_paso uuid,
  p_decision text,
  p_comentario text default null,
  p_hash text default null,
  p_ip text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paso public.aprobacion_pasos%rowtype;
  v_solic public.aprobacion_solicitudes%rowtype;
  v_total int;
  v_rol public.user_role;
  v_titulo text;
  v_siguiente uuid;
begin
  if p_decision not in ('aprobado', 'rechazado') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_paso from public.aprobacion_pasos where id = p_paso;
  if not found then raise exception 'Paso inexistente'; end if;
  if v_paso.aprobador_id <> auth.uid() then
    raise exception 'Solo el aprobador asignado puede decidir este paso';
  end if;

  select * into v_solic from public.aprobacion_solicitudes where id = v_paso.solicitud_id;
  if v_solic.estado <> 'en_curso' then
    raise exception 'La solicitud no está en curso';
  end if;
  if v_paso.orden <> v_solic.paso_actual then
    raise exception 'Aún no es el turno de este paso';
  end if;
  if v_paso.estado <> 'pendiente' then
    raise exception 'El paso ya fue decidido';
  end if;

  select role into v_rol from public.profiles where id = auth.uid();
  select titulo into v_titulo from public.documentos where id = v_solic.documento_id;

  update public.aprobacion_pasos
    set estado = p_decision, comentario = p_comentario, decidido_at = now()
    where id = p_paso;

  if p_decision = 'rechazado' then
    update public.aprobacion_solicitudes
      set estado = 'rechazado', updated_at = now() where id = v_solic.id;
    perform public.registrar_auditoria(
      'aprobacion.paso_rechazado', 'documento', v_solic.documento_id,
      jsonb_build_object('solicitud_id', v_solic.id, 'paso', v_paso.orden), p_ip);
    -- Avisar al autor del rechazo.
    if v_solic.created_by is not null then
      perform public.crear_notificacion(
        v_solic.created_by, 'aprobacion_rechazada',
        'Un documento fue rechazado',
        format('El documento «%s» fue rechazado en la aprobación.', v_titulo),
        'documento', v_solic.documento_id, v_solic.proceso_id);
    end if;
    return;
  end if;

  insert into public.firmas (
    documento_id, paso_id, firmante_id, rol_snapshot, tipo_firma,
    hash_documento, ip, proceso_id
  ) values (
    v_solic.documento_id, p_paso, auth.uid(), v_rol::text, 'simple',
    p_hash, p_ip, v_paso.proceso_id
  );

  perform public.registrar_auditoria(
    'aprobacion.paso_aprobado', 'documento', v_solic.documento_id,
    jsonb_build_object('solicitud_id', v_solic.id, 'paso', v_paso.orden, 'hash', p_hash), p_ip);

  select count(*) into v_total from public.aprobacion_pasos where solicitud_id = v_solic.id;
  if v_paso.orden >= v_total then
    update public.aprobacion_solicitudes
      set estado = 'aprobado', updated_at = now() where id = v_solic.id;
    perform public.registrar_auditoria(
      'aprobacion.completada', 'documento', v_solic.documento_id,
      jsonb_build_object('solicitud_id', v_solic.id), p_ip);
    -- Avisar al autor de la aprobación final.
    if v_solic.created_by is not null then
      perform public.crear_notificacion(
        v_solic.created_by, 'aprobacion_completada',
        'Un documento fue aprobado',
        format('El documento «%s» completó su flujo de aprobación.', v_titulo),
        'documento', v_solic.documento_id, v_solic.proceso_id);
    end if;
  else
    update public.aprobacion_solicitudes
      set paso_actual = v_paso.orden + 1, updated_at = now() where id = v_solic.id;
    -- Avisar al siguiente aprobador.
    select aprobador_id into v_siguiente from public.aprobacion_pasos
      where solicitud_id = v_solic.id and orden = v_paso.orden + 1;
    if v_siguiente is not null then
      perform public.crear_notificacion(
        v_siguiente, 'aprobacion_pendiente',
        'Tienes un documento pendiente de aprobación',
        format('El documento «%s» espera tu revisión y firma.', v_titulo),
        'documento', v_solic.documento_id, v_solic.proceso_id);
    end if;
  end if;
end;
$$;

