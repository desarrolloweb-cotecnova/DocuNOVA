# Guía de despliegue de DocuNOVA (Vercel + Supabase)

Guía paso a paso para poner DocuNOVA en línea. No requiere conocimientos
técnicos avanzados. Tiempo estimado: 15–20 minutos.

> **Antes de empezar** debes tener ya aplicadas las migraciones en Supabase
> (archivo `supabase/INSTALACION_COMPLETA.sql` ejecutado con éxito) y el
> proveedor **Google** habilitado en Supabase → Authentication.

---

## Paso 1 · Copia tus claves de Supabase

1. Entra a <https://supabase.com> → tu proyecto.
2. Menú **Project Settings → API**.
3. Copia estos dos valores (los usarás en el Paso 3):
   - **Project URL** — algo como `https://xxxx.supabase.co`
   - **anon public** (Project API keys) — una cadena larga que empieza por `eyJ…`

> La clave **service_role** NO se usa; no la copies ni la publiques.

---

## Paso 2 · Importa el proyecto en Vercel

1. Entra a <https://vercel.com> e inicia sesión **con GitHub**.
2. Clic en **Add New… → Project**.
3. Busca el repositorio **`desarrolloweb-cotecnova/docunova`** y presiona **Import**.
4. Vercel detecta **Next.js** automáticamente (no cambies nada del framework).
5. **No presiones Deploy todavía**: primero agrega las variables (Paso 3).

---

## Paso 3 · Agrega las variables de entorno

En la misma pantalla de importación, abre **Environment Variables** y agrega:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | el *Project URL* del Paso 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la *anon public* del Paso 1 |

Luego presiona **Deploy** y espera 1–2 minutos.

---

## Paso 4 · Usa la rama correcta como producción (IMPORTANTE)

Todo el código de DocuNOVA está en la rama
**`claude/docunova-insforge-setup-8kju0g`** (no en `main`). Configúrala como
rama de producción:

1. En Vercel, abre tu proyecto → **Settings → Git**.
2. En **Production Branch**, escribe:
   `claude/docunova-insforge-setup-8kju0g`
3. **Save**.
4. Ve a **Deployments** → menú `⋯` del último despliegue → **Redeploy**.

> A partir de aquí, cada cambio que se suba a esa rama vuelve a desplegar solo.

Cuando termine, Vercel te dará una URL como `https://docunova-xxxx.vercel.app`.
Cópiala para el Paso 5.

---

## Paso 5 · Autoriza esa URL en Supabase

Para que el inicio de sesión con Google regrese correctamente a tu aplicación:

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL**: pega la URL de Vercel (ej. `https://docunova-xxxx.vercel.app`).
3. **Redirect URLs** → **Add URL**: `https://docunova-xxxx.vercel.app/**`
4. **Save**.

> El proveedor Google en Supabase ya apunta a su propia URL de callback
> (`https://TU-PROYECTO.supabase.co/auth/v1/callback`), que a su vez ya está
> autorizada en Google Cloud. No necesitas tocar Google Cloud para esto.

---

## Paso 6 · Prueba

1. Abre la URL de Vercel.
2. **Iniciar sesión con Google** con `desarrolloweb@cotecnova.edu.co`
   (queda como Super Administrador activo automáticamente).
3. Configura el segundo factor (MFA/TOTP) escaneando el QR.
4. Entra al panel: ya puedes activar usuarios en **Administración → Usuarios**
   y consultar la **TRD**.

---

## Paso 7 · Evita que Supabase pause la base de datos (Plan Free)

Supabase **pausa** los proyectos del Plan Free tras **7 días sin actividad**.
DocuNOVA trae un *keepalive* que lo evita y un módulo para vigilar el consumo.

1. **Aplica la migración** `supabase/migrations/0013_monitoreo_supabase.sql`
   (Supabase → SQL Editor → pega el archivo → Run). Crea las funciones de
   monitoreo, la tabla del keepalive y, si `pg_cron` está disponible, un cron
   interno de respaldo cada 3 días.
2. **Agrega la clave de servicio en Vercel** (Settings → Environment Variables):
   `SUPABASE_SERVICE_ROLE_KEY` con la *service_role* de Supabase → Settings →
   API. Sin ella no hay monitoreo ni latido.
3. **Opcional pero recomendado:** define también `KEEPALIVE_SECRET` con una
   cadena larga y aleatoria, para que solo el cron pueda llamar al latido.
4. **Configura el cron externo** en GitHub (Settings → Secrets and variables →
   Actions → New repository secret):

   | Name | Value |
   |---|---|
   | `KEEPALIVE_URL` | `https://TU-DOMINIO/api/keepalive` |
   | `KEEPALIVE_SECRET` | el mismo valor que pusiste en Vercel (si lo usaste) |

   El workflow **Keepalive Supabase** (`.github/workflows/keepalive.yml`) se
   ejecuta cada 3 días; también puedes lanzarlo a mano desde la pestaña
   **Actions → Keepalive Supabase → Run workflow** para probarlo.
5. **Verifica** entrando como rector o superadmin a **Configuración** (el módulo
   que antes se llamaba Gestión) **→ pestaña Monitoreo Supabase**: allí se ve el
   uso frente a los límites del Plan Free y la fecha del último latido, con un
   botón **Latir ahora**.

---

## Preguntas frecuentes

- **Cambié algo en el código, ¿cómo actualizo el sitio?** Se actualiza solo al
  subir cambios a la rama de producción. También puedes **Redeploy** manual en
  Vercel.
- **Sale error de dominio al entrar.** Solo se permiten correos
  `@cotecnova.edu.co`. Verifica que el proveedor Google esté habilitado en
  Supabase.
- **El login no regresa a la app.** Revisa el Paso 5 (Site URL y Redirect URLs
  deben incluir tu dominio de Vercel).
- **Dominio propio (ej. docunova.cotecnova.edu.co).** Se agrega en Vercel →
  Settings → Domains, y luego se repite el Paso 5 con el nuevo dominio.
- **La base de datos aparece "pausada" en Supabase.** Reactívala desde el panel
  de Supabase y revisa el Paso 7: lo más probable es que falte el secreto
  `KEEPALIVE_URL` en GitHub o la clave de servicio en Vercel.
- **En Configuración → Monitoreo Supabase no salen datos.** El mensaje de error
  indica la causa: falta `SUPABASE_SERVICE_ROLE_KEY` en Vercel o falta aplicar
  la migración `0013_monitoreo_supabase.sql`.
