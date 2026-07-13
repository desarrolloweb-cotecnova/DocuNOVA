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
