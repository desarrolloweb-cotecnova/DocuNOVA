-- =============================================================================
-- DocuNOVA — 0001 Fundación (rediseño)
-- Modelo base: organización (unidades/oficinas), perfiles de usuario con roles,
-- datos personales sensibles aparte (habeas data — Ley 1581 de 2012) y
-- pre-registro (usuarios_semilla). RLS activa por defecto; rol por defecto
-- 'pendiente' (mínimo privilegio: sin acceso hasta que se asigne un rol).
--
-- El segundo factor (TOTP) NO vive aquí: es MFA nativo de Supabase (esquema
-- `auth`, nivel de sesión aal2). Esta migración no toca el esquema `auth`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enumeraciones
-- -----------------------------------------------------------------------------
-- Roles del sistema (deben coincidir con src/lib/roles.ts).
create type public.rol_usuario as enum (
  'superadmin',     -- administra todo (usuarios, TRD, documentos)
  'rector',         -- igual que superadmin en capacidades de gestión
  'administrador',  -- aprueba TRD y crea documentos; no edita roles de usuarios
  'gestor',         -- elabora TRD y documentos; no aprueba
  'colaborador',    -- solo crea registros
  'consulta',       -- solo lectura
  'pendiente'       -- sin acceso, a la espera de asignación de rol (por defecto)
);

-- Tipo de nodo en el catálogo organizacional.
create type public.tipo_unidad as enum ('eje', 'macroproceso', 'proceso');

-- -----------------------------------------------------------------------------
-- 2. Catálogo organizacional (árbol autorreferente): eje -> macroproceso ->
--    proceso. Reemplaza las antiguas tablas ejes/macroprocesos/procesos.
-- -----------------------------------------------------------------------------
create table public.unidades (
  id        uuid primary key default gen_random_uuid(),
  tipo      public.tipo_unidad not null,
  codigo    text not null unique,
  nombre    text not null,
  padre_id  uuid references public.unidades (id) on delete restrict,
  activo    boolean not null default true,
  creado_en timestamptz not null default now(),
  -- Un eje no tiene padre; macroprocesos y procesos sí.
  constraint unidades_padre_coherente check (
    (tipo = 'eje' and padre_id is null)
    or (tipo <> 'eje' and padre_id is not null)
  )
);
create index unidades_padre_idx on public.unidades (padre_id);

comment on table public.unidades is
  'Catálogo organizacional de Cotecnova (ejes, macroprocesos y procesos).';

-- -----------------------------------------------------------------------------
-- 3. Oficinas productoras (dependencias que producen documentos).
-- -----------------------------------------------------------------------------
create table public.oficinas (
  id                uuid primary key default gen_random_uuid(),
  unidad_id         uuid not null references public.unidades (id) on delete restrict,
  codigo            text not null unique,
  nombre            text not null,
  ubicacion_fisica  text,
  ubicacion_digital text,
  activo            boolean not null default true,
  creado_en         timestamptz not null default now()
);
create index oficinas_unidad_idx on public.oficinas (unidad_id);

comment on table public.oficinas is
  'Oficinas/dependencias productoras de documentos, ancladas a un proceso.';

-- -----------------------------------------------------------------------------
-- 4. Perfiles (1:1 con auth.users). Sin PII sensible (ver datos_personales).
-- -----------------------------------------------------------------------------
create table public.perfiles (
  usuario_id      uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  nombre_completo text,
  titulo_cargo    text,
  supervisor_id   uuid references public.perfiles (usuario_id) on delete set null,
  es_responsable  boolean not null default false,
  activo          boolean not null default false,          -- nace inactivo
  rol             public.rol_usuario not null default 'pendiente',
  unidad_id       uuid references public.unidades (id) on delete set null,
  foto_url        text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index perfiles_unidad_idx on public.perfiles (unidad_id);
create index perfiles_rol_idx on public.perfiles (rol);

comment on table public.perfiles is
  'Perfil de cada empleado (1:1 con auth.users). Rol por defecto: pendiente.';

-- -----------------------------------------------------------------------------
-- 5. Datos personales sensibles (cédula). Tabla aparte para poder ocultarla de
--    los listados generales con RLS: solo el dueño y superadmin/rector.
-- -----------------------------------------------------------------------------
create table public.datos_personales (
  usuario_id       uuid primary key references public.perfiles (usuario_id) on delete cascade,
  numero_documento text,
  actualizado_en   timestamptz not null default now()
);

comment on table public.datos_personales is
  'Datos personales reservados (Ley 1581/2012). Acceso: dueño y admin de usuarios.';

-- -----------------------------------------------------------------------------
-- 6. Responsables de oficina (asignación N:M perfiles<->oficinas).
-- -----------------------------------------------------------------------------
create table public.responsables_oficina (
  id           uuid primary key default gen_random_uuid(),
  oficina_id   uuid not null references public.oficinas (id) on delete cascade,
  usuario_id   uuid not null references public.perfiles (usuario_id) on delete cascade,
  es_principal boolean not null default false,
  creado_en    timestamptz not null default now(),
  unique (oficina_id, usuario_id)
);
create index responsables_usuario_idx on public.responsables_oficina (usuario_id);
-- Como máximo un responsable principal por oficina.
create unique index responsables_principal_idx
  on public.responsables_oficina (oficina_id) where es_principal;

-- -----------------------------------------------------------------------------
-- 7. Pre-registro (semilla): datos conocidos de un empleado ANTES de su primer
--    login. El perfil real lo crea el trigger handle_new_user al iniciar sesión.
--    Contiene numero_documento -> sensible: RLS solo admin de usuarios.
-- -----------------------------------------------------------------------------
create table public.usuarios_semilla (
  email            text primary key,
  nombre           text not null,
  numero_documento text,
  rol              public.rol_usuario not null default 'pendiente',
  unidad_id        uuid references public.unidades (id) on delete set null,
  oficina_id       uuid references public.oficinas (id) on delete set null,
  notas            text,
  creado_en        timestamptz not null default now()
);

comment on table public.usuarios_semilla is
  'Pre-registro de empleados. El perfil real se crea al primer login (trigger).';

-- -----------------------------------------------------------------------------
-- 8. Funciones auxiliares para RLS. SECURITY DEFINER para leer el rol sin
--    provocar recursión en las políticas de la propia tabla perfiles.
--    rol_actual() filtra por `activo`: un usuario inactivo o 'pendiente'
--    devuelve NULL y, por tanto, no supera ninguna comprobación de capacidad.
-- -----------------------------------------------------------------------------
create or replace function public.rol_actual()
returns public.rol_usuario
language sql stable security definer set search_path = public
as $$
  select rol from public.perfiles where usuario_id = auth.uid() and activo
$$;

-- Administra usuarios (edita rol/activo): solo superadmin y rector.
create or replace function public.es_admin_usuarios()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.rol_actual() in ('superadmin', 'rector')
$$;

-- Aprueba TRD y crea documentos.
create or replace function public.puede_aprobar_trd()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.rol_actual() in ('superadmin', 'rector', 'administrador')
$$;

-- Elabora TRD y crea/edita documentos (incluye gestor; no aprueba).
create or replace function public.puede_elaborar()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.rol_actual() in ('superadmin', 'rector', 'administrador', 'gestor')
$$;

-- Crea registros (incluye colaborador).
create or replace function public.puede_crear_registros()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.rol_actual() in
    ('superadmin', 'rector', 'administrador', 'gestor', 'colaborador')
$$;

-- Cualquier rol asignado y activo (bloquea 'pendiente' e inactivos).
create or replace function public.es_lector()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.rol_actual() is not null
$$;

-- Función genérica para mantener actualizado_en (reutilizada por 0002/0003).
create or replace function public.tocar_actualizado()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Trigger: crear perfil automáticamente al registrarse un usuario.
--    - Por defecto: rol 'pendiente', inactivo.
--    - Bootstrap: desarrolloweb@cotecnova.edu.co -> superadmin activo.
--    - Si hay fila en usuarios_semilla: toma rol/unidad/nombre y activa.
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
  v_rol     public.rol_usuario := 'pendiente';
  v_activo  boolean := false;
  v_nombre  text;
  v_unidad  uuid;
  v_doc     text;
begin
  v_nombre := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.email
  );

  if v_email = 'desarrolloweb@cotecnova.edu.co' then
    -- Super administrador: única cuenta que nace ACTIVA (activa a las demás).
    v_rol := 'superadmin';
    v_activo := true;
  else
    select * into v_semilla from public.usuarios_semilla where email = v_email;
    if found then
      v_rol := v_semilla.rol;
      v_nombre := coalesce(v_semilla.nombre, v_nombre);
      v_unidad := v_semilla.unidad_id;
      v_doc := v_semilla.numero_documento;
      -- Empleado pre-registrado con rol asignado -> entra activo.
      v_activo := (v_semilla.rol <> 'pendiente');
    end if;
  end if;

  insert into public.perfiles
    (usuario_id, email, nombre_completo, rol, unidad_id, activo)
  values
    (new.id, new.email, v_nombre, v_rol, v_unidad, v_activo);

  if v_doc is not null then
    insert into public.datos_personales (usuario_id, numero_documento)
    values (new.id, v_doc)
    on conflict (usuario_id) do update set numero_documento = excluded.numero_documento;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 10. Guard anti-escalada: un usuario que no sea admin de usuarios
--     (superadmin/rector) no puede cambiar campos privilegiados de ningún
--     perfil, ni siquiera el suyo (aunque la política le deje editar el nombre).
-- -----------------------------------------------------------------------------
create or replace function public.proteger_privilegios_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_usuarios() then
    new.rol := old.rol;
    new.activo := old.activo;
    new.unidad_id := old.unidad_id;
    new.es_responsable := old.es_responsable;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger perfiles_proteger_before_update
  before update on public.perfiles
  for each row
  execute function public.proteger_privilegios_perfil();

-- -----------------------------------------------------------------------------
-- 11. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.unidades enable row level security;
alter table public.oficinas enable row level security;
alter table public.perfiles enable row level security;
alter table public.datos_personales enable row level security;
alter table public.responsables_oficina enable row level security;
alter table public.usuarios_semilla enable row level security;

-- perfiles: cada quien ve el suyo; los aprobadores (admin+) ven todos.
create policy "perfiles_select" on public.perfiles
  for select to authenticated
  using (usuario_id = auth.uid() or public.puede_aprobar_trd());

-- perfiles: el propio perfil (campos no privilegiados, ver guard) o el admin
-- de usuarios (rol/activo/unidad). El INSERT lo hace el trigger, no el cliente.
create policy "perfiles_update" on public.perfiles
  for update to authenticated
  using (usuario_id = auth.uid() or public.es_admin_usuarios())
  with check (usuario_id = auth.uid() or public.es_admin_usuarios());

-- datos_personales: el dueño y el admin de usuarios (leer y escribir su propia
-- fila; el admin, cualquiera).
create policy "datos_personales_select" on public.datos_personales
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin_usuarios());
create policy "datos_personales_write" on public.datos_personales
  for all to authenticated
  using (usuario_id = auth.uid() or public.es_admin_usuarios())
  with check (usuario_id = auth.uid() or public.es_admin_usuarios());

-- unidades / oficinas / responsables: lectura para cualquier rol activo;
-- escritura para aprobadores (admin+).
create policy "unidades_select" on public.unidades
  for select to authenticated using (public.es_lector());
create policy "unidades_write" on public.unidades
  for all to authenticated
  using (public.puede_aprobar_trd()) with check (public.puede_aprobar_trd());

create policy "oficinas_select" on public.oficinas
  for select to authenticated using (public.es_lector());
create policy "oficinas_write" on public.oficinas
  for all to authenticated
  using (public.puede_aprobar_trd()) with check (public.puede_aprobar_trd());

create policy "responsables_select" on public.responsables_oficina
  for select to authenticated using (public.es_lector());
create policy "responsables_write" on public.responsables_oficina
  for all to authenticated
  using (public.puede_aprobar_trd()) with check (public.puede_aprobar_trd());

-- usuarios_semilla (contiene cédulas): solo el admin de usuarios.
create policy "semilla_admin" on public.usuarios_semilla
  for all to authenticated
  using (public.es_admin_usuarios()) with check (public.es_admin_usuarios());

-- -----------------------------------------------------------------------------
-- 12. Privilegios de tabla (la RLS sigue gobernando el acceso por fila).
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.datos_personales to authenticated;
grant select, insert, update, delete on public.unidades to authenticated;
grant select, insert, update, delete on public.oficinas to authenticated;
grant select, insert, update, delete on public.responsables_oficina to authenticated;
grant select, insert, update, delete on public.usuarios_semilla to authenticated;
