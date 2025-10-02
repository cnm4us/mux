#!/usr/bin/env bash
set -euo pipefail

# Unified web build script
# - Root build (default): base=/
# - Scoped build: set BUILD_ID (or VITE_BASE) to generate base=/b/$BUILD_ID/

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BASE="/"
if [[ -n "${BUILD_ID:-}" ]]; then
  BASE="/b/${BUILD_ID}/"
elif [[ -n "${VITE_BASE:-}" ]]; then
  BASE="$VITE_BASE"
fi

echo "[web-build] BASE=${BASE} ${BUILD_ID:+(BUILD_ID=${BUILD_ID})}"
VITE_BASE="$BASE" npm -w web run build

echo "[web-build] Done. Artifacts at: web/dist (base=${BASE})"

# Record build id for convenience (only if we have one)
if [[ -n "${BUILD_ID:-}" ]]; then
  LOG_FILE="$ROOT_DIR/tools/build-ids.log"
  LAST_FILE="$ROOT_DIR/tools/LAST_BUILD_ID"
  NOW_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "${NOW_UTC} ${BUILD_ID}" >> "$LOG_FILE"
  echo -n "$BUILD_ID" > "$LAST_FILE"
  echo "[web-build] Recorded BUILD_ID in $LOG_FILE and $LAST_FILE"
fi
