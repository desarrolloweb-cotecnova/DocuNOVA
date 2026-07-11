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
