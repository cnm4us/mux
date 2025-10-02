#!/usr/bin/env bash
set -euo pipefail

# Unified web deploy (rsync) script
# - Root deploy (default): /var/www/mux-spa/
# - Scoped deploy: set BUILD_ID to deploy to /var/www/mux-spa-builds/$BUILD_ID/

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/web/dist"
echo "[web-deploy] DEBUG: FORCE_ROOT=${FORCE_ROOT:-0} BUILD_ID=${BUILD_ID:-}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "[web-deploy] ERROR: $DIST_DIR not found. Run tools/web-build.sh first." >&2
  exit 1
fi

# Determine destination
if [[ "${FORCE_ROOT:-0}" == "1" ]]; then
  # Force deploy to root regardless of LAST_BUILD_ID
  DEST="/var/www/mux-spa/"
  echo "[web-deploy] FORCE_ROOT=1 → deploying to root (${DEST})"
else
  # If no BUILD_ID provided, try to use the last one
  if [[ -z "${BUILD_ID:-}" && -f "$ROOT_DIR/tools/LAST_BUILD_ID" ]]; then
    BUILD_ID="$(tr -d '\n' < "$ROOT_DIR/tools/LAST_BUILD_ID")"
    echo "[web-deploy] Using last BUILD_ID from tools/LAST_BUILD_ID: ${BUILD_ID}"
  fi
  if [[ -n "${BUILD_ID:-}" ]]; then
    DEST="/var/www/mux-spa-builds/${BUILD_ID}/"
  else
    DEST="/var/www/mux-spa/"
    echo "[web-deploy] NOTE: BUILD_ID not set → deploying to root (${DEST})" >&2
  fi
fi

echo "[web-deploy] Deploying dist → ${DEST}"
sudo mkdir -p "$DEST"
sudo rsync -a --delete "$DIST_DIR/" "$DEST"

echo "[web-deploy] Done. Remember to reload Nginx if you changed includes."
