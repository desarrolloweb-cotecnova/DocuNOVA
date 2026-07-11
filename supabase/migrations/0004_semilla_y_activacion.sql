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
