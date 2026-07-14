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
- **CA-G5.** Un administrador de usuarios (superadmin/rector) puede "Ver como"
  otro usuario: se forja una sesión real de ese usuario (la RLS y el rol se
  reflejan tal cual) desde el servidor con la service_role key. No se puede
  impersonar a otro administrador de usuarios ni a una cuenta inactiva.
- **CA-G6.** Durante la impersonación se omite el segundo factor (aal2) solo
  para esa sesión; el marcador que la habilita va firmado (HMAC con la
  service_role key), de modo que un usuario no puede fabricarlo para saltarse su
  propio MFA. Un banner permanente indica a quién se está viendo y permite
  volver a la cuenta del administrador con un clic (restaura su sesión).
- **CA-G7.** Cada inicio y fin de impersonación queda registrado en
  `impersonacion_log` (auditoría visible solo para administradores de usuarios).
- **CA-G8.** El rol de un usuario se cambia desde el formulario "Editar perfil"
  (no con un control separado en la fila), junto con el resto de sus datos.
- **CA-G9.** La navegación muestra los módulos según el rol: superadmin y rector
  ven todos; administrador todos menos Gestión; gestor solo TRD, Documentos,
  Registros y Consulta; colaborador solo Registros y Consulta; consulta solo
  Consulta. El Panel de inicio queda disponible para todo rol activo.

### TRD

- **CA-T1.** Quien elabora (gestor+) puede enviar la TRD a revisión: se registra
  el estado `en_revision` en el historial sin error (la RLS de `aprobaciones_trd`
  lo permite). Tras enviar/aprobar/rechazar se muestra un mensaje de confirmación.
- **CA-T2.** En TRD, superadmin/rector/administrador ven todos los procesos; los
  demás roles (p. ej. gestor) solo ven las dependencias de su propio proceso
  (`perfiles.unidad_id`).

### Carga masiva por Excel (Dependencias, TRD, Documentos)

- **CA-C1.** La carga masiva (subir y descargar plantilla) solo está disponible
  para administradores (superadmin, rector, administrador). La descarga de
  plantilla exige ese rol (403 en caso contrario).
- **CA-C2.** La plantilla se descarga con los datos actuales de la base (una fila
  por registro) más la hoja de instrucciones; si no hay datos, trae la fila de
  ejemplo.
- **CA-C3.** Al subir el archivo, solo se agregan los registros nuevos: las filas
  cuyo código ya existe se omiten (no se actualizan). En Dependencias, los
  eje/macro/proceso existentes se reutilizan y solo se crean los que falten.

### Retroalimentación de acciones

- **CA-F1.** Los botones que ejecutan una acción muestran un estado
  "ejecutando…" (spinner + deshabilitado) mientras corre, para que se note que
  la acción está en curso.
- **CA-F2.** Al completarse una acción se muestra un aviso en pantalla (toast) de
  confirmación (p. ej. "Documento activado", "Invitación creada").
- **CA-F3.** Las acciones destructivas (eliminar/quitar/anular/rechazar) piden
  confirmación antes de ejecutarse.
- **CA-F4.** El árbol de la estructura organizacional (Gestión) muestra la
  etiqueta del nivel de cada nodo (Eje / Macroproceso / Proceso), igual que el
  árbol de la TRD.

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
