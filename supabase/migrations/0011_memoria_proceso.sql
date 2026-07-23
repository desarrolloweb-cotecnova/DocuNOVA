-- =============================================================================
-- DocuNOVA — 0011 Proceso en documentos de Memoria Corporativa
-- Cada documento de memoria se asocia (además del componente) al proceso al que
-- pertenece, para poder clasificarlo y filtrarlo por Eje ▸ Macroproceso ▸
-- Proceso. Se referencia la unidad organizacional de tipo 'proceso'. Depende
-- de 0009/0010 y de 0001 (tabla `unidades`).
-- =============================================================================

alter table public.memoria_documentos
  add column unidad_id uuid references public.unidades (id) on delete set null;

create index memoria_documentos_unidad_idx
  on public.memoria_documentos (unidad_id);

comment on column public.memoria_documentos.unidad_id is
  'Proceso (unidad organizacional de tipo proceso) al que pertenece el documento.';
