-- =============================================================================
-- DocuNOVA — 0015 "Mi perfil" de solo lectura
-- Los datos del perfil (perfiles y datos_personales) solo los modifica el
-- administrador de usuarios desde Configuración → Usuarios. El propio usuario
-- puede leerlos, pero ya no editarlos. Las altas siguen a cargo del trigger
-- handle_new_user (security definer), que no depende de estas políticas.
-- =============================================================================

drop policy if exists "perfiles_update" on public.perfiles;
create policy "perfiles_update" on public.perfiles
  for update to authenticated
  using (public.es_admin_usuarios())
  with check (public.es_admin_usuarios());

drop policy if exists "datos_personales_write" on public.datos_personales;
create policy "datos_personales_write" on public.datos_personales
  for all to authenticated
  using (public.es_admin_usuarios())
  with check (public.es_admin_usuarios());
