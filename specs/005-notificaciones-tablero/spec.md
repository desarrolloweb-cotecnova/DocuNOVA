# Spec 005 — Tablero de indicadores y notificaciones

- **Estado:** Implementada (Fase 4, con envío por Gmail pendiente de config. externa)
- **Fecha:** 2026-07
- **Depende de:** 003-expedientes-documentos, 004-aprobacion-firma

## 1. Qué problema resuelve

La institución necesita **ver el estado de su gestión documental de un vistazo**
(§5 del prompt) y **enterarse de lo que requiere acción** (§6: notificaciones).
Deriva del §5 (panel de control con indicadores) y §6 (integraciones Google
Workspace, empezando por Gmail).

## 2. Alcance

Incluye:

- **Tablero (`/dashboard`)** con indicadores del proceso del usuario (RLS):
  expedientes, documentos, pendientes de su firma y **vencimientos de retención**
  (calculados desde la TRD + fecha de apertura), con listas de acción.
- **Notificaciones (`/notificaciones`)**: bandeja de avisos del usuario, con
  marcar-como-leída. Se **encolan automáticamente** al ocurrir eventos de
  aprobación (pendiente de tu firma, aprobado, rechazado).
- **Backbone de envío**: la tabla `notificaciones` deja las filas en estado
  `pendiente`; el **envío real por Gmail** (scope `gmail.send`) es un paso
  externo posterior.

No incluye (config. externa / fases futuras): envío real por Gmail, eventos de
Google Calendar (vencimientos/comités) y enlaces de Google Meet; notificaciones
programadas de retención.

## 3. Comportamiento esperado (criterios de aceptación)

- **CA-1.** El tablero muestra conteos correctos limitados por proceso (RLS).
- **CA-2.** "Vencimientos de retención" lista expedientes **vencidos** o
  **próximos** (≤ 6 meses), calculando fecha de apertura + retención de gestión.
- **CA-3.** Al enviar un documento a aprobación, el **primer aprobador** recibe
  una notificación `aprobacion_pendiente`.
- **CA-4.** Al aprobar un paso, el **siguiente aprobador** es notificado; al
  cerrarse el flujo (aprobado/rechazado), el **autor** es notificado.
- **CA-5.** El usuario ve solo **sus** notificaciones (RLS) y puede marcarlas
  como leídas.
- **CA-6.** Las notificaciones no enviadas quedan en estado `pendiente` a la
  espera del envío por Gmail (punto de extensión).

## 4. Fuera de contexto / supuestos

- El **envío por Gmail** requiere habilitar la Gmail API y el scope
  `gmail.send` en Google Cloud y un worker/Edge Function que procese la cola;
  no se incluye aquí.
- **Google Calendar/Meet** (eventos de vencimiento, reuniones de comité, enlaces
  de videollamada) quedan como siguiente integración, con la arquitectura de
  cola/entidades lista para extenderse.
- El cálculo de vencimiento asume la retención de **archivo de gestión**; la
  disposición final y el archivo central se abordarán con reportes posteriores.
