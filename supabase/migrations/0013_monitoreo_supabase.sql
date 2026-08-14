-- Migración 0013: Monitoreo de Supabase y keepalive del Plan Free.
--
-- El proyecto de Supabase está en Plan Free: si no recibe actividad durante una
-- semana, Supabase lo pausa y DocuNOVA queda sin base de datos. Esta migración
-- aporta dos cosas:
--
--   1. Funciones de solo lectura (monitor_*) con las métricas de uso del
--      proyecto (tamaño de la BD, tablas más pesadas, conexiones, usuarios de
--      Auth y Storage) que alimentan el módulo de Configuración.
--   2. El keepalive: una tabla con la marca del último "latido" y la función
--      que lo registra, más un cron interno de respaldo (pg_cron).
--
-- Seguridad: todas las funciones son SECURITY DEFINER porque leen catálogos del
-- sistema y los esquemas auth/storage, así que el permiso de ejecución queda
-- reservado a `service_role` (igual que en la migración 0012). Solo el servidor
-- de DocuNOVA las invoca, tras comprobar el rol del usuario; el navegador nunca
-- puede llamarlas.

-- ---------------------------------------------------------------------------
-- 1. Métricas
-- ---------------------------------------------------------------------------

-- Tamaño total de la base de datos.
CREATE OR REPLACE FUNCTION public.monitor_get_db_size()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'size_bytes', pg_database_size(current_database()),
    'size_pretty', pg_size_pretty(pg_database_size(current_database()))
  );
$$;

-- Las 10 tablas que más espacio ocupan (datos + índices + toast).
CREATE OR REPLACE FUNCTION public.monitor_get_table_sizes()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(t), '[]'::json) FROM (
    SELECT
      schemaname,
      tablename,
      pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)) AS size_bytes,
      pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))) AS size_pretty
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)) DESC
    LIMIT 10
  ) t;
$$;

-- Conexiones abiertas contra la base de datos.
CREATE OR REPLACE FUNCTION public.monitor_get_active_connections()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'active_count', COUNT(*) FILTER (WHERE state = 'active'),
    'idle_count',   COUNT(*) FILTER (WHERE state = 'idle'),
    'total_count',  COUNT(*)
  )
  FROM pg_stat_activity
  WHERE datname = current_database();
$$;

-- Usuarios registrados en Auth.
CREATE OR REPLACE FUNCTION public.monitor_get_auth_users_count()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'total_users',       COUNT(*),
    'confirmed_users',   COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL),
    'unconfirmed_users', COUNT(*) FILTER (WHERE email_confirmed_at IS NULL)
  )
  FROM auth.users;
$$;

-- Uso de Storage (archivos y bytes) y buckets configurados.
CREATE OR REPLACE FUNCTION public.monitor_get_storage_stats()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'total_files',       COUNT(*),
    'total_size_bytes',  COALESCE(SUM((metadata->>'size')::bigint), 0),
    'total_size_pretty', pg_size_pretty(COALESCE(SUM((metadata->>'size')::bigint), 0))
  )
  FROM storage.objects
  WHERE bucket_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.monitor_get_buckets()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    json_agg(json_build_object('name', name, 'public', public) ORDER BY name),
    '[]'::json
  )
  FROM storage.buckets;
$$;

-- ---------------------------------------------------------------------------
-- 2. Keepalive
-- ---------------------------------------------------------------------------

-- Bitácora del keepalive: una sola fila (id = 1) con la marca del último latido
-- y su origen ('cron-externo' desde GitHub Actions, 'cron-bd' desde pg_cron,
-- 'manual' desde el botón del módulo de Configuración).
CREATE TABLE IF NOT EXISTS public.monitoreo_keepalive (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ultimo_latido timestamptz NOT NULL DEFAULT now(),
  origen text NOT NULL DEFAULT 'desconocido',
  total_latidos bigint NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.monitoreo_keepalive IS
  'Marca del último latido que mantiene despierto el proyecto de Supabase (Plan Free).';

INSERT INTO public.monitoreo_keepalive (id, origen, total_latidos)
VALUES (1, 'inicial', 0)
ON CONFLICT (id) DO NOTHING;

-- RLS activa: la fila se lee desde el servidor (service_role, que omite RLS) y
-- nadie más tiene políticas, así que el navegador no puede tocarla.
ALTER TABLE public.monitoreo_keepalive ENABLE ROW LEVEL SECURITY;

-- Registra un latido y devuelve el estado resultante. La consulta a
-- pg_database_size() obliga a un trabajo real en la base de datos, no solo una
-- escritura en caché.
CREATE OR REPLACE FUNCTION public.monitor_keepalive(p_origen text DEFAULT 'desconocido')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fila public.monitoreo_keepalive;
BEGIN
  INSERT INTO public.monitoreo_keepalive AS k (id, ultimo_latido, origen, total_latidos)
  VALUES (1, now(), COALESCE(NULLIF(trim(p_origen), ''), 'desconocido'), 1)
  ON CONFLICT (id) DO UPDATE
    SET ultimo_latido = now(),
        origen = EXCLUDED.origen,
        total_latidos = k.total_latidos + 1
  RETURNING * INTO fila;

  RETURN json_build_object(
    'ultimo_latido', fila.ultimo_latido,
    'origen', fila.origen,
    'total_latidos', fila.total_latidos,
    'size_bytes', pg_database_size(current_database())
  );
END;
$$;

-- Estado del keepalive sin registrar un latido nuevo (lo lee el módulo de
-- Configuración al pintar la pantalla).
CREATE OR REPLACE FUNCTION public.monitor_keepalive_estado()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'ultimo_latido', ultimo_latido,
    'origen', origen,
    'total_latidos', total_latidos
  )
  FROM public.monitoreo_keepalive
  WHERE id = 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Permisos: solo el servidor (service_role)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.monitor_get_db_size()',
    'public.monitor_get_table_sizes()',
    'public.monitor_get_active_connections()',
    'public.monitor_get_auth_users_count()',
    'public.monitor_get_storage_stats()',
    'public.monitor_get_buckets()',
    'public.monitor_keepalive(text)',
    'public.monitor_keepalive_estado()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cron interno de respaldo (pg_cron)
-- ---------------------------------------------------------------------------
-- El latido principal es el externo (GitHub Actions -> /api/keepalive), porque
-- Supabase mide la inactividad por peticiones al proyecto. Este cron interno es
-- la red de seguridad: mantiene la BD trabajando cada 3 días a las 06:00 UTC.
-- Si la extensión pg_cron no está habilitada en el proyecto, la migración
-- continúa sin fallar (se puede activar en Database → Extensions).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    PERFORM cron.unschedule('docunova-keepalive')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'docunova-keepalive');

    PERFORM cron.schedule(
      'docunova-keepalive',
      '0 6 */3 * *',
      $cron$SELECT public.monitor_keepalive('cron-bd');$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron no está disponible: se omite el cron interno de keepalive.';
  END IF;
END;
$$;
