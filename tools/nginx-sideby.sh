#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BUILD_ID:-}" && -f "tools/LAST_BUILD_ID" ]]; then
  BUILD_ID="$(cat tools/LAST_BUILD_ID | tr -d '\n')"
  echo "[nginx-sideby] Using last BUILD_ID from tools/LAST_BUILD_ID: ${BUILD_ID}"
fi
if [[ -z "${BUILD_ID:-}" ]]; then
  echo "[nginx-sideby] ERROR: Set BUILD_ID=… first (or build once to create tools/LAST_BUILD_ID)" >&2
  exit 1
fi

CONF_DIR="/etc/nginx/mux/builds"
SIDE_OUT="$CONF_DIR/${BUILD_ID}.sideby.conf"

echo "[nginx-sideby] Writing side-by include: $SIDE_OUT"
sudo mkdir -p "$CONF_DIR"
sudo bash -c "sed 's/BUILD_ID/${BUILD_ID}/g' tools/build.scoped.SIDEBYSIDE.EXAMPLE.conf > '$SIDE_OUT'"

INCLUDE_FILE="/etc/nginx/mux/build.current.conf"
BEGIN_MARK="# BEGIN mux side-by includes"
END_MARK="# END mux side-by includes"
LINE="include $SIDE_OUT;"

# Ensure region exists in include file
if ! sudo grep -qF "$BEGIN_MARK" "$INCLUDE_FILE" 2>/dev/null; then
  echo "[nginx-sideby] Creating side-by include region in $INCLUDE_FILE"
  sudo bash -c "echo -e '\n$BEGIN_MARK\n$END_MARK' >> '$INCLUDE_FILE'"
fi

# Optionally make this include exclusive by commenting other side-by includes in the region
if [[ "${EXCLUSIVE:-0}" == "1" ]]; then
  echo "[nginx-sideby] EXCLUSIVE=1 → commenting other side-by includes in region"
  sudo awk -v b="$BEGIN_MARK" -v e="$END_MARK" 'BEGIN{inblk=0} {
    if(index($0,b)){inblk=1; print; next}
    if(index($0,e)){inblk=0; print; next}
    if(inblk && $0 ~ /include \/etc\/nginx\/mux\/builds\/.*\.sideby\.conf;/ && $0 !~ /disabled by nginx-sideby/){
      print "# disabled by nginx-sideby: "$0
      next
    }
    print
  }' "$INCLUDE_FILE" | sudo tee "$INCLUDE_FILE.tmp" >/dev/null && sudo mv "$INCLUDE_FILE.tmp" "$INCLUDE_FILE"
fi

# Add the include line inside the region if not already present
if ! sudo grep -qF "$LINE" "$INCLUDE_FILE" 2>/dev/null; then
  echo "[nginx-sideby] Adding include line inside region"
  sudo awk -v b="$BEGIN_MARK" -v e="$END_MARK" -v l="$LINE" 'BEGIN{inblk=0; added=0} {
    if(index($0,b)){inblk=1; print; next}
    if(index($0,e)){ if(inblk && !added){ print l } ; inblk=0; print; next}
    print
  }' "$INCLUDE_FILE" | sudo tee "$INCLUDE_FILE.tmp" >/dev/null && sudo mv "$INCLUDE_FILE.tmp" "$INCLUDE_FILE"
else
  echo "[nginx-sideby] Include already present"
fi

echo "[nginx-sideby] Reloading Nginx"
sudo nginx -t
sudo nginx -s reload

# Discover domain to print absolute URLs
# Force the mux subdomain by default; allow override via SITE_ORIGIN if explicitly provided.
ORIGIN="${SITE_ORIGIN:-https://mux.bawebtech.com}"

# List all active side-by includes as absolute URLs
ACTIVE_IDS=$(sudo awk '/\.sideby\.conf;/{print}' "$INCLUDE_FILE" 2>/dev/null | sed -n 's#.*builds/\(.*\)\.sideby\.conf;#\1#p')
if [[ -n "$ACTIVE_IDS" ]]; then
  echo "[nginx-sideby] Active side-by deployments:"
  while read -r id; do
    [[ -z "$id" ]] && continue
    if [[ -n "$ORIGIN" ]]; then
      echo "  - $ORIGIN/b/$id/"
    else
      echo "  - /b/$id/"
    fi
  done <<< "$ACTIVE_IDS"
else
  # Fallback to the one we just added
  if [[ -n "$ORIGIN" ]]; then
    echo "[nginx-sideby] Done. Test at: $ORIGIN/b/$BUILD_ID/"
  else
    echo "[nginx-sideby] Done. Test at: /b/$BUILD_ID/"
  fi
fi
