# Tareas 001 — Fundación y Autenticación

Estado de las tareas de la Fase 0. Marca `[x]` al completar.

## Andamiaje

- [x] Scaffold Next.js 16 + TypeScript + Tailwind v4
- [x] shadcn/ui (utils, button, card, input, label) + tokens de tema
- [x] Scripts npm: dev, build, lint, typecheck, test, format

## Autenticación

- [x] `isAllowedEmail` + pruebas unitarias
- [x] Clientes Supabase (browser, server, proxy) con `@supabase/ssr`
- [x] `src/proxy.ts`: refresco de sesión + protección de rutas + guard de dominio
- [x] Login con Google (parámetro `hd`)
- [x] Callback OAuth con validación estricta de dominio
- [x] Cierre de sesión (GET/POST)
- [x] MFA: enrolamiento (QR) y verificación (TOTP)
- [x] Layout privado que exige `aal2`

## Base de datos

- [x] Migración `0001_init.sql`: `user_role`, `dependencias`, `profiles`
- [x] Trigger `handle_new_user`
- [x] RLS + políticas + funciones `current_user_role` / `is_archivo_admin`

## Arnés

- [x] ESLint + Prettier + tsconfig strict
- [x] Vitest (unit) + Playwright (e2e smoke)
- [x] CI en GitHub Actions
- [x] SessionStart hook para Claude Code web

## Configuración por el administrador (fuera del código)

- [ ] Activar proveedor Google en Supabase
- [ ] Activar MFA (TOTP) en Supabase
- [ ] Crear credenciales OAuth en Google Cloud (dominio restringido)
- [ ] Aplicar la migración a la base de datos
- [ ] Cargar variables de entorno en Vercel y desplegar
- [ ] Promover al primer `super_admin` por SQL
