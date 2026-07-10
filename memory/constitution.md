# Constitución de DocuNOVA

> Documento base del **Spec Driven Development (SDD)**. Reúne los principios no
> negociables del proyecto. Cualquier especificación, plan o código debe
> respetarlos. Si una decisión los contradice, se debe actualizar primero esta
> constitución de forma explícita.

## Propósito

DocuNOVA es el **Sistema de Gestión de Documentos Electrónicos de Archivo
(SGDEA)** de Cotecnova. Su fin es administrar documentos y expedientes conforme
a la normativa archivística colombiana (Ley 594 de 2000, Tablas de Retención
Documental y lineamientos del Archivo General de la Nación).

## Principios

1. **La especificación va antes que el código.**
   Toda funcionalidad nace de una spec en `specs/`. El código implementa la
   spec; no al revés.

2. **Seguridad por defecto.**
   - Acceso restringido a correos `@cotecnova.edu.co`.
   - Segundo factor (MFA/TOTP) obligatorio.
   - Row Level Security (RLS) **siempre activa** en toda tabla con datos.
   - El rol por defecto de un usuario nuevo es el de menor privilegio (`consulta`).

3. **Los secretos nunca se versionan.**
   Claves y credenciales viven en variables de entorno (`.env.local`, Vercel,
   Supabase). La clave `service_role` jamás se expone al navegador.

4. **El esquema de la base de datos es código.**
   Todo cambio de base de datos se hace mediante migraciones versionadas en
   `supabase/migrations/`. Nada de cambios manuales no registrados.

5. **El arnés (Harness) protege la calidad.**
   Todo cambio debe pasar `lint`, `typecheck`, `test` y `build`. La CI bloquea
   lo que no cumpla. Si algo se rompe, se arregla antes de continuar.

6. **Trazabilidad y auditoría.**
   Las acciones sensibles (aprobaciones, firmas, cambios de estado) se registran
   de forma inmutable (append-only). No se borra ni edita el historial.

7. **Idioma y contexto.**
   La interfaz y la documentación de usuario están en **español**. La
   terminología sigue la archivística colombiana (serie, subserie, expediente,
   retención, disposición final).

8. **Construcción incremental por fases.**
   Se entrega valor en fases pequeñas y verificables (ver README). No se mezclan
   fases en un mismo cambio salvo necesidad clara.

## Alcance por fases (resumen)

- **Fase 0 — Fundación:** autenticación (Google + MFA), roles, RLS, arnés, SDD.
- **Fase 1 — TRD:** dependencias, series y subseries documentales.
- **Fase 2 — Repositorio y Expedientes.**
- **Fase 3 — Flujos de aprobación y firma electrónica simple.**
- **Fase 4 — Notificaciones, tablero y reportes.**

## Decisiones diferidas (requieren actualizar esta constitución para activarse)

- Firma **digital** con certificado (validez legal reforzada).
- Notificaciones por **correo** electrónico.
