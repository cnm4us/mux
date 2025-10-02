#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONF_DIR="/etc/nginx/mux/builds"
INCLUDE_FILE="/etc/nginx/mux/build.current.conf"
BEGIN_MARK="# BEGIN mux side-by includes"
END_MARK="# END mux side-by includes"

echo "[nginx-sideby-clean] Cleaning all side-by deployments (includes, confs, and build folders)"

# If build.current.conf is a symlink to a flip conf, replace with the root sample to avoid dangling includes
if sudo test -L "$INCLUDE_FILE"; then
  echo "[nginx-sideby-clean] $INCLUDE_FILE is a symlink; replacing with root sample"
  sudo cp "$ROOT_DIR/tools/build.current.conf.sample" "$INCLUDE_FILE"
fi

# Backup include file if it exists
if sudo test -f "$INCLUDE_FILE"; then
  TS="$(date -u +%Y%m%d%H%M%S)"
  BK="$INCLUDE_FILE.bak.$TS"
  echo "[nginx-sideby-clean] Backing up $INCLUDE_FILE → $BK"
  sudo cp "$INCLUDE_FILE" "$BK"
else
  echo "[nginx-sideby-clean] NOTE: $INCLUDE_FILE not found (skipping backup)"
fi

# Reset the managed region (remove any side-by include lines inside the region)
if sudo grep -qF "$BEGIN_MARK" "$INCLUDE_FILE" 2>/dev/null; then
  echo "[nginx-sideby-clean] Resetting side-by include region in $INCLUDE_FILE"
  sudo awk -v b="$BEGIN_MARK" -v e="$END_MARK" 'BEGIN{inblk=0} {
    if(index($0,b)){inblk=1; print $0; next}
    if(index($0,e)){inblk=0; print $0; next}
    if(inblk){ next }  # drop lines inside the region
    print $0
  }' "$INCLUDE_FILE" | sudo tee "$INCLUDE_FILE.tmp" >/dev/null && sudo mv "$INCLUDE_FILE.tmp" "$INCLUDE_FILE"
else
  # No region; remove any stray side-by includes anywhere
  echo "[nginx-sideby-clean] No region found; removing stray side-by include lines (if any)"
  sudo awk '/\.sideby\.conf;/{ next } { print }' "$INCLUDE_FILE" 2>/dev/null | sudo tee "$INCLUDE_FILE.tmp" >/dev/null || true
  if sudo test -f "$INCLUDE_FILE.tmp"; then sudo mv "$INCLUDE_FILE.tmp" "$INCLUDE_FILE"; fi
fi

# Remove all side-by conf files and full flip confs
if sudo test -d "$CONF_DIR"; then
  SIDEBY_LIST=$(sudo sh -c "ls -1 $CONF_DIR/*.sideby.conf 2>/dev/null || true")
  FULL_LIST=$(sudo sh -c "ls -1 $CONF_DIR/*.conf 2>/dev/null || true")
  if [[ -n "$SIDEBY_LIST" ]]; then
    echo "[nginx-sideby-clean] Removing side-by conf files:"
    echo "$SIDEBY_LIST" | sed 's/^/  - /'
    sudo rm -f $CONF_DIR/*.sideby.conf || true
  else
    echo "[nginx-sideby-clean] No side-by conf files found in $CONF_DIR"
  fi
  if [[ -n "$FULL_LIST" ]]; then
    echo "[nginx-sideby-clean] Removing full flip conf files:"
    echo "$FULL_LIST" | sed 's/^/  - /'
    sudo rm -f $CONF_DIR/*.conf || true
  else
    echo "[nginx-sideby-clean] No full flip conf files found in $CONF_DIR"
  fi
else
  echo "[nginx-sideby-clean] NOTE: $CONF_DIR does not exist"
fi

# Remove all build folders under /var/www/mux-spa-builds
if sudo test -d "/var/www/mux-spa-builds"; then
  echo "[nginx-sideby-clean] Removing all build folders under /var/www/mux-spa-builds"
  sudo rm -rf /var/www/mux-spa-builds/*
else
  echo "[nginx-sideby-clean] NOTE: /var/www/mux-spa-builds does not exist"
fi

echo "[nginx-sideby-clean] Reloading Nginx"
sudo nginx -t
sudo nginx -s reload

echo "[nginx-sideby-clean] Done"
