# Plan técnico 001 — Fundación y Autenticación

Implementa [spec.md](./spec.md).

## Stack

- **Next.js 16** (App Router, TypeScript) — `src/`.
- **Tailwind CSS v4** + **shadcn/ui** — `src/components/ui/`.
- **Supabase** (`@supabase/ssr`) — Auth + Postgres + RLS.
- **Vercel** — hosting.

## Piezas y responsabilidades

| Área | Archivo(s) | Responsabilidad |
| --- | --- | --- |
| Guard de dominio | `src/lib/auth/domain.ts` (+ test) | Valida `@cotecnova.edu.co` |
| Clientes Supabase | `src/lib/supabase/{client,server,proxy,env}.ts` | Sesión por cookies |
| Proxy (middleware) | `src/proxy.ts` | Refresca sesión, protege rutas, guard de dominio |
| Login | `src/app/login/page.tsx`, `src/components/auth/google-sign-in-button.tsx` | OAuth Google con `hd` |
| Callback / signout | `src/app/auth/callback/route.ts`, `src/app/auth/signout/route.ts` | Intercambio de código + validación de dominio; cierre de sesión |
| MFA | `src/app/mfa/enroll/page.tsx`, `src/app/mfa/verify/page.tsx` | Enrolar/verificar TOTP |
| Panel privado | `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/components/app-shell.tsx` | Exige `aal2`, muestra shell |
| Base de datos | `supabase/migrations/0001_init.sql` | `profiles`, `user_role`, `dependencias`, trigger, RLS |

## Decisiones clave

- **Next 16 renombró `middleware` → `proxy`** (runtime nodejs). El archivo es
  `src/proxy.ts` y exporta `proxy()`.
- **La exigencia de MFA (`aal2`) se hace en el layout privado**, no en el proxy,
  porque ahí se pueden consultar los factores del usuario y decidir entre
  enrolar o verificar.
- **Doble validación de dominio:** `hd` en Google (pista) + verificación estricta
  en el servidor (callback y proxy).
- **Rol por defecto `consulta`** (mínimo privilegio). El primer `super_admin` se
  promueve manualmente por SQL (ver nota en la migración).
- Se pospone `react-hook-form`/`zod`: los formularios de esta fase (código OTP)
  son simples; se añadirán al construir formularios ricos (Fase 1).

## Verificación

`npm run lint && npm run typecheck && npm run test && npm run build`, e2e con
Playwright, y prueba real de login → MFA → panel con credenciales configuradas.
