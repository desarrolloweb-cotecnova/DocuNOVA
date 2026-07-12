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
