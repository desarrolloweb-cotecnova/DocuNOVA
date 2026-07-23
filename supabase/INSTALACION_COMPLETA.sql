-- =============================================================================
-- DocuNOVA — INSTALACIÓN COMPLETA (generado desde supabase/migrations/)
-- Pega TODO este archivo en el SQL Editor de Supabase y presiona RUN una vez.
-- Regenerar con: node scripts/build-installer.mjs
--
-- PASO 0 (limpieza): elimina cualquier objeto de DocuNOVA de un intento previo
-- (esquema nuevo y también el antiguo), para que la instalación sea siempre
-- limpia. No afecta el esquema `auth` (Google/MFA) ni nada ajeno a DocuNOVA.
-- =============================================================================

drop trigger if exists on_auth_user_created on auth.users;

-- Políticas de almacenamiento (bucket 'memoria'): se recrean en la migración.
drop policy if exists "memoria_objetos_insert" on storage.objects;
drop policy if exists "memoria_objetos_update" on storage.objects;
drop policy if exists "memoria_objetos_delete" on storage.objects;
drop policy if exists "memoria_objetos_select" on storage.objects;

-- Tablas del esquema NUEVO
drop table if exists
  public.memoria_documentos,
  public.notificaciones,
  public.registros,
  public.documentos,
  public.aprobaciones_trd,
  public.series,
  public.responsables_oficina,
  public.datos_personales,
  public.usuarios_semilla,
  public.oficinas,
  public.perfiles,
  public.unidades
  cascade;

-- Tablas del esquema ANTIGUO (por si se actualiza desde una versión previa)
drop table if exists
  public.notificaciones,
  public.auditoria,
  public.firmas,
  public.aprobacion_pasos,
  public.aprobacion_solicitudes,
  public.documentos_old,
  public.expedientes,
  public.datos_sensibles,
  public.subseries,
  public.oficinas_productoras,
  public.procesos,
  public.macroprocesos,
  public.ejes,
  public.profiles,
  public.dependencias
  cascade;

-- Funciones (nuevas y antiguas)
drop function if exists
  public.handle_new_user(),
  public.proteger_privilegios_perfil(),
  public.proteger_estado_trd(),
  public.tocar_actualizado(),
  public.rol_actual(),
  public.es_admin_usuarios(),
  public.puede_aprobar_trd(),
  public.puede_elaborar(),
  public.puede_crear_registros(),
  public.es_lector(),
  public.current_user_role(),
  public.current_user_proceso(),
  public.is_archivo_admin(),
  public.is_super_admin(),
  public.can_manage_proceso(uuid),
  public.protect_profile_privileges()
  cascade;

-- Tipos (nuevos y antiguos)
drop type if exists
  public.categoria_memoria,
  public.visibilidad_memoria,
  public.estado_memoria,
  public.tipo_notificacion,
  public.estado_registro,
  public.estado_documento,
  public.tipo_documento,
  public.estado_trd,
  public.nivel_serie,
  public.tipo_unidad,
  public.rol_usuario,
  public.user_role
  cascade;

-- =============================================================================
-- Migraciones (en orden)
-- =============================================================================


-- >>>>>>>>>> 0001_fundacion.sql <<<<<<<<<<

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


-- >>>>>>>>>> 0002_trd.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — 0002 TRD (Tablas de Retención Documental)
-- Series como árbol autorreferente (serie -> subserie -> tipo) y bitácora de
-- aprobación por oficina. Depende de 0001 (oficinas, perfiles, helpers RLS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enumeraciones
-- -----------------------------------------------------------------------------
create type public.nivel_serie as enum ('serie', 'subserie', 'tipo');
create type public.estado_trd as enum
  ('borrador', 'en_revision', 'aprobado', 'rechazado');

-- -----------------------------------------------------------------------------
-- 2. Series documentales (árbol autorreferente por oficina).
-- -----------------------------------------------------------------------------
create table public.series (
  id                uuid primary key default gen_random_uuid(),
  oficina_id        uuid not null references public.oficinas (id) on delete restrict,
  padre_id          uuid references public.series (id) on delete cascade,
  codigo            text not null,
  nombre            text not null,
  nivel             public.nivel_serie not null,
  -- Soportes
  soporte_fisico    boolean not null default false,
  soporte_digital   boolean not null default false,
  -- Retención (años)
  anios_gestion     int,
  anios_central     int,
  -- Disposición final
  disp_conservacion boolean not null default false,
  disp_seleccion    boolean not null default false,
  disp_eliminacion  boolean not null default false,
  disp_digital      boolean not null default false,
  procedimiento     text,
  -- Estado del flujo de aprobación de la TRD de la oficina
  estado_aprobacion public.estado_trd not null default 'borrador',
  version           int not null default 1,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  unique (oficina_id, codigo, nivel)
);
create index series_oficina_idx on public.series (oficina_id);
create index series_padre_idx on public.series (padre_id);

comment on table public.series is
  'Entradas de la TRD (series, subseries y tipos documentales) por oficina.';

create trigger series_tocar_before_update
  before update on public.series
  for each row execute function public.tocar_actualizado();

-- -----------------------------------------------------------------------------
-- 3. Bitácora de aprobación de la TRD (append-only) por oficina.
-- -----------------------------------------------------------------------------
create table public.aprobaciones_trd (
  id         uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas (id) on delete cascade,
  estado     public.estado_trd not null,
  usuario_id uuid references public.perfiles (usuario_id) on delete set null,
  comentario text,
  creado_en  timestamptz not null default now()
);
create index aprobaciones_trd_oficina_idx on public.aprobaciones_trd (oficina_id);

comment on table public.aprobaciones_trd is
  'Historial de cambios de estado de la TRD de una oficina (solo inserciones).';

-- -----------------------------------------------------------------------------
-- 4. Protección del estado de aprobación: solo un aprobador (admin+) puede
--    pasar una serie a 'aprobado' o 'rechazado'. El gestor elabora pero no
--    aprueba.
-- -----------------------------------------------------------------------------
create or replace function public.proteger_estado_trd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado_aprobacion in ('aprobado', 'rechazado')
     and old.estado_aprobacion is distinct from new.estado_aprobacion
     and not public.puede_aprobar_trd() then
    raise exception 'Solo un aprobador puede aprobar o rechazar la TRD';
  end if;
  return new;
end;
$$;

create trigger series_proteger_estado_before_update
  before update on public.series
  for each row execute function public.proteger_estado_trd();

-- -----------------------------------------------------------------------------
-- 5. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.series enable row level security;
alter table public.aprobaciones_trd enable row level security;

-- series: lectura para cualquier rol activo; escritura para quien elabora
-- (gestor+). El cambio a aprobado/rechazado lo controla el trigger de arriba.
create policy "series_select" on public.series
  for select to authenticated using (public.es_lector());
create policy "series_insert" on public.series
  for insert to authenticated with check (public.puede_elaborar());
create policy "series_update" on public.series
  for update to authenticated
  using (public.puede_elaborar()) with check (public.puede_elaborar());
create policy "series_delete" on public.series
  for delete to authenticated using (public.puede_aprobar_trd());

-- aprobaciones_trd: lectura para cualquier rol activo; inserción solo aprobador.
create policy "aprobaciones_trd_select" on public.aprobaciones_trd
  for select to authenticated using (public.es_lector());
create policy "aprobaciones_trd_insert" on public.aprobaciones_trd
  for insert to authenticated with check (public.puede_aprobar_trd());

grant select, insert, update, delete on public.series to authenticated;
grant select, insert on public.aprobaciones_trd to authenticated;


-- >>>>>>>>>> 0003_documentos.sql <<<<<<<<<<

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


-- >>>>>>>>>> 0004_seed.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — 0004 Semilla de datos (rediseño)
-- Estructura organizacional de ejemplo de una institución educativa, algunas
-- oficinas y el pre-registro de los usuarios semilla. Idempotente: UUIDs fijos
-- + `on conflict do nothing` sobre claves naturales.
--
-- Los perfiles reales se crean al primer login con Google (trigger
-- handle_new_user). El bloque de backfill del final crea perfiles para las
-- cuentas de auth.users que ya existieran (p. ej. tras reinstalar el esquema).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Ejes
-- -----------------------------------------------------------------------------
insert into public.unidades (id, tipo, codigo, nombre, padre_id) values
  ('11111111-1111-1111-1111-111111111101', 'eje', 'E1', 'Direccionamiento Estratégico', null),
  ('11111111-1111-1111-1111-111111111102', 'eje', 'E2', 'Misional / Académico', null),
  ('11111111-1111-1111-1111-111111111103', 'eje', 'E3', 'Apoyo', null),
  ('11111111-1111-1111-1111-111111111104', 'eje', 'E4', 'Evaluación y Control', null)
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Macroprocesos
-- -----------------------------------------------------------------------------
insert into public.unidades (id, tipo, codigo, nombre, padre_id) values
  ('22222222-2222-2222-2222-222222222201', 'macroproceso', 'M1', 'Planeación', '11111111-1111-1111-1111-111111111101'),
  ('22222222-2222-2222-2222-222222222202', 'macroproceso', 'M2', 'Gestión de Calidad', '11111111-1111-1111-1111-111111111101'),
  ('22222222-2222-2222-2222-222222222203', 'macroproceso', 'M3', 'Docencia', '11111111-1111-1111-1111-111111111102'),
  ('22222222-2222-2222-2222-222222222204', 'macroproceso', 'M4', 'Investigación', '11111111-1111-1111-1111-111111111102'),
  ('22222222-2222-2222-2222-222222222205', 'macroproceso', 'M5', 'Extensión', '11111111-1111-1111-1111-111111111102'),
  ('22222222-2222-2222-2222-222222222206', 'macroproceso', 'M6', 'Gestión Documental', '11111111-1111-1111-1111-111111111103'),
  ('22222222-2222-2222-2222-222222222207', 'macroproceso', 'M7', 'Talento Humano', '11111111-1111-1111-1111-111111111103'),
  ('22222222-2222-2222-2222-222222222208', 'macroproceso', 'M8', 'Gestión Financiera', '11111111-1111-1111-1111-111111111103'),
  ('22222222-2222-2222-2222-222222222209', 'macroproceso', 'M9', 'Gestión de TI', '11111111-1111-1111-1111-111111111103'),
  ('22222222-2222-2222-2222-222222222210', 'macroproceso', 'M10', 'Control Interno', '11111111-1111-1111-1111-111111111104')
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Procesos
-- -----------------------------------------------------------------------------
insert into public.unidades (id, tipo, codigo, nombre, padre_id) values
  ('33333333-3333-3333-3333-333333333301', 'proceso', 'P1', 'Planeación Institucional', '22222222-2222-2222-2222-222222222201'),
  ('33333333-3333-3333-3333-333333333302', 'proceso', 'P2', 'Aseguramiento de la Calidad', '22222222-2222-2222-2222-222222222202'),
  ('33333333-3333-3333-3333-333333333303', 'proceso', 'P3', 'Admisiones y Registro', '22222222-2222-2222-2222-222222222203'),
  ('33333333-3333-3333-3333-333333333304', 'proceso', 'P4', 'Investigación', '22222222-2222-2222-2222-222222222204'),
  ('33333333-3333-3333-3333-333333333305', 'proceso', 'P5', 'Proyección Social', '22222222-2222-2222-2222-222222222205'),
  ('33333333-3333-3333-3333-333333333306', 'proceso', 'P6', 'Archivo', '22222222-2222-2222-2222-222222222206'),
  ('33333333-3333-3333-3333-333333333307', 'proceso', 'P7', 'Nómina y Personal', '22222222-2222-2222-2222-222222222207'),
  ('33333333-3333-3333-3333-333333333308', 'proceso', 'P8', 'Tesorería', '22222222-2222-2222-2222-222222222208'),
  ('33333333-3333-3333-3333-333333333309', 'proceso', 'P9', 'Sistemas', '22222222-2222-2222-2222-222222222209'),
  ('33333333-3333-3333-3333-333333333310', 'proceso', 'P10', 'Auditoría Interna', '22222222-2222-2222-2222-222222222210')
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Oficinas productoras (una por proceso clave)
-- -----------------------------------------------------------------------------
insert into public.oficinas (id, unidad_id, codigo, nombre, ubicacion_fisica, ubicacion_digital) values
  ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', '100', 'Rectoría', 'Bloque A - Piso 3', '/rectoria'),
  ('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333306', '300', 'Gestión Documental', 'Bloque B - Archivo Central', '/gestion-documental'),
  ('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333307', '310', 'Talento Humano', 'Bloque A - Piso 1', '/talento-humano'),
  ('44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333308', '320', 'Tesorería', 'Bloque A - Piso 1', '/tesoreria')
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Usuarios semilla (pre-registro). El perfil real se crea al primer login.
-- desarrolloweb@cotecnova.edu.co NO necesita fila: el trigger lo activa como
-- superadmin directamente.
-- -----------------------------------------------------------------------------
insert into public.usuarios_semilla (email, nombre, rol, unidad_id, oficina_id, notas) values
  ('rector@cotecnova.edu.co', 'Rector Cotecnova', 'rector',
     '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444401',
     'Cuenta institucional del Rector.'),
  ('gestiondocumental@cotecnova.edu.co', 'Gestión Documental', 'administrador',
     '33333333-3333-3333-3333-333333333306', '44444444-4444-4444-4444-444444444402',
     'Administrador del archivo y la TRD.')
on conflict (email) do nothing;

-- -----------------------------------------------------------------------------
-- Backfill: perfiles para cuentas de auth.users que ya existan. El trigger solo
-- dispara en nuevos INSERT; esto cubre cuentas creadas antes de esta migración.
-- -----------------------------------------------------------------------------
insert into public.perfiles (usuario_id, email, nombre_completo, rol, unidad_id, activo)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email),
  case
    when lower(u.email) = 'desarrolloweb@cotecnova.edu.co' then 'superadmin'::public.rol_usuario
    when s.rol is not null then s.rol
    else 'pendiente'::public.rol_usuario
  end,
  s.unidad_id,
  case
    when lower(u.email) = 'desarrolloweb@cotecnova.edu.co' then true
    when s.rol is not null and s.rol <> 'pendiente' then true
    else false
  end
from auth.users u
left join public.usuarios_semilla s on s.email = lower(u.email)
on conflict (usuario_id) do nothing;

commit;


-- >>>>>>>>>> 0005_carga_masiva.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — 0005 Carga masiva
-- Habilita el "upsert" por (oficina_id, codigo) en documentos para la carga
-- masiva por Excel. unidades.codigo, oficinas.codigo y
-- series(oficina_id, codigo, nivel) ya tienen las restricciones únicas
-- necesarias (ver 0001/0002).
-- =============================================================================

-- Índice único para permitir ON CONFLICT (oficina_id, codigo). Los códigos
-- nulos se consideran distintos entre sí, así que los documentos sin código
-- siguen permitiéndose (y siempre se insertan como nuevos en la importación).
create unique index if not exists documentos_oficina_codigo_key
  on public.documentos (oficina_id, codigo);


-- >>>>>>>>>> 0006_notificaciones.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — 0006 Notificaciones
-- Sistema de notificaciones internas: cada evento relevante (TRD enviada a
-- revisión, aprobada/rechazada; documento activado/archivado; registro
-- completado/anulado) genera notificaciones para sus destinatarios naturales.
-- El destinatario las ve en la campanita del topbar y en la página /notificaciones.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enumeración de tipos de notificación
-- -----------------------------------------------------------------------------
create type public.tipo_notificacion as enum (
  'trd_enviada_revision',
  'trd_aprobada',
  'trd_rechazada',
  'documento_activado',
  'documento_archivado',
  'registro_completado',
  'registro_anulado'
);

-- -----------------------------------------------------------------------------
-- 2. Tabla
-- -----------------------------------------------------------------------------
create table public.notificaciones (
  id            uuid primary key default gen_random_uuid(),
  destinatario  uuid not null references public.perfiles (usuario_id) on delete cascade,
  tipo          public.tipo_notificacion not null,
  asunto        text not null,
  mensaje       text,
  entidad_tipo  text,     -- 'serie' | 'oficina' | 'documento' | 'registro'
  entidad_id    uuid,
  leida         boolean not null default false,
  creado_en     timestamptz not null default now()
);
create index notificaciones_destinatario_idx
  on public.notificaciones (destinatario, leida, creado_en desc);

comment on table public.notificaciones is
  'Notificaciones internas dirigidas a un destinatario (usuario). Se emiten
   automáticamente desde las server actions al ocurrir eventos relevantes.';

-- -----------------------------------------------------------------------------
-- 3. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.notificaciones enable row level security;

-- El destinatario ve sus notificaciones; el admin de usuarios ve todas.
create policy "notificaciones_select_propias" on public.notificaciones
  for select to authenticated
  using (destinatario = auth.uid() or public.es_admin_usuarios());

-- Solo el destinatario marca como leída (o cualquier otro cambio menor).
create policy "notificaciones_update_propias" on public.notificaciones
  for update to authenticated
  using (destinatario = auth.uid())
  with check (destinatario = auth.uid());

-- Cualquier rol activo puede insertar: las server actions actuales corren con
-- el rol authenticated del usuario que dispara el evento (elabora/aprueba/etc.)
-- y necesitan poder crear filas para otros destinatarios. La RLS de lectura
-- garantiza que el destinatario solo verá lo suyo.
create policy "notificaciones_insert_lector" on public.notificaciones
  for insert to authenticated
  with check (public.es_lector());

-- Borrado solo para el admin de usuarios (limpieza).
create policy "notificaciones_delete_admin" on public.notificaciones
  for delete to authenticated using (public.es_admin_usuarios());

grant select, insert, update, delete on public.notificaciones to authenticated;


-- >>>>>>>>>> 0007_impersonacion.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — 0007 Impersonación (auditoría)
-- Registro de auditoría de la función "iniciar sesión como" del módulo de
-- Gestión: un administrador de usuarios (superadmin/rector) puede abrir una
-- sesión como otro usuario para verificar lo que ese rol ve. Cada inicio y fin
-- queda registrado. La sesión se forja en el servidor con la service_role key;
-- estas inserciones las hace el cliente de servicio (omite RLS).
-- =============================================================================

create table public.impersonacion_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid not null references auth.users (id) on delete cascade,
  actor_email   text not null,
  objetivo_id   uuid not null references auth.users (id) on delete cascade,
  objetivo_email text not null,
  accion        text not null check (accion in ('inicio', 'fin')),
  creado_en     timestamptz not null default now()
);
create index impersonacion_log_actor_idx on public.impersonacion_log (actor_id);
create index impersonacion_log_creado_idx on public.impersonacion_log (creado_en);

comment on table public.impersonacion_log is
  'Auditoría de la impersonación de usuarios (iniciar/terminar sesión como).';

alter table public.impersonacion_log enable row level security;

-- Solo el administrador de usuarios puede leer la auditoría. Las inserciones las
-- realiza el cliente de servicio (service_role), que no está sujeto a RLS.
create policy "impersonacion_log_select" on public.impersonacion_log
  for select to authenticated
  using (public.es_admin_usuarios());

grant select on public.impersonacion_log to authenticated;


-- >>>>>>>>>> 0008_trd_revision_gestor.sql <<<<<<<<<<

-- =============================================================================
-- DocuNOVA — 0008 TRD: quien elabora puede enviar a revisión
-- Corrige la RLS de `aprobaciones_trd`: el historial solo permitía insertar a
-- un aprobador (puede_aprobar_trd), pero enviar a revisión lo hace quien elabora
-- (gestor+). Al enviar, la serie cambiaba de estado pero el insert del historial
-- fallaba y se mostraba una página de error. Ahora quien elabora puede registrar
-- el estado 'en_revision'; 'aprobado'/'rechazado' siguen restringidos a
-- aprobadores (además del trigger proteger_estado_trd sobre `series`).
-- =============================================================================

drop policy if exists "aprobaciones_trd_insert" on public.aprobaciones_trd;

create policy "aprobaciones_trd_insert" on public.aprobaciones_trd
  for insert to authenticated
  with check (
    public.puede_aprobar_trd()
    or (public.puede_elaborar() and estado = 'en_revision')
  );


-- >>>>>>>>>> 0009_memoria_corporativa.sql <<<<<<<<<<

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

