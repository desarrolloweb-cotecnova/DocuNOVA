-- =============================================================================
-- DocuNOVA — 0005 Carga masiva
-- Habilita el "upsert" por (oficina_id, codigo) en documentos para la carga
-- masiva por Excel. unidades.codigo, oficinas.codigo y
-- series(oficina_id, codigo, nivel) ya tienen las restricciones únicas
-- necesarias (ver 0001/0002).
-- =============================================================================

-- Índice único para permitir ON CONFLICT (oficina_id, codigo). Los códigos
-- nulos se consideran distintos entre sí, así que los documentos sin código
-- siguen permitiéndose (y siempre se insertan como nuevos en la importación).
create unique index if not exists documentos_oficina_codigo_key
  on public.documentos (oficina_id, codigo);
