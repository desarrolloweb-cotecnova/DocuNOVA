# Plan técnico 003 — Expedientes y Documentos

Implementa [spec.md](./spec.md).

## Base de datos

`supabase/migrations/0006_expedientes_documentos.sql`:

- Tablas `expedientes` y `documentos` (físico/electrónico en un mismo esquema).
- `documentos.busqueda`: columna `tsvector` generada (español) sobre
  título+descripción+contenido, con índice GIN para búsqueda de texto completo.
- **Clasificación automática** por triggers: `set_expediente_clasificacion`
  deriva Proceso/Oficina desde la subserie; `set_documento_clasificacion` los
  hereda del expediente. Denormalizados en `proceso_id`/`oficina_id` para RLS.
- **Autorización por proceso**: funciones `can_read_proceso(uuid)` y
  `can_write_proceso(uuid)` (esta excluye a `consulta`); `clasificacion_de_subserie`.
- RLS en ambas tablas con políticas select/insert/update/delete basadas en esas
  funciones.

## Aplicación

| Ruta | Archivo | Responsabilidad |
| --- | --- | --- |
| Listado | `src/app/(app)/expedientes/page.tsx` | Expedientes del proceso (RLS) |
| Alta | `src/app/(app)/expedientes/nuevo/page.tsx` + `actions.ts` + `subserie-options.ts` | Crear expediente por subserie |
| Detalle | `src/app/(app)/expedientes/[id]/page.tsx` | Ver expediente y sus documentos |
| Alta doc | `src/app/(app)/expedientes/[id]/{actions.ts,nuevo-documento-form.tsx}` | Agregar documento físico/electrónico |
| Búsqueda | `src/app/(app)/documentos/page.tsx` | Búsqueda unificada por texto/tipo |
| Tipos/util | `src/lib/documentos.ts` (+ test) | Estados, tipos, folios, ubicación, búsqueda |
| Navegación | `src/lib/navigation.ts` | Habilita `/expedientes` y `/documentos` |

## Decisiones clave

- **La subserie es el punto de clasificación**: elegirla fija Proceso/Oficina, de
  modo que el usuario no puede "colar" un expediente en otro proceso (la RLS
  valida el `proceso_id` derivado por el trigger).
- **Físico y electrónico conviven** en `documentos` con un discriminante `tipo`;
  el formulario alterna campos con un pequeño componente cliente.
- **Búsqueda** con `tsvector` generado + `websearch_to_tsquery('spanish', …)`.
- **`consulta` es de solo lectura** por diseño de `can_write_proceso`.

## Verificación

- `npm run lint && npm run typecheck && npm run test && npm run build`.
- `supabase/tests/rls.sql` (PARTE C) contra un branch: aislamiento por proceso,
  bloqueo de escritura cruzada y de `consulta`, y búsqueda de texto.
- Manual: crear expediente → agregar documento físico y electrónico → buscar el
  electrónico por una palabra de su contenido; iniciar sesión con un usuario de
  otro proceso y confirmar que no ve esos expedientes.
