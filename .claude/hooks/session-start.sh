#!/usr/bin/env bash
# Hook de inicio de sesión (Harness) para Claude Code en la web.
# Prepara el entorno para que se puedan correr pruebas, linter y build.
set -euo pipefail

# Ubicarse en la raíz del repositorio (dos niveles arriba de este script).
cd "$(dirname "$0")/../.."

echo "[DocuNOVA] Preparando entorno de desarrollo…"

if [ ! -d node_modules ]; then
  echo "[DocuNOVA] Instalando dependencias (npm ci)…"
  npm ci || npm install
else
  echo "[DocuNOVA] Dependencias ya instaladas."
fi

if [ ! -f .env.local ]; then
  echo "[DocuNOVA] Aviso: no existe .env.local."
  echo "           Copia .env.example a .env.local y coloca tus claves de Supabase."
fi

echo "[DocuNOVA] Listo. Scripts útiles:"
echo "           npm run dev | lint | typecheck | test | build"
