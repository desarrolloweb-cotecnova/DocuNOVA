-- Migración 0012: revocar las sesiones de un usuario desde el servidor.
--
-- La usa el Server Action `restablecerMfa`: al restablecer el segundo factor de
-- alguien hay que cerrar sus sesiones abiertas, porque siguen elevadas a aal2 y
-- mantendrían el acceso pese al reset.
--
-- No existe un método admin en supabase-js para cerrar sesión por `userId`
-- (`auth.admin.signOut()` exige el JWT del propio usuario, que el servidor no
-- tiene), y el esquema `auth` no está expuesto por PostgREST. De ahí esta
-- función SECURITY DEFINER.
--
-- El permiso de ejecución es exclusivo de `service_role`: solo puede invocarla
-- el servidor, nunca el navegador.

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eliminadas integer;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id es obligatorio';
  END IF;

  DELETE FROM auth.sessions WHERE user_id = target_user_id;
  GET DIAGNOSTICS eliminadas = ROW_COUNT;
  RETURN eliminadas;
END;
$$;

COMMENT ON FUNCTION public.admin_revoke_user_sessions IS
  'Cierra todas las sesiones de un usuario. Reservada a service_role; la usa el Server Action restablecerMfa.';

REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid) TO service_role;
