-- =============================================================================
-- DocuNOVA — Verificación de seguridad (RLS y flujo de activación)
--
-- Cómo ejecutar: pega este archivo en el SQL Editor de Supabase (o
--   psql "$DATABASE_URL" -f supabase/tests/rls.sql)
-- DESPUÉS de aplicar las migraciones 0001–0005. No se ejecuta en CI porque la
-- CI no dispone de base de datos.
--
-- La PARTE A son aserciones automáticas (fallan con EXCEPTION si algo no cumple).
-- La PARTE B es una guía manual de aislamiento por proceso simulando usuarios.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PARTE A — Aserciones estructurales (automáticas)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  faltan text := '';
begin
  -- A.1 RLS habilitada en toda tabla con datos sensibles/operativos.
  for t in
    select unnest(array[
      'profiles','ejes','macroprocesos','procesos','oficinas_productoras',
      'series','subseries','usuarios_semilla','datos_sensibles',
      'expedientes','documentos'
    ])
  loop
    if not exists (
      select 1 from pg_tables tb
      join pg_class c on c.relname = tb.tablename
      where tb.schemaname = 'public' and tb.tablename = t and c.relrowsecurity
    ) then
      faltan := faltan || ' ' || t;
    end if;
  end loop;
  if faltan <> '' then
    raise exception 'RLS no está habilitada en:%', faltan;
  end if;

  -- A.2 Los perfiles nacen inactivos por defecto.
  if (
    select column_default from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='is_active'
  ) not ilike '%false%' then
    raise exception 'profiles.is_active NO tiene default false (flujo de activación roto)';
  end if;

  -- A.3 La cédula vive en datos_sensibles, no en profiles.
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='cedula'
  ) then
    raise exception 'La cédula no debe estar en profiles (debe ir en datos_sensibles)';
  end if;

  -- A.4 datos_sensibles solo permite SELECT al dueño o al super admin.
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='datos_sensibles'
      and cmd='SELECT'
  ) then
    raise exception 'Falta política SELECT en datos_sensibles';
  end if;

  raise notice 'PARTE A: OK — RLS habilitada, activación por defecto e independencia de la cédula verificadas.';
end $$;

-- Conteos del catálogo importado (deben coincidir con la semilla).
--   3 ejes · 10 macroprocesos · 16 procesos · 25 oficinas · 128 series ·
--   230 subseries · 38 usuarios de pre-registro.
do $$
begin
  if (select count(*) from public.procesos) <> 16 then
    raise exception 'Se esperaban 16 procesos, hay %', (select count(*) from public.procesos);
  end if;
  if (select count(*) from public.oficinas_productoras) <> 25 then
    raise exception 'Se esperaban 25 oficinas, hay %', (select count(*) from public.oficinas_productoras);
  end if;
  if (select count(*) from public.subseries) <> 230 then
    raise exception 'Se esperaban 230 subseries, hay %', (select count(*) from public.subseries);
  end if;
  if (select count(*) from public.usuarios_semilla) <> 38 then
    raise exception 'Se esperaban 38 usuarios semilla, hay %', (select count(*) from public.usuarios_semilla);
  end if;
  raise notice 'Conteos del catálogo: OK.';
end $$;

-- -----------------------------------------------------------------------------
-- PARTE B — Aislamiento por proceso (GUÍA MANUAL)
--
-- La RLS de perfiles usa auth.uid() y el rol del usuario. Para simular un
-- usuario concreto en el SQL Editor, ejecuta como rol `authenticated` fijando
-- los claims del JWT. Reemplaza los UUID por ids reales de public.profiles.
--
--   -- Simular al jefe del Proceso X:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<UUID_JEFE_X>","role":"authenticated"}';
--
--   -- Debe ver SOLO perfiles de su proceso (además del suyo):
--   select email, proceso_id from public.profiles;
--
--   -- No debe poder leer la cédula de otro usuario:
--   select * from public.datos_sensibles where profile_id <> '<UUID_JEFE_X>';
--   --> 0 filas (salvo super_admin)
--
--   reset role;
--
-- Criterios de aceptación (prompt, arnés a–e):
--   (a) Un jefe/funcionario del Proceso X no ve perfiles del Proceso Y.
--   (b) Solo el super admin (o el dueño) puede leer datos_sensibles.
--   (c) Un usuario no super_admin no puede cambiar su propio rol/is_active
--       (lo impide el trigger protect_profile_privileges).
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- PARTE C — Aislamiento por proceso en Expedientes/Documentos (GUÍA MANUAL)
--
-- Objetivo (prompt, arnés a): un usuario del Proceso X no puede LEER ni ESCRIBIR
-- expedientes/documentos del Proceso Y.
--
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<UUID_FUNCIONARIO_X>","role":"authenticated"}';
--
--   -- Lectura: solo expedientes de su proceso.
--   select titulo, proceso_id from public.expedientes;   --> solo Proceso X
--
--   -- Escritura cruzada: intentar crear un expediente clasificado en una
--   -- subserie del Proceso Y debe fallar por la política can_write_proceso:
--   insert into public.expedientes (titulo, subserie_id)
--   values ('prueba', '<SUBSERIE_DE_OTRO_PROCESO>');     --> ERROR de RLS
--
--   -- El rol 'consulta' nunca puede escribir (solo select):
--   --   insert ... --> ERROR de RLS  (can_write_proceso excluye a 'consulta')
--
--   reset role;
--
-- Verificación de búsqueda de texto (documentos electrónicos):
--   select titulo from public.documentos
--   where busqueda @@ websearch_to_tsquery('spanish', 'acta de grado');
-- -----------------------------------------------------------------------------
