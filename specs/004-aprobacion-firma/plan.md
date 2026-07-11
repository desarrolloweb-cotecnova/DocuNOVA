# Plan técnico 004 — Aprobación, firma y auditoría

Implementa [spec.md](./spec.md).

## Base de datos

`supabase/migrations/0007_aprobacion_firma_auditoria.sql`:

- Tablas `aprobacion_solicitudes`, `aprobacion_pasos`, `firmas` (append-only),
  `auditoria` (append-only).
- **Funciones del flujo** (`SECURITY DEFINER`, validan al actor con `auth.uid()`):
  - `crear_solicitud(documento, aprobadores[], ip)` — crea solicitud + pasos.
  - `decidir_paso(paso, decision, comentario, hash, ip)` — aprueba (registra
    firma) o rechaza; avanza el flujo; anota auditoría.
  - `registrar_auditoria(...)` — bitácora reutilizable.
- RLS: lectura por `can_read_proceso` o por implicado (aprobador/firmante/actor).
  Escritura solo vía las funciones; al cliente se le concede **solo SELECT**.
  `auditoria`/`firmas` sin UPDATE/DELETE (append-only).

## Aplicación

| Ruta | Archivo | Responsabilidad |
| --- | --- | --- |
| Detalle doc | `src/app/(app)/documentos/[id]/page.tsx` | Estado del flujo, firmas, envío y decisión |
| Acciones | `src/app/(app)/documentos/[id]/actions.ts` | `enviarAAprobacion`, `decidirPaso` (hash + IP) |
| Bandeja | `src/app/(app)/aprobaciones/page.tsx` | Pasos en turno del usuario |
| Tipos/util | `src/lib/aprobaciones.ts` (+ test) | Estados, `canonicalDocumento`, `esPasoActual` |
| Navegación | `src/lib/navigation.ts` | Ítem "Aprobaciones"; enlaces a `/documentos/[id]` |

## Decisiones clave

- **Integridad del flujo en la base de datos**: la secuencia, el turno y la firma
  se resuelven en funciones `SECURITY DEFINER`, no en el cliente. El cliente solo
  puede leer (RLS) e invocar las funciones.
- **Hash de firma en el servidor** (`node:crypto` sobre `canonicalDocumento`); la
  **IP** se toma de las cabeceras en el server action.
- **Append-only**: se revoca UPDATE/DELETE a `authenticated` en `auditoria` y
  `firmas`; los INSERT los hacen las funciones definer.
- **`tipo_firma`** deja lista la extensión a firma certificada (Fase futura).

## Verificación

- `npm run lint && npm run typecheck && npm run test && npm run build`.
- `supabase/tests/rls.sql` (PARTES A.5 y D): append-only, turno del aprobador,
  registro de firma con hash/IP.
- Manual: enviar un documento a 2 aprobadores → el 1.º aprueba (se registra
  firma) → el 2.º aprueba (solicitud `aprobado`); verificar que un tercero no
  puede decidir y que la bitácora no se puede editar.
