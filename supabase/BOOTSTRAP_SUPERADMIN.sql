-- =============================================================================
-- DocuNOVA — Activación inicial del Super Administrador (bootstrap)
--
-- Ejecuta esto UNA sola vez en el SQL Editor de Supabase para activar la cuenta
-- desarrolloweb@cotecnova.edu.co como Super Administrador. Es necesario cuando
-- ese correo inició sesión antes de que existiera el mecanismo de activación
-- automática (o la base se reinstaló después). A partir de aquí, esa cuenta
-- podrá activar a las demás desde Administración → Usuarios.
--
-- Requisito: la persona ya debe haber iniciado sesión al menos una vez (para
-- que exista su usuario en auth.users). Si aún no lo has hecho, entra primero
-- a la app con ese correo (verás "cuenta pendiente"), y luego corre esto.
-- =============================================================================

-- Se desactiva temporalmente el guard anti-escalada para poder fijar el rol.
alter table public.profiles disable trigger protect_profile_privileges_before_update;

insert into public.profiles (id, email, full_name, role, is_active)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email),
  'super_admin',
  true
from auth.users u
where lower(u.email) = 'desarrolloweb@cotecnova.edu.co'
on conflict (id) do update
  set role = 'super_admin',
      is_active = true;

alter table public.profiles enable trigger protect_profile_privileges_before_update;

-- Verificación: debe mostrar la cuenta como super_admin y activa.
select email, role, is_active
from public.profiles
where lower(email) = 'desarrolloweb@cotecnova.edu.co';
