# DocuNOVA

**Sistema de Gestión de Documentos Electrónicos de Archivo (SGDEA) de Cotecnova.**

Aplicación web para administrar documentos y expedientes conforme a la normativa
archivística colombiana (Tablas de Retención Documental, Ley 594 de 2000 y
lineamientos del Archivo General de la Nación).

> Este README es la guía principal. Está pensado para que puedas configurar y
> ejecutar el proyecto aunque tengas poca experiencia en programación.

---

## 🧱 Tecnologías

| Pieza | Tecnología | Para qué sirve |
| --- | --- | --- |
| Interfaz | **Next.js 16** (React) + TypeScript | La aplicación web |
| Estilos | **Tailwind CSS v4** + **shadcn/ui** | Diseño y componentes |
| Backend | **Supabase** | Base de datos, autenticación y archivos |
| Hosting | **Vercel** | Publicación de la app |

## 🧭 Metodología

- **SDD (Spec Driven Development):** cada funcionalidad se especifica antes de
  programarse. Ver `memory/constitution.md` y la carpeta `specs/`.
- **Harness Engineering:** un "arnés" de calidad (linter, tipos, pruebas, CI)
  detecta errores automáticamente antes de que lleguen a producción.

---

## 🚀 Puesta en marcha (local)

### 1. Requisitos

- **Node.js 20 o superior** (recomendado 20 LTS o 22).
- Una cuenta de **Supabase** con un proyecto creado.

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y complétalo con tus datos de Supabase:

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Encuentras estos valores en el panel de Supabase → **Project Settings → API**.
La `anon key` es pública (está protegida por las reglas de seguridad RLS de la
base de datos).

> ⚠️ **Nunca** subas `.env.local` al repositorio (ya está en `.gitignore`).

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abre <http://localhost:3000>.

---

## ⚙️ Configuración de Supabase (una sola vez)

Para que el inicio de sesión funcione, configura tu proyecto de Supabase:

### A. Aplicar la base de datos

En el panel de Supabase → **SQL Editor**, pega y ejecuta el contenido de
`supabase/migrations/0001_init.sql`. Esto crea las tablas de usuarios, roles y
dependencias con seguridad (RLS) activada.

### B. Activar Google como proveedor

1. **Google Cloud Console** (<https://console.cloud.google.com>):
   - Crea (o usa) un proyecto → **APIs y servicios → Credenciales**.
   - Crea unas **Credenciales de ID de cliente de OAuth** de tipo *Aplicación
     web*.
   - En **URIs de redirección autorizados** agrega la que te da Supabase en
     Authentication → Providers → Google (algo como
     `https://TU-PROYECTO.supabase.co/auth/v1/callback`).
   - Copia el **Client ID** y el **Client Secret**.
2. **Supabase** → **Authentication → Providers → Google**: pega el Client ID y el
   Client Secret y activa el proveedor.
3. **Supabase** → **Authentication → URL Configuration**:
   - *Site URL:* `http://localhost:3000` (y luego la URL de Vercel).
   - *Redirect URLs:* agrega `http://localhost:3000/auth/callback` y
     `https://TU-DOMINIO.vercel.app/auth/callback`.

> El dominio institucional se refuerza además en el código (solo se aceptan
> correos `@cotecnova.edu.co`).

### C. Activar el segundo factor (MFA/TOTP)

En **Authentication → Multi-Factor Authentication**, habilita **TOTP
(Authenticator app)**. La app exige el segundo factor a todos los usuarios.

### D. Promover al primer administrador

Después de tu primer inicio de sesión, en el **SQL Editor**:

```sql
update public.profiles
set role = 'super_admin'
where email = 'TU_CORREO@cotecnova.edu.co';
```

---

## ☁️ Despliegue en Vercel

1. Entra a <https://vercel.com> e **importa** el repositorio de GitHub.
2. En **Settings → Environment Variables** agrega `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Añade la URL de producción a las *Redirect URLs* de Supabase (paso B.3).
4. Cada `git push` a la rama desplegará automáticamente.

---

## 🧪 El arnés de calidad

```bash
npm run lint        # Revisa estilo y errores comunes
npm run typecheck   # Verifica los tipos de TypeScript
npm run test        # Pruebas unitarias (Vitest)
npm run build       # Compila para producción
npm run test:e2e    # Pruebas de extremo a extremo (Playwright)
```

La **CI de GitHub Actions** (`.github/workflows/ci.yml`) ejecuta todo esto en
cada push y pull request.

---

## 📁 Estructura del proyecto

```
src/
├─ app/                     Rutas (App Router)
│  ├─ login/                Inicio de sesión con Google
│  ├─ auth/                 Callback OAuth y cierre de sesión
│  ├─ mfa/                  Enrolar/verificar segundo factor
│  └─ (app)/                Área privada (exige MFA): dashboard, etc.
├─ components/              Componentes (ui/ = shadcn/ui)
├─ lib/                     Utilidades, config, clientes de Supabase, roles
└─ proxy.ts                 "Middleware" de Next 16: sesión y protección de rutas
supabase/migrations/        Esquema de base de datos (SQL versionado)
specs/                      Especificaciones (SDD)
memory/constitution.md      Principios del proyecto (SDD)
```

---

## 🗺️ Fases del proyecto

- **Fase 0 — Fundación** ✅ Autenticación (Google + MFA), roles, RLS, arnés, SDD.
- **Fase 1 — TRD:** dependencias, series y subseries documentales.
- **Fase 2 — Repositorio y Expedientes.**
- **Fase 3 — Flujos de aprobación y firma electrónica simple.**
- **Fase 4 — Notificaciones, tablero y reportes.**
