<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Notably in Next.js 16: `middleware.ts` was renamed to `proxy.ts` (function `proxy`, nodejs runtime); `cookies()`/`headers()` are async; page `params`/`searchParams` are Promises.
<!-- END:nextjs-agent-rules -->

# DocuNOVA — Guía para agentes

DocuNOVA es el Sistema de Gestión de Documentos Electrónicos de Archivo (SGDEA)
de Cotecnova. Cumple normativa archivística colombiana (TRD / Ley 594 / AGN).

## Metodología

- **SDD (Spec Driven Development):** antes de programar, revisa/actualiza la spec
  en `specs/` y respeta `memory/constitution.md`.
- **Harness Engineering:** todo cambio debe pasar `npm run lint`,
  `npm run typecheck`, `npm run test` y `npm run build` antes de darse por hecho.

## Stack

Next.js 16 (App Router, `src/`), TypeScript, Tailwind v4 + shadcn/ui, Supabase
(`@supabase/ssr`, Auth + Postgres + RLS), Vercel.

## Reglas del proyecto

- Seguridad por defecto: RLS siempre activa; rol por defecto `consulta`.
- Secretos solo en variables de entorno; nunca en el repositorio.
- Cambios de base de datos solo por migraciones en `supabase/migrations/`.
- Interfaz y documentación de usuario en **español**.

## Comandos

`npm run dev | build | lint | typecheck | test | test:e2e`
Para e2e local con el Chromium preinstalado:
`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`

## Reglas para Claude Code — Ahorra Tokens

1. **No programar sin contexto:** lee los archivos relevantes, revisa git log,
   entiende la arquitectura antes de escribir código. Si falta contexto, pregunta.
2. **Respuestas cortas:** 1-3 oraciones, sin preámbulos ni resumen final. No
   repitas lo que dijo el usuario ni expliques lo obvio. No narres cada línea de código.
3. **No reescribir archivos completos:** usa Edit, nunca Write en archivos
   existentes salvo que el cambio sea >80% del archivo. Cambia solo lo necesario.
4. **No releer archivos ya leídos** en la conversación salvo que hayan cambiado.
5. **Validar antes de declarar hecho:** compila, corre tests o verifica que
   funciona. Nunca digas "listo" sin evidencia.
6. **Cero charla aduladora:** nada de "excelente pregunta", "perfecto", etc.
7. **Soluciones simples:** lo mínimo que resuelve el problema. Sin
   abstracciones, helpers ni validaciones no pedidas.
8. **No pelear con el usuario:** si pide algo, hazlo. Si discrepas, menciónalo
   en 1 oración y procede, salvo riesgo real de seguridad o pérdida de datos.
9. **Leer solo lo necesario:** usa offset/limit; Read directo si conoces la ruta.
10. **No narrar el plan antes de ejecutar.**
11. **Paralelizar tool calls** independientes en un solo mensaje.
12. **No duplicar código en la respuesta** que ya se ve en el diff.
13. **No usar Agent cuando Grep/Read basta.**
