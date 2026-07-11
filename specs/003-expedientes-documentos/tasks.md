# Tareas 003 — Expedientes y Documentos

Estado de la Fase 2. Marca `[x]` al completar.

## Base de datos

- [x] `0006` tablas `expedientes` y `documentos`
- [x] Búsqueda de texto completo (`tsvector` generado + índice GIN)
- [x] Triggers de clasificación (proceso/oficina) desde subserie/expediente
- [x] Funciones `can_read_proceso` / `can_write_proceso` / `clasificacion_de_subserie`
- [x] RLS por proceso en ambas tablas

## Aplicación

- [x] `src/lib/documentos.ts` + pruebas (folios, etiquetas, búsqueda)
- [x] `/expedientes` (listar) y `/expedientes/nuevo` (crear)
- [x] `/expedientes/[id]` (detalle + documentos)
- [x] Alta de documentos físicos y electrónicos (form cliente)
- [x] `/documentos` (búsqueda unificada por texto/tipo)
- [x] Navegación habilitada

## Arnés

- [x] `lint` / `typecheck` / `test` / `build` en verde
- [x] `supabase/tests/rls.sql` PARTE C (aislamiento por proceso, guía manual)

## Configuración por el administrador (fuera del código)

- [ ] Aplicar la migración `0006` a la base de datos
- [ ] Definir series/subseries para los procesos 100% electrónicos (para poder
      crear sus expedientes)

## Pendiente para fases futuras

- [ ] Flujos de aprobación y firma electrónica simple (Fase 3)
- [ ] Notificaciones (Gmail) y tablero con indicadores (Fase 4)
- [ ] Selección de custodio responsable en documentos físicos (UI)
