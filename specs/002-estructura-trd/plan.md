# Plan técnico 002 — Estructura organizacional, TRD, usuarios y activación

Implementa [spec.md](./spec.md).

## Migraciones (Supabase)

| Archivo | Contenido |
| --- | --- |
| `0002_estructura_organizacional.sql` | Tablas `ejes`, `macroprocesos`, `procesos`, `oficinas_productoras`; `profiles.proceso_id`/`oficina_id`; retira `dependencias`; funciones `is_super_admin`, `current_user_proceso`, `can_manage_proceso`; RLS del catálogo |
| `0003_trd_catalogo.sql` | Tablas `series` y `subseries` (soporte, retención, disposición); RLS |
| `0004_semilla_y_activacion.sql` | `usuarios_semilla`, `datos_sensibles`; `is_active` default `false`; reescritura de `handle_new_user`; trigger `protect_profile_privileges`; políticas de `profiles` |
| `0005_seed_datos.sql` | **Generado** con los INSERT de estructura, TRD y usuarios |

## Generador de seed

- `data/trd_cotecnova.csv`, `data/usuarios_seed.csv` — CSV reales versionados.
- `scripts/lib/csv.mjs` — parser RFC 4180 (respeta comillas y saltos de línea).
- `scripts/lib/org-data.mjs` — estructura canónica (niveles 1-3) del prompt.
- `scripts/lib/mapping.mjs` — reglas CSV→modelo (roles, oficina, soportes).
- `scripts/lib/seed-model.mjs` — construye el modelo con UUID deterministas.
- `scripts/generate-seed.mjs` — emite `0005_seed_datos.sql`. Reejecutable.

## Aplicación (Next.js 16)

| Ruta | Archivo | Responsabilidad |
| --- | --- | --- |
| Guard de activación | `src/app/(app)/layout.tsx` + `src/lib/auth/activation.ts` | Inactivo → `/pendiente` |
| Cuenta pendiente | `src/app/pendiente/page.tsx` | Mensaje + cerrar sesión |
| Admin (guard) | `src/app/(app)/admin/layout.tsx` | Solo `super_admin` |
| Usuarios | `src/app/(app)/admin/usuarios/{page,actions}.tsx` | Activar y asignar rol/proceso/oficina |
| Estructura | `src/app/(app)/admin/estructura/{page,actions}.tsx` | Árbol + renombrar/inactivar |
| TRD | `src/app/(app)/trd/page.tsx` | Series/subseries por proceso |
| Navegación | `src/lib/navigation.ts`, `src/components/app-shell.tsx` | Habilita `/trd`, `/admin` por rol |
| Tipos | `src/lib/org.ts`, `src/lib/roles.ts` | Tipos del catálogo y helpers de rol |

## Decisiones clave

- **El Proceso es la unidad de permisos**; la Oficina Productora es clasificación
  interna. Se mantienen los **5 roles** de la Fase 0 (decisión del usuario).
- **Pre-registro + trigger**: no se pueden pre-crear usuarios de Supabase Auth;
  el perfil real se materializa en el primer login desde `usuarios_semilla`.
- **Cédula aislada** en `datos_sensibles` con RLS estricta (Ley 1581).
- **Anti-escalada de privilegios** con trigger `protect_profile_privileges`: la
  edición del propio perfil no puede tocar rol/estado/proceso/oficina.
- **`Cod_Serie` del CSV repite el código de oficina**; la identidad de la serie
  es su nombre → clave de agrupación `oficina + nombre`.

## Verificación

- `node scripts/generate-seed.mjs` (conteos 3/10/16/25/128/230/38).
- `npm run lint && npm run typecheck && npm run test && npm run build`.
- `supabase/tests/rls.sql` contra un branch de Supabase (aislamiento por proceso,
  cédula restringida, activación por defecto).
- Manual: login super admin (activo) vs. otra cuenta (→ `/pendiente` → activar en
  `/admin/usuarios`) y consulta de `/trd`.
