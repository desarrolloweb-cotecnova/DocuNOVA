-- =============================================================================
-- DocuNOVA — 0014 Memoria Corporativa en Google Drive
-- Permite que el archivo de un documento de Memoria Corporativa viva en el
-- Drive institucional (cuenta docunova@cotecnova.edu.co) en lugar del bucket
-- 'memoria' de Supabase Storage. Cada fila guarda UNO de los dos destinos:
--   * archivo_ruta   -> objeto del bucket 'memoria' (modo Supabase Storage)
--   * drive_file_id  -> archivo en la carpeta de Drive (modo Drive)
-- Mantener ambos modos permite conservar lo ya cargado y activar Drive sin
-- migrar nada. Depende de 0009.
-- =============================================================================

alter table public.memoria_documentos
  add column if not exists drive_file_id text,
  add column if not exists drive_enlace  text;

-- Con Drive no hay objeto en el bucket, así que la ruta pasa a ser opcional.
alter table public.memoria_documentos
  alter column archivo_ruta drop not null;

-- Un archivo de Drive no puede estar referenciado por dos documentos.
create unique index if not exists memoria_documentos_drive_file_id_idx
  on public.memoria_documentos (drive_file_id)
  where drive_file_id is not null;

-- Toda fila debe apuntar exactamente a un destino de almacenamiento.
alter table public.memoria_documentos
  drop constraint if exists memoria_documentos_destino_chk;
alter table public.memoria_documentos
  add constraint memoria_documentos_destino_chk
  check (num_nonnulls(archivo_ruta, drive_file_id) = 1);

comment on column public.memoria_documentos.drive_file_id is
  'ID del archivo en Google Drive cuando el almacenamiento es el Drive
   institucional. Excluyente con archivo_ruta (bucket de Supabase Storage).';
comment on column public.memoria_documentos.drive_enlace is
  'webViewLink de Drive: abre el archivo en la interfaz de Google Drive.';
