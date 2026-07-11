# Tareas 005 — Tablero y notificaciones

Estado de la Fase 4. Marca `[x]` al completar.

## Base de datos

- [x] `0008` tabla `notificaciones` + funciones + RLS
- [x] Redefinir `crear_solicitud` / `decidir_paso` para encolar avisos

## Aplicación

- [x] `src/lib/retencion.ts` + pruebas (plazos y vencimiento)
- [x] `src/lib/notificaciones.ts` (tipos, etiquetas, enlaces)
- [x] Tablero `/dashboard` (KPIs, aprobaciones, vencimientos)
- [x] `/notificaciones` (bandeja + marcar leída) + navegación

## Arnés

- [x] `lint` / `typecheck` / `test` (49) / `build` en verde
- [x] `supabase/tests/rls.sql` incluye `notificaciones`

## Configuración por el administrador (fuera del código)

- [ ] Aplicar la migración `0008` a la base de datos
- [ ] Habilitar Gmail API + scope `gmail.send` y un worker que procese la cola
      `notificaciones` (estado `pendiente` → `enviada`)

## Pendiente para fases futuras

- [ ] Envío real por Gmail (worker/Edge Function)
- [ ] Google Calendar (vencimientos/comités) y Google Meet (enlaces)
- [ ] Notificaciones programadas de retención por vencer
- [ ] Reportes exportables (agregados por macroproceso/eje)
