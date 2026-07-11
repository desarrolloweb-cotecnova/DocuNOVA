# Plan técnico 005 — Tablero y notificaciones

Implementa [spec.md](./spec.md).

## Base de datos

`supabase/migrations/0008_notificaciones.sql`:

- Tabla `notificaciones` (cola/bitácora) con estado `pendiente|enviada|fallida`.
- Funciones `crear_notificacion(...)` y `marcar_notificacion_leida(...)`.
- **Redefine** `crear_solicitud` y `decidir_paso` (Fase 3) para **encolar avisos**:
  al primer aprobador, al siguiente en turno y al autor al cerrarse el flujo.
- RLS: cada quien ve sus notificaciones; el admin de archivo, todas. Solo SELECT
  al cliente; las escrituras van por las funciones `SECURITY DEFINER`.

## Aplicación

| Ruta | Archivo | Responsabilidad |
| --- | --- | --- |
| Tablero | `src/app/(app)/dashboard/page.tsx` | KPIs + mis aprobaciones + vencimientos |
| Notificaciones | `src/app/(app)/notificaciones/{page,actions}.tsx` | Bandeja + marcar leída |
| Retención | `src/lib/retencion.ts` (+ test) | Parseo de plazos y cálculo de vencimiento |
| Notificaciones | `src/lib/notificaciones.ts` | Tipos, etiquetas, enlace por entidad |
| Navegación | `src/lib/navigation.ts` | Ítem "Notificaciones" |

## Decisiones clave

- **Notificaciones dirigidas por eventos, en la base de datos**: se encolan desde
  las mismas funciones del flujo de aprobación (integridad garantizada), sin
  depender del cliente.
- **Envío desacoplado**: la fila queda `pendiente`; un worker externo la enviará
  por Gmail (`gmail.send`) y la marcará `enviada`. Esto evita bloquear el flujo y
  deja el punto de integración con Google Workspace claramente aislado.
- **Vencimientos calculados en el cliente-servidor** a partir de la TRD
  (`retencionAMeses` + `vencimientoGestion` + `estadoVencimiento`), sin duplicar
  fechas en la base.

## Verificación

- `npm run lint && npm run typecheck && npm run test && npm run build`.
- Pruebas de `retencion.ts` (parseo, vencimiento, estado).
- Manual: enviar un documento a aprobación → el aprobador ve una notificación y
  el KPI "Pendientes de tu firma" aumenta; aprobar → el autor recibe aviso;
  registrar un expediente con retención corta y confirmar que aparece en
  "Retención por vencer".
