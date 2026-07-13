#!/usr/bin/env bash
# Corre lint sobre el archivo editado y typecheck del proyecto tras cada
# Edit/Write en .ts/.tsx bajo src/. Bloquea con exit 2 si algo falla, en
# línea con el Harness Engineering exigido por memory/constitution.md.

set -u

INPUT="$(cat)"

FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
if [ -z "$FILE" ]; then
  exit 0
fi

case "$FILE" in
  */src/*.ts|*/src/*.tsx) ;;
  *) exit 0 ;;
esac

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 0

if [ ! -d node_modules ]; then
  echo "[harness] node_modules ausente; omito lint/typecheck." >&2
  exit 0
fi

LINT_OUT="$(npx --no-install eslint "$FILE" 2>&1)"
LINT_STATUS=$?
if [ "$LINT_STATUS" -ne 0 ]; then
  echo "[harness] eslint falló en $FILE:" >&2
  echo "$LINT_OUT" >&2
  exit 2
fi

TC_OUT="$(npx --no-install tsc --noEmit 2>&1)"
TC_STATUS=$?
if [ "$TC_STATUS" -ne 0 ]; then
  echo "[harness] typecheck falló tras editar $FILE:" >&2
  echo "$TC_OUT" >&2
  exit 2
fi

exit 0
