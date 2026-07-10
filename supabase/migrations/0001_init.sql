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
