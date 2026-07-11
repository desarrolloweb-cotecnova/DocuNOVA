# Tareas 004 — Aprobación, firma y auditoría

Estado de la Fase 3. Marca `[x]` al completar.

## Base de datos

- [x] `0007` tablas solicitudes/pasos/firmas/auditoria
- [x] Funciones `crear_solicitud`, `decidir_paso`, `registrar_auditoria`
- [x] RLS por proceso/implicado; solo SELECT al cliente
- [x] Append-only en `auditoria` y `firmas`

## Aplicación

- [x] `src/lib/aprobaciones.ts` + pruebas (estados, hash canónico, turno)
- [x] Detalle de documento `/documentos/[id]` (estado, firmas, formularios)
- [x] Acciones `enviarAAprobacion` / `decidirPaso` (hash SHA-256 + IP)
- [x] Bandeja `/aprobaciones`
- [x] Navegación y enlaces a documentos

## Arnés

- [x] `lint` / `typecheck` / `test` (44) / `build` en verde
- [x] `supabase/tests/rls.sql` PARTES A.5 y D

## Configuración por el administrador (fuera del código)

- [ ] Aplicar la migración `0007` a la base de datos

## Pendiente para fases futuras

- [ ] Plantillas de flujo por serie/tipo documental
- [ ] Proveedor externo de firma digital certificada (`tipo_firma`)
- [ ] Notificaciones por correo del paso pendiente (Fase 4)
