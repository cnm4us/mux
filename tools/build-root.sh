#!/usr/bin/env bash
set -euo pipefail

echo "[build-root] Building web (base=/)"
pushd "$(dirname "$0")/.." >/dev/null

npm -w web run build

echo "[build-root] Deploying to /var/www/mux-spa/"
sudo rsync -a --delete web/dist/ /var/www/mux-spa/

echo "[build-root] Done. Consider: sudo nginx -t && sudo nginx -s reload"

popd >/dev/null

