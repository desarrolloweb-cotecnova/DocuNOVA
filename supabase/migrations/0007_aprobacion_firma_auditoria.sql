-- =============================================================================
-- DocuNOVA — Fase 3: Flujos de aprobación, firma electrónica simple y auditoría.
--
-- Un documento puede enviarse a un flujo de aprobación con uno o varios
-- aprobadores en secuencia. Cada aprobación registra una firma electrónica
-- simple (usuario, rol, fecha/hora, IP y hash del documento). Toda acción del
-- flujo se anota en una bitácora de auditoría append-only (Ley 527 de 1999
-- para la firma; §7 del alcance para la trazabilidad).
--
-- La lógica del flujo vive en funciones SECURITY DEFINER (crear_solicitud /
-- decidir_paso) que validan la autorización con auth.uid(): así la integridad
-- del flujo no depende del cliente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Solicitudes de aprobación (una por "ronda" de aprobación de un documento)
-- -----------------------------------------------------------------------------
create table public.aprobacion_solicitudes (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  proceso_id   uuid references public.procesos (id) on delete restrict,
  estado       text not null default 'en_curso'
                 check (estado in ('en_curso', 'aprobado', 'rechazado', 'cancelado')),
  paso_actual  integer not null default 1,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index aprob_solic_documento_idx on public.aprobacion_solicitudes (documento_id);
create index aprob_solic_proceso_idx on public.aprobacion_solicitudes (proceso_id);

-- -----------------------------------------------------------------------------
-- 2. Pasos del flujo (aprobadores en secuencia)
-- -----------------------------------------------------------------------------
create table public.aprobacion_pasos (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.aprobacion_solicitudes (id) on delete cascade,
  orden        integer not null,
  aprobador_id uuid not null references public.profiles (id) on delete restrict,
  estado       text not null default 'pendiente'
                 check (estado in ('pendiente', 'aprobado', 'rechazado')),
  comentario   text,
  decidido_at  timestamptz,
  proceso_id   uuid references public.procesos (id) on delete restrict,
  created_at   timestamptz not null default now(),
  unique (solicitud_id, orden)
);
create index aprob_pasos_solicitud_idx on public.aprobacion_pasos (solicitud_id);
create index aprob_pasos_aprobador_idx on public.aprobacion_pasos (aprobador_id);

-- -----------------------------------------------------------------------------
-- 3. Firmas electrónicas (append-only). tipo_firma deja abierto un proveedor
--    externo de firma certificada en una fase posterior (no implementado aún).
-- -----------------------------------------------------------------------------
create table public.firmas (
  id             uuid primary key default gen_random_uuid(),
  documento_id   uuid not null references public.documentos (id) on delete cascade,
  paso_id        uuid references public.aprobacion_pasos (id) on delete set null,
  firmante_id    uuid references public.profiles (id) on delete set null,
  rol_snapshot   text,
  tipo_firma     text not null default 'simple',
  hash_documento text,
  ip             text,
  proceso_id     uuid references public.procesos (id) on delete restrict,
  created_at     timestamptz not null default now()
);
create index firmas_documento_idx on public.firmas (documento_id);

-- -----------------------------------------------------------------------------
-- 4. Bitácora de auditoría (append-only)
-- -----------------------------------------------------------------------------
create table public.auditoria (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles (id) on delete set null,
  accion       text not null,
  entidad_tipo text,
  entidad_id   uuid,
  detalle      jsonb,
  ip           text,
  created_at   timestamptz not null default now()
);
create index auditoria_entidad_idx on public.auditoria (entidad_tipo, entidad_id);
create index auditoria_actor_idx on public.auditoria (actor_id);

comment on table public.auditoria is
  'Bitácora append-only de acciones sensibles. Sin UPDATE ni DELETE (ver grants).';

-- -----------------------------------------------------------------------------
-- 5. Función interna de auditoría (reutilizable)
-- -----------------------------------------------------------------------------
create or replace function public.registrar_auditoria(
  p_accion text,
  p_entidad_tipo text,
  p_entidad_id uuid,
  p_detalle jsonb default '{}'::jsonb,
  p_ip text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.auditoria (actor_id, accion, entidad_tipo, entidad_id, detalle, ip)
  values (auth.uid(), p_accion, p_entidad_tipo, p_entidad_id, coalesce(p_detalle, '{}'::jsonb), p_ip);
$$;

-- -----------------------------------------------------------------------------
-- 6. Crear una solicitud de aprobación con sus pasos (aprobadores en orden)
-- -----------------------------------------------------------------------------
create or replace function public.crear_solicitud(
  p_documento uuid,
  p_aprobadores uuid[],
  p_ip text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proceso uuid;
  v_solicitud uuid;
  v_aprobador uuid;
  v_orden int := 0;
begin
  if array_length(p_aprobadores, 1) is null then
    raise exception 'Debe indicar al menos un aprobador';
  end if;

  select proceso_id into v_proceso from public.documentos where id = p_documento;
  if v_proceso is null then
    raise exception 'Documento inexistente';
  end if;

  -- Autorización: solo quien puede escribir en el proceso puede iniciar el flujo.
  if not public.can_write_proceso(v_proceso) then
    raise exception 'No autorizado para iniciar la aprobación de este documento';
  end if;

  -- No permitir dos flujos en curso para el mismo documento.
  if exists (
    select 1 from public.aprobacion_solicitudes
    where documento_id = p_documento and estado = 'en_curso'
  ) then
    raise exception 'El documento ya tiene un flujo de aprobación en curso';
  end if;

  insert into public.aprobacion_solicitudes (documento_id, proceso_id, created_by)
  values (p_documento, v_proceso, auth.uid())
  returning id into v_solicitud;

  foreach v_aprobador in array p_aprobadores loop
    v_orden := v_orden + 1;
    insert into public.aprobacion_pasos (solicitud_id, orden, aprobador_id, proceso_id)
    values (v_solicitud, v_orden, v_aprobador, v_proceso);
  end loop;

  perform public.registrar_auditoria(
    'aprobacion.solicitud_creada', 'documento', p_documento,
    jsonb_build_object('solicitud_id', v_solicitud, 'pasos', array_length(p_aprobadores, 1)),
    p_ip
  );

  return v_solicitud;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Decidir un paso (aprobar -> firma electrónica simple; o rechazar)
-- -----------------------------------------------------------------------------
create or replace function public.decidir_paso(
  p_paso uuid,
  p_decision text,
  p_comentario text default null,
  p_hash text default null,
  p_ip text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paso public.aprobacion_pasos%rowtype;
  v_solic public.aprobacion_solicitudes%rowtype;
  v_total int;
  v_rol public.user_role;
begin
  if p_decision not in ('aprobado', 'rechazado') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_paso from public.aprobacion_pasos where id = p_paso;
  if not found then raise exception 'Paso inexistente'; end if;

  -- Solo el aprobador asignado puede decidir su paso.
  if v_paso.aprobador_id <> auth.uid() then
    raise exception 'Solo el aprobador asignado puede decidir este paso';
  end if;

  select * into v_solic from public.aprobacion_solicitudes where id = v_paso.solicitud_id;
  if v_solic.estado <> 'en_curso' then
    raise exception 'La solicitud no está en curso';
  end if;
  if v_paso.orden <> v_solic.paso_actual then
    raise exception 'Aún no es el turno de este paso';
  end if;
  if v_paso.estado <> 'pendiente' then
    raise exception 'El paso ya fue decidido';
  end if;

  select role into v_rol from public.profiles where id = auth.uid();

  update public.aprobacion_pasos
    set estado = p_decision, comentario = p_comentario, decidido_at = now()
    where id = p_paso;

  if p_decision = 'rechazado' then
    update public.aprobacion_solicitudes
      set estado = 'rechazado', updated_at = now() where id = v_solic.id;

    perform public.registrar_auditoria(
      'aprobacion.paso_rechazado', 'documento', v_solic.documento_id,
      jsonb_build_object('solicitud_id', v_solic.id, 'paso', v_paso.orden), p_ip);
    return;
  end if;

  -- Aprobado: registrar firma electrónica simple.
  insert into public.firmas (
    documento_id, paso_id, firmante_id, rol_snapshot, tipo_firma,
    hash_documento, ip, proceso_id
  ) values (
    v_solic.documento_id, p_paso, auth.uid(), v_rol::text, 'simple',
    p_hash, p_ip, v_paso.proceso_id
  );

  perform public.registrar_auditoria(
    'aprobacion.paso_aprobado', 'documento', v_solic.documento_id,
    jsonb_build_object('solicitud_id', v_solic.id, 'paso', v_paso.orden, 'hash', p_hash), p_ip);

  -- ¿Era el último paso?
  select count(*) into v_total from public.aprobacion_pasos where solicitud_id = v_solic.id;
  if v_paso.orden >= v_total then
    update public.aprobacion_solicitudes
      set estado = 'aprobado', updated_at = now() where id = v_solic.id;
    perform public.registrar_auditoria(
      'aprobacion.completada', 'documento', v_solic.documento_id,
      jsonb_build_object('solicitud_id', v_solic.id), p_ip);
  else
    update public.aprobacion_solicitudes
      set paso_actual = v_paso.orden + 1, updated_at = now() where id = v_solic.id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Row Level Security (lectura por proceso o por implicado; escritura vía RPC)
-- -----------------------------------------------------------------------------
alter table public.aprobacion_solicitudes enable row level security;
alter table public.aprobacion_pasos enable row level security;
alter table public.firmas enable row level security;
alter table public.auditoria enable row level security;

create policy "solic_select" on public.aprobacion_solicitudes
  for select to authenticated
  using (public.can_read_proceso(proceso_id) or created_by = auth.uid());

create policy "pasos_select" on public.aprobacion_pasos
  for select to authenticated
  using (public.can_read_proceso(proceso_id) or aprobador_id = auth.uid());

create policy "firmas_select" on public.firmas
  for select to authenticated
  using (public.can_read_proceso(proceso_id) or firmante_id = auth.uid());

-- Auditoría: solo administradores de archivo o el propio actor. Nunca editable.
create policy "auditoria_select" on public.auditoria
  for select to authenticated
  using (public.is_archivo_admin() or actor_id = auth.uid());

-- Privilegios: solo SELECT desde el cliente. Las escrituras las hacen las
-- funciones SECURITY DEFINER (crear_solicitud / decidir_paso / registrar_auditoria).
grant select on public.aprobacion_solicitudes to authenticated;
grant select on public.aprobacion_pasos to authenticated;
grant select on public.firmas to authenticated;
grant select on public.auditoria to authenticated;
