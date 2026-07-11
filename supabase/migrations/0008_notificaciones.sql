-- =============================================================================
-- DocuNOVA — Fase 4: Notificaciones (backbone) + tablero.
--
-- Las notificaciones se ENCOLAN en la base de datos cuando ocurre un evento
-- (p. ej. un documento queda pendiente de tu firma). El ENVÍO real por Gmail
-- (Google Workspace) es un paso posterior: un worker/Edge Function leerá las
-- filas en estado 'pendiente' y las enviará usando el scope
-- https://www.googleapis.com/auth/gmail.send, marcándolas como 'enviada'.
-- Este archivo deja lista toda esa infraestructura salvo el envío externo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cola / bitácora de notificaciones
-- -----------------------------------------------------------------------------
create table public.notificaciones (
  id               uuid primary key default gen_random_uuid(),
  destinatario_id  uuid references public.profiles (id) on delete cascade,
  destinatario_email text,
  tipo             text not null,
  asunto           text not null,
  cuerpo           text,
  entidad_tipo     text,
  entidad_id       uuid,
  proceso_id       uuid references public.procesos (id) on delete set null,
  canal            text not null default 'gmail',
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente', 'enviada', 'fallida')),
  leida            boolean not null default false,
  error            text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
create index notif_destinatario_idx on public.notificaciones (destinatario_id);
create index notif_estado_idx on public.notificaciones (estado);

comment on table public.notificaciones is
  'Cola de notificaciones. El envío por Gmail (scope gmail.send) es un paso externo pendiente.';

-- -----------------------------------------------------------------------------
-- 2. Encolar una notificación (uso interno de las funciones del flujo)
-- -----------------------------------------------------------------------------
create or replace function public.crear_notificacion(
  p_destinatario uuid,
  p_tipo text,
  p_asunto text,
  p_cuerpo text,
  p_entidad_tipo text,
  p_entidad_id uuid,
  p_proceso uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from public.profiles where id = p_destinatario;
  insert into public.notificaciones (
    destinatario_id, destinatario_email, tipo, asunto, cuerpo,
    entidad_tipo, entidad_id, proceso_id
  ) values (
    p_destinatario, v_email, p_tipo, p_asunto, p_cuerpo,
    p_entidad_tipo, p_entidad_id, p_proceso
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Marcar una notificación como leída (solo el destinatario)
-- -----------------------------------------------------------------------------
create or replace function public.marcar_notificacion_leida(p_notif uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notificaciones
    set leida = true
    where id = p_notif and destinatario_id = auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS: cada quien ve sus notificaciones; el admin de archivo, todas.
-- -----------------------------------------------------------------------------
alter table public.notificaciones enable row level security;

create policy "notif_select" on public.notificaciones
  for select to authenticated
  using (destinatario_id = auth.uid() or public.is_archivo_admin());

grant select on public.notificaciones to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Redefinir las funciones del flujo (Fase 3) para encolar notificaciones.
--    Avisa al aprobador en turno cuando le toca, y al autor al cerrarse el flujo.
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
  v_titulo text;
begin
  if array_length(p_aprobadores, 1) is null then
    raise exception 'Debe indicar al menos un aprobador';
  end if;

  select proceso_id into v_proceso from public.documentos where id = p_documento;
  if v_proceso is null then
    raise exception 'Documento inexistente';
  end if;
  if not public.can_write_proceso(v_proceso) then
    raise exception 'No autorizado para iniciar la aprobación de este documento';
  end if;
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

  -- Notificar al primer aprobador.
  select titulo into v_titulo from public.documentos where id = p_documento;
  perform public.crear_notificacion(
    p_aprobadores[1], 'aprobacion_pendiente',
    'Tienes un documento pendiente de aprobación',
    format('El documento «%s» espera tu revisión y firma.', v_titulo),
    'documento', p_documento, v_proceso
  );

  return v_solicitud;
end;
$$;

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
  v_titulo text;
  v_siguiente uuid;
begin
  if p_decision not in ('aprobado', 'rechazado') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_paso from public.aprobacion_pasos where id = p_paso;
  if not found then raise exception 'Paso inexistente'; end if;
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
  select titulo into v_titulo from public.documentos where id = v_solic.documento_id;

  update public.aprobacion_pasos
    set estado = p_decision, comentario = p_comentario, decidido_at = now()
    where id = p_paso;

  if p_decision = 'rechazado' then
    update public.aprobacion_solicitudes
      set estado = 'rechazado', updated_at = now() where id = v_solic.id;
    perform public.registrar_auditoria(
      'aprobacion.paso_rechazado', 'documento', v_solic.documento_id,
      jsonb_build_object('solicitud_id', v_solic.id, 'paso', v_paso.orden), p_ip);
    -- Avisar al autor del rechazo.
    if v_solic.created_by is not null then
      perform public.crear_notificacion(
        v_solic.created_by, 'aprobacion_rechazada',
        'Un documento fue rechazado',
        format('El documento «%s» fue rechazado en la aprobación.', v_titulo),
        'documento', v_solic.documento_id, v_solic.proceso_id);
    end if;
    return;
  end if;

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

  select count(*) into v_total from public.aprobacion_pasos where solicitud_id = v_solic.id;
  if v_paso.orden >= v_total then
    update public.aprobacion_solicitudes
      set estado = 'aprobado', updated_at = now() where id = v_solic.id;
    perform public.registrar_auditoria(
      'aprobacion.completada', 'documento', v_solic.documento_id,
      jsonb_build_object('solicitud_id', v_solic.id), p_ip);
    -- Avisar al autor de la aprobación final.
    if v_solic.created_by is not null then
      perform public.crear_notificacion(
        v_solic.created_by, 'aprobacion_completada',
        'Un documento fue aprobado',
        format('El documento «%s» completó su flujo de aprobación.', v_titulo),
        'documento', v_solic.documento_id, v_solic.proceso_id);
    end if;
  else
    update public.aprobacion_solicitudes
      set paso_actual = v_paso.orden + 1, updated_at = now() where id = v_solic.id;
    -- Avisar al siguiente aprobador.
    select aprobador_id into v_siguiente from public.aprobacion_pasos
      where solicitud_id = v_solic.id and orden = v_paso.orden + 1;
    if v_siguiente is not null then
      perform public.crear_notificacion(
        v_siguiente, 'aprobacion_pendiente',
        'Tienes un documento pendiente de aprobación',
        format('El documento «%s» espera tu revisión y firma.', v_titulo),
        'documento', v_solic.documento_id, v_solic.proceso_id);
    end if;
  end if;
end;
$$;
