#!/usr/bin/env bash
# Thin Playwright E2E runner for the OpenPlay stack (ADR-0008).
# Requires the running docker-compose stack (backend :8000, portals :3000-:3003)
# with demo seed data. The isolated E2E world (postgres-e2e overlay) is out of
# scope here — this just runs the suites in tests/e2e.
#
# Usage:
#   scripts/e2e.sh [--headed] [extra playwright args...]
set -euo pipefail

cd "$(dirname "$0")/../tests/e2e"

if ! npx --no-install playwright --version >/dev/null 2>&1; then
  echo "e2e: @playwright/test not installed." >&2
  echo "     cd tests/e2e && npm install" >&2
  exit 2
fi

if [[ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ]]; then
  BROWSERS_DIR="$PLAYWRIGHT_BROWSERS_PATH"
elif [[ "$(uname)" == "Darwin" ]]; then
  BROWSERS_DIR="$HOME/Library/Caches/ms-playwright"
else
  BROWSERS_DIR="$HOME/.cache/ms-playwright"
fi
if ! ls "$BROWSERS_DIR"/chromium* >/dev/null 2>&1; then
  echo "e2e: warning — Playwright chromium looks missing." >&2
  echo "     run: cd tests/e2e && npx playwright install chromium" >&2
fi

exec npx playwright test "$@"
