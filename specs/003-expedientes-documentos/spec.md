# Spec 003 — Expedientes y Documentos (repositorio con RLS por proceso)

- **Estado:** Implementada (Fase 2)
- **Fecha:** 2026-07
- **Depende de:** 001-fundacion, 002-estructura-trd

## 1. Qué problema resuelve

Con la estructura y la TRD ya cargadas (Fase 1), la institución necesita
**registrar y consultar sus documentos**: los expedientes físicos existentes
(solo metadatos de ubicación) y los documentos electrónicos nativos (contenido
buscable), todos clasificados por la TRD y **aislados por Proceso**.

Trazabilidad: deriva de "Alcance funcional" §1 (clasificación por serie/subserie),
§2 (registro físico), §3 (documentos electrónicos) y §5 (repositorio y búsqueda)
del prompt institucional.

## 2. Alcance

Incluye:

- **Expedientes** clasificados por una subserie de la TRD (que fija Proceso y
  Oficina automáticamente) con estado (abierto/cerrado/archivado).
- **Documentos** dentro de un expediente, de dos tipos bajo el mismo esquema:
  - **Físico:** metadatos de ubicación (caja, estante, carpeta, rango de folios,
    estado de conservación, fecha).
  - **Electrónico:** contenido de texto, **buscable por texto completo** (índice
    `tsvector` en español).
- **Repositorio y búsqueda** unificada por texto y tipo, limitada por proceso.
- **RLS por Proceso**: lectura y escritura restringidas al proceso del usuario;
  el rol `consulta` es de solo lectura; los administradores de archivo ven todo.

No incluye (fases posteriores): flujos de aprobación y firma (Fase 3),
notificaciones y tablero (Fase 4), OCR y firma digital certificada.

## 3. Comportamiento esperado (criterios de aceptación)

- **CA-1.** Al crear un expediente se elige una subserie; el sistema fija su
  Proceso y Oficina desde la TRD (trigger `set_expediente_clasificacion`).
- **CA-2.** Un documento hereda el Proceso/Oficina de su expediente
  (trigger `set_documento_clasificacion`).
- **CA-3.** Un usuario **solo ve** expedientes/documentos de **su** Proceso;
  los administradores de archivo ven todos (`can_read_proceso`).
- **CA-4.** Un usuario **no** puede crear/editar documentos de otro Proceso, ni
  el rol `consulta` puede escribir (`can_write_proceso`).
- **CA-5.** Un documento electrónico es recuperable por **búsqueda de texto**
  sobre su contenido (`websearch_to_tsquery` en español).
- **CA-6.** Un documento físico registra su ubicación y es recuperable por su
  título/metadatos.
- **CA-7.** El rango de folios se valida (final ≥ inicial, ambos ≥ 1).

## 4. Fuera de contexto / supuestos

- Los procesos 100% electrónicos ("Sistemas Integrados de Gestión", "Sistema de
  Aseguramiento Interno de Calidad") aún no tienen subseries en la TRD; para
  crear sus expedientes, el administrador de archivo debe definir primero su
  clasificación documental (serie/subserie).
- Las verificaciones de aislamiento por proceso requieren base de datos viva
  (`supabase/tests/rls.sql`, PARTE C); no corren en CI.
