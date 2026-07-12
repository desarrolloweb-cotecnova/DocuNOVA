-- =============================================================================
-- DocuNOVA — Activación inicial del Super Administrador (bootstrap)
--
-- Ejecuta esto UNA sola vez en el SQL Editor de Supabase para activar la cuenta
-- desarrolloweb@cotecnova.edu.co como superadmin. Es necesario cuando ese correo
-- inició sesión antes de que existiera el mecanismo de activación automática
-- (o la base se reinstaló después). A partir de aquí, esa cuenta podrá activar a
-- las demás desde Gestión → Usuarios.
--
-- Requisito: la persona ya debe haber iniciado sesión al menos una vez (para
-- que exista su usuario en auth.users). Si aún no lo has hecho, entra primero a
-- la app con ese correo (verás "cuenta pendiente") y luego corre esto.
-- =============================================================================

-- Se desactiva temporalmente el guard anti-escalada para poder fijar el rol.
alter table public.perfiles disable trigger perfiles_proteger_before_update;

insert into public.perfiles (usuario_id, email, nombre_completo, rol, activo)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email),
  'superadmin',
  true
from auth.users u
where lower(u.email) = 'desarrolloweb@cotecnova.edu.co'
on conflict (usuario_id) do update
  set rol = 'superadmin',
      activo = true;

alter table public.perfiles enable trigger perfiles_proteger_before_update;

-- Verificación: debe mostrar la cuenta como superadmin y activa.
select email, rol, activo
from public.perfiles
where lower(email) = 'desarrolloweb@cotecnova.edu.co';
