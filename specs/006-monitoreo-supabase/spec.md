# Spec 006 — Monitoreo de Supabase y keepalive del Plan Free

- **Estado:** Implementada
- **Fecha:** 2026-08
- **Depende de:** 001-fundacion

## 1. Qué problema resuelve

El proyecto de Supabase de DocuNOVA está en **Plan Free**: Supabase **pausa** los
proyectos gratuitos tras **7 días sin actividad**. Si eso ocurre, la aplicación
queda sin base de datos hasta que alguien la reactive a mano desde el panel de
Supabase.

Además, el Plan Free tiene cupos (500 MB de base de datos, 1 GB de Storage,
60 conexiones) que hoy nadie vigila: el equipo se enteraría de que se agotaron
cuando la aplicación fallara.

CampusNOVA y CrediNOVA ya resolvieron esto con un "Monitoreo Supabase" dentro de
su módulo de Configuración. DocuNOVA replica esa capacidad, adaptada a su
arquitectura (Next.js con Server Actions en lugar de Edge Functions).

## 2. Alcance

Incluye:

- **Renombrar el módulo Gestión a Configuración** (`/gestion` → `/configuracion`)
  y agregarle, **después** de Usuarios, Estructura organizacional y Componentes
  Memoria Corporativa, la pestaña **Monitoreo Supabase**: uso frente a los
  límites del Plan Free (base de datos, Storage, usuarios de Auth, conexiones),
  las 10 tablas más pesadas, los buckets de Storage y el estado del keepalive.
  La pestaña es visible solo para **superadmin y rector**.
- **Funciones `monitor_*`** en la base de datos (migración `0013`), de solo
  lectura, ejecutables **únicamente por `service_role`**.
- **Keepalive**: tabla `monitoreo_keepalive` con el último latido, función
  `monitor_keepalive(origen)`, ruta pública `/api/keepalive`, cron externo en
  GitHub Actions cada 3 días y cron interno de respaldo con `pg_cron`.

No incluye: métricas que Supabase no expone por SQL (ancho de banda, invocaciones
de Edge Functions, minutos de cómputo), histórico de métricas, alertas por correo.

## 3. Comportamiento esperado (criterios de aceptación)

- **CA-1.** El módulo antes llamado "Gestión" se llama "Configuración" y vive en
  `/configuracion`; conserva sus pestañas (Usuarios, Estructura organizacional,
  Componentes Memoria Corporativa) y suma "Monitoreo Supabase" al final.
- **CA-2.** La pestaña Monitoreo Supabase solo la ven superadmin y rector (el
  administrador sigue viendo únicamente Componentes Memoria Corporativa). Al
  abrirla se cargan las métricas; el botón "Actualizar" vuelve a consultarlas.
- **CA-3.** Cada métrica se muestra con su porcentaje frente al límite del Plan
  Free, con nivel **Normal** (< 70 %), **Atención** (≥ 70 %) y **Crítico**
  (≥ 90 %), y un banner con el resumen global.
- **CA-4.** El bloque de keepalive indica cuándo fue el último latido, de qué
  origen y cuántos van; el botón "Latir ahora" registra uno inmediatamente.
- **CA-5.** `GET /api/keepalive` registra un latido y responde 200 con la marca
  de tiempo. Si `KEEPALIVE_SECRET` está definida, exige ese token y responde 401
  sin él.
- **CA-6.** El workflow `keepalive.yml` llama a esa ruta cada 3 días, con
  reintentos, de modo que el proyecto nunca acumula 7 días sin actividad.
- **CA-7.** Si falta `SUPABASE_SERVICE_ROLE_KEY` o la migración 0013, la pantalla
  explica qué falta en vez de mostrar datos en cero.

## 4. Seguridad

- Las funciones `monitor_*` son `SECURITY DEFINER` (leen catálogos del sistema y
  los esquemas `auth`/`storage`), así que su `EXECUTE` se revoca a `PUBLIC`,
  `anon` y `authenticated`, y se concede solo a `service_role`. El navegador no
  puede invocarlas: siempre pasa por un Server Action que comprueba el rol.
- `monitoreo_keepalive` tiene RLS activa y ninguna política, por lo que solo la
  clave de servicio (que omite RLS) la escribe.
- `/api/keepalive` es pública porque el cron externo no tiene sesión; no expone
  datos del sistema (solo la marca del latido) y admite protección por token.

## 5. Fuera de contexto / supuestos

- El latido eficaz es el **externo**: Supabase mide la inactividad por peticiones
  al proyecto, así que un cron interno de `pg_cron` por sí solo no garantiza
  evitar la pausa. Por eso el cron de GitHub Actions es el mecanismo principal y
  `pg_cron` la red de seguridad.
- Los límites del Plan Free están en `src/lib/monitoreo.ts`; si Supabase los
  cambia, se actualizan allí.
