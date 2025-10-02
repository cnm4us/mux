#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_ID="${BUILD_ID:-$(date +%Y%m%d%H%M%S)-$(git -C "$ROOT_DIR" rev-parse --short HEAD)}"
BASE="/b/${BUILD_ID}/"

echo "[build-scoped] BUILD_ID=${BUILD_ID} BASE=${BASE}"
pushd "$ROOT_DIR" >/dev/null

echo "[build-scoped] Building web with base=${BASE}"
VITE_BASE="$BASE" npm -w web run build

DEST="/var/www/mux-spa-builds/${BUILD_ID}/"
echo "[build-scoped] Deploying to ${DEST}"
sudo mkdir -p "$DEST"
sudo rsync -a --delete web/dist/ "$DEST"

CONF_DIR="/etc/nginx/mux/builds"
sudo mkdir -p "$CONF_DIR"

TEMPLATE="$ROOT_DIR/tools/build.scoped.EXAMPLE.conf"
OUT_CONF="${CONF_DIR}/${BUILD_ID}.conf"
echo "[build-scoped] Writing ${OUT_CONF}"
sudo bash -c "sed 's/BUILD_ID/${BUILD_ID}/g' '$TEMPLATE' > '$OUT_CONF'"

echo "[build-scoped] To test side-by-side: include a scoped path-only conf (no root redirect)."
SIDE_TEMPLATE="$ROOT_DIR/tools/build.scoped.SIDEBYSIDE.EXAMPLE.conf"
if [[ -f "$SIDE_TEMPLATE" ]]; then
  SIDE_OUT="${CONF_DIR}/${BUILD_ID}.sideby.conf"
  sudo bash -c "sed 's/BUILD_ID/${BUILD_ID}/g' '$SIDE_TEMPLATE' > '$SIDE_OUT'"
  echo "[build-scoped] Side-by-side conf: $SIDE_OUT"
fi

echo "[build-scoped] You can now add: include ${OUT_CONF}; or for side-by-side include ${SIDE_OUT} in /etc/nginx/mux/build.current.conf and reload nginx."

popd >/dev/null

# Record BUILD_ID for convenience
LOG_FILE="$ROOT_DIR/tools/build-ids.log"
LAST_FILE="$ROOT_DIR/tools/LAST_BUILD_ID"
NOW_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "${NOW_UTC} ${BUILD_ID}" >> "$LOG_FILE"
echo -n "$BUILD_ID" > "$LAST_FILE"
echo "[build-scoped] Recorded BUILD_ID in $LOG_FILE and $LAST_FILE"
