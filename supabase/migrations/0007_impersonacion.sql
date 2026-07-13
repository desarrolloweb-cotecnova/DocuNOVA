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
