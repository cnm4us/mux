# -------------------------
# HTTP → HTTPS redirect
# -------------------------
server {
  listen 80;
  server_name mux.bawebtech.com;
  return 301 https://$host$request_uri;
}

# -------------------------
# HTTPS site
# -------------------------
server {
  listen 443 ssl http2;
  server_name mux.bawebtech.com;

  # --- Certbot-managed TLS ---
  ssl_certificate     /etc/letsencrypt/live/mux.bawebtech.com/fullchain.pem; # managed by Certbot
  ssl_certificate_key /etc/letsencrypt/live/mux.bawebtech.com/privkey.pem;   # managed by Certbot
  include             /etc/letsencrypt/options-ssl-nginx.conf;               # managed by Certbot
  ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;                     # managed by Certbot

  # Body size: uploads go direct to Mux, so modest is fine
  client_max_body_size 5m;

  # Common proxy headers
  proxy_set_header Host              $host;
  proxy_set_header X-Real-IP         $remote_addr;
  proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  # WebSocket-friendly headers (harmless if unused)
  # proxy_set_header Upgrade $http_upgrade;
  # proxy_set_header Connection $connection_upgrade;

  # -------------------------
  # API → Node on localhost:3200
  # -------------------------
  location /api/ {
    # remove the trailing slash so nginx forwards the full original path
    proxy_pass http://127.0.0.1:3200;
    proxy_http_version 1.1;

    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_read_timeout 300;
    proxy_send_timeout 300;
  }


  # SPA entry — always serve fresh HTML
  location = /index.html {
    root /var/www/mux-spa;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files /index.html =404;
  }

  # History fallback: route URLs to index.html, keep it non-cacheable
  location / {
    root /var/www/mux-spa;
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
  }

  # Always fetch the latest service worker script
  location = /sw.js {
    root /var/www/mux-spa;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files /sw.js =404;
  }

  # Version manifest used by the app to detect new builds
  location = /version.json {
    root /var/www/mux-spa;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files /version.json =404;
  }

  # PWA manifest — always revalidate
  location ~* ^/(manifest\.webmanifest|manifest\.json)$ {
    root /var/www/mux-spa;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri =404;
  }

  # Long-cache only for Vite's hashed assets under /assets/
  # Example: /assets/index-PL6-fJ2f.js → safe to cache long with immutable
  location ^~ /assets/ {
    root /var/www/mux-spa;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    expires 1y;
    try_files $uri =404;
  }

  # Favicons and app icons (not hashed) — keep short/no cache to reflect updates quickly
  location = /favicon.ico {
    root /var/www/mux-spa;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files /favicon.ico =404;
  }

  location ^~ /icons/ {
    root /var/www/mux-spa;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
    try_files $uri =404;
  }
}

# Helper map for WebSocket Connection header (place once in http{} context)
# If you don't already have this globally, add the block below to /etc/nginx/nginx.conf inside "http { ... }"
# or save as /etc/nginx/conf.d/upgrade_map.conf
# 
# map $http_upgrade $connection_upgrade {
#   default upgrade;
#   ''      close;
# }
