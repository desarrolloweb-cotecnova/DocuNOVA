# Tareas 002 — Estructura organizacional, TRD, usuarios y activación

Estado de las tareas de la Fase 1. Marca `[x]` al completar.

## Datos y generador

- [x] CSV reales en `data/` (TRD y usuarios)
- [x] Parser CSV RFC 4180 (`scripts/lib/csv.mjs`)
- [x] Estructura canónica y mapeos (`scripts/lib/{org-data,mapping,seed-model}.mjs`)
- [x] Generador `scripts/generate-seed.mjs`

## Base de datos

- [x] `0002` estructura organizacional (4 niveles) + funciones + RLS
- [x] `0003` catálogo TRD (series/subseries) + RLS
- [x] `0004` semilla, datos sensibles, activación por defecto, triggers, políticas
- [x] `0005` seed generado (3/10/16/25/128/230/38)

## Aplicación

- [x] Guard de activación + `/pendiente`
- [x] `/admin` (guard super_admin) + índice
- [x] `/admin/usuarios` (activar, asignar rol/proceso/oficina)
- [x] `/admin/estructura` (árbol + renombrar/inactivar)
- [x] `/trd` (series/subseries por proceso)
- [x] Navegación por rol

## Arnés

- [x] Pruebas del modelo de seed (conteos + integridad + mapeo)
- [x] Prueba de la lógica de activación
- [x] Helpers de rol probados
- [x] `supabase/tests/rls.sql` (aserciones + guía manual)
- [x] `lint` / `typecheck` / `test` / `build` en verde

## Configuración por el administrador (fuera del código)

- [ ] Aplicar migraciones 0002–0005 a la base de datos
- [ ] Ejecutar `supabase/tests/rls.sql` en el SQL Editor
- [ ] Primer login de `desarrolloweb@cotecnova.edu.co` (queda super_admin activo)
- [ ] Activar usuarios reales desde `/admin/usuarios`
- [ ] Crear (opcional) los procesos electrónicos sin oficina en documentos

## Pendiente para fases futuras

- [ ] Crear nodos nuevos del catálogo desde la interfaz (hoy: renombrar/inactivar)
- [ ] Expedientes y documentos con RLS por proceso (Fase 2)
