# Spec 001 — Fundación y Autenticación

- **Estado:** Implementada (Fase 0)
- **Fecha:** 2026-07
- **Depende de:** —

## 1. Qué problema resuelve

El proyecto necesita una base segura antes de construir funcionalidades: un
empleado de Cotecnova debe poder autenticarse de forma segura y llegar a un
panel, y el equipo debe contar con un arnés de calidad que evite romper el
sistema. Sin esta fundación, cualquier módulo posterior (TRD, expedientes,
flujos) sería inseguro o inestable.

## 2. Alcance

Incluye:

- Inicio de sesión con **Google OAuth**, restringido al dominio
  `@cotecnova.edu.co`.
- **Segundo factor obligatorio** (MFA con TOTP / Google Authenticator).
- Modelo base de datos: `profiles`, roles (`user_role`) y `dependencias`, con
  **RLS** activada.
- Panel privado con navegación y cierre de sesión.
- Arnés: lint, typecheck, pruebas (unitarias + e2e), CI y hook de sesión.

No incluye (fases posteriores): TRD, expedientes, documentos, flujos, firma,
notificaciones.

## 3. Comportamiento esperado (criterios de aceptación)

### Autenticación

- **CA-1.** Un usuario sin sesión que visita una ruta privada (p. ej.
  `/dashboard`) es redirigido a `/login`.
- **CA-2.** El usuario puede iniciar sesión con Google. Tras autenticarse, si su
  correo **no** termina en `@cotecnova.edu.co`, se cierra su sesión y vuelve a
  `/login` con un mensaje de dominio no permitido.
- **CA-3.** Un usuario válido sin segundo factor configurado es llevado a
  `/mfa/enroll`, donde escanea un QR con Google Authenticator y confirma un
  código de 6 dígitos.
- **CA-4.** Un usuario válido con segundo factor ya configurado, pero sin
  verificar en la sesión actual, es llevado a `/mfa/verify`.
- **CA-5.** Solo tras alcanzar el nivel `aal2` (segundo factor verificado) el
  usuario accede al panel.
- **CA-6.** El usuario puede cerrar sesión desde el panel.

### Gestión de usuarios

- **CA-G1.** En el módulo de Gestión, un administrador de usuarios (superadmin/
  rector) puede editar el perfil de un usuario registrado: nombre completo,
  cédula, cargo, jefe inmediato, proceso y marca de responsable de proceso.
- **CA-G2.** El jefe inmediato solo puede elegirse entre los usuarios marcados
  como responsables de proceso.
- **CA-G3.** "Invitar nuevo usuario" (pre-registro / `usuarios_semilla`) permite
  invitar por correo indicando nombre, cédula, rol y proceso; el perfil real se
  crea activo con esos datos en el primer inicio de sesión.
- **CA-G4.** Es posible invitar varios usuarios a la vez mediante carga de un
  Excel (plantilla descargable), igual que en dependencias, TRD y documentos.

### Datos y seguridad

- **CA-7.** Al crearse un usuario en Supabase Auth, se crea automáticamente su
  fila en `profiles` con rol `consulta`.
- **CA-8.** Todas las tablas con datos tienen RLS activa: un usuario solo ve su
  propio perfil (salvo administradores de archivo, que ven todos).

### Arnés

- **CA-9.** `npm run lint`, `npm run typecheck`, `npm run test` y
  `npm run build` terminan sin errores.
- **CA-10.** La prueba e2e confirma CA-1 y que la pantalla de login se muestra.
- **CA-11.** La CI de GitHub Actions ejecuta lo anterior en cada push/PR.

## 4. Fuera de contexto / supuestos

- El dominio `cotecnova.edu.co` es Google Workspace institucional.
- Las credenciales de Google y Supabase las configura el administrador (no van
  en el repositorio).
