# Spec 004 — Flujos de aprobación, firma electrónica simple y auditoría

- **Estado:** Implementada (Fase 3)
- **Fecha:** 2026-07
- **Depende de:** 003-expedientes-documentos

## 1. Qué problema resuelve

Los documentos necesitan un **circuito de aprobación** trazable y una **firma
electrónica** con validez probatoria básica, además de una **bitácora
inalterable** de lo que ocurre. Deriva del §4 (flujos de aprobación y firma) y
§7 (auditoría) del prompt, y de la Ley 527 de 1999 (mensajes de datos y firma).

## 2. Alcance

Incluye:

- **Solicitudes de aprobación** por documento, con **uno o varios aprobadores en
  secuencia** (paso a paso).
- **Firma electrónica simple** al aprobar: registra usuario, rol, fecha/hora, IP
  y **hash SHA-256** del documento firmado. Campo `tipo_firma` = `simple`, con el
  punto de extensión listo para un proveedor externo de firma certificada (no
  implementado aún).
- **Bandeja de aprobaciones** (`/aprobaciones`) con lo que espera mi firma.
- **Bitácora de auditoría append-only** de las acciones del flujo.
- **RLS**: lectura por proceso o por implicado; la lógica del flujo se ejecuta en
  funciones `SECURITY DEFINER` que validan al actor.

No incluye (fases posteriores): proveedor de firma digital **certificada**,
plantillas de flujo por serie, notificaciones por correo (Fase 4).

## 3. Comportamiento esperado (criterios de aceptación)

- **CA-1.** Quien puede escribir en el proceso puede **enviar** un documento a
  aprobación indicando la secuencia de aprobadores (`crear_solicitud`).
- **CA-2.** Un documento no puede tener **dos flujos en curso** a la vez.
- **CA-3.** Solo el **aprobador en turno** puede decidir su paso; intentar
  decidir fuera de turno o por otro usuario falla (`decidir_paso`).
- **CA-4.** Al **aprobar** se crea una **firma** con hash + IP + rol; el flujo
  avanza. Al aprobar el último paso, la solicitud queda `aprobado`.
- **CA-5.** Al **rechazar**, la solicitud queda `rechazado` y el flujo termina.
- **CA-6.** Cada acción del flujo queda en `auditoria`, que **no** admite UPDATE
  ni DELETE (append-only).
- **CA-7.** El hash se calcula sobre una representación canónica del documento,
  de modo que un cambio posterior invalidaría la coincidencia.

## 4. Fuera de contexto / supuestos

- Los aprobadores se eligen al enviar (secuencia por documento). Las plantillas
  de flujo por serie/tipo documental quedan como mejora futura.
- La firma es **simple** (no certificada): su valor probatorio es el del §4 del
  alcance, no el de una firma digital con certificado.
- Las verificaciones de turno/append-only requieren base de datos viva
  (`supabase/tests/rls.sql`, PARTE D).
