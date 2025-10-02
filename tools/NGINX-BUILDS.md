# Versioned build includes for Nginx (smooth SW upgrades)

This repo contains Nginx snippets to decouple the site config from the current SPA build. You can swap builds by switching a single include symlink and reloading Nginx.

## Files in this repo

- `tools/003_mux.bawebtech.com` — main site config (server blocks). Now includes a single line:
  - `include /etc/nginx/mux/build.current.conf;`
- `tools/build.current.conf.sample` — drop-in include for serving a build at root (`/var/www/mux-spa`). Matches the current non-scoped setup.
- `tools/build.scoped.EXAMPLE.conf` — example for path‑scoped builds under `/b/BUILD_ID/` (recommended for guaranteed SW freshness and painless rollbacks).

## Recommended locations on the server

- Per-build configs: `/etc/nginx/mux/builds/BUILD_ID.conf`
- Pointer to the active build: `/etc/nginx/mux/build.current.conf` (symlink to one of the above)
- Build files (Vite dist):
  - Non-scoped: `/var/www/mux-spa/` (single directory, replaced via rsync)
  - Path-scoped: `/var/www/mux-spa-builds/BUILD_ID/` (one folder per build)

## Switch flow (non‑scoped root, current behavior)

1) Build and rsync to `/var/www/mux-spa/` as you do today.
2) Install include once: `cp tools/build.current.conf.sample /etc/nginx/mux/build.current.conf`
3) Reload Nginx: `sudo nginx -t && sudo nginx -s reload`

Unified scripting (optional):

- Build: `tools/web-build.sh` (root build by default)
- Deploy: `tools/web-deploy.sh`

Pros: minimal changes. Cons: relies on SW update flow; iOS may delay controller handoff.

## Switch flow (path‑scoped builds, recommended)

App build-time:

- Build with base path: `VITE_BASE=/b/BUILD_ID/ npm -w web run build`
- Ensure app code uses `import.meta.env.BASE_URL` for SW registration, router basename, and version fetches.

Install:

1) `rsync -a web/dist/ /var/www/mux-spa-builds/BUILD_ID/`
2) Create conf: copy `tools/build.scoped.EXAMPLE.conf` → `/etc/nginx/mux/builds/BUILD_ID.conf` and replace `BUILD_ID`.
3) Point current include: `ln -sfn /etc/nginx/mux/builds/BUILD_ID.conf /etc/nginx/mux/build.current.conf`
4) Reload Nginx: `sudo nginx -t && sudo nginx -s reload`

Unified scripting (optional):

- Build: `BUILD_ID=YYYYmmddHHMMSS-<gitsha> tools/web-build.sh`
  - or run `npm run web:scoped` to compute one for you
- Deploy: `BUILD_ID=… tools/web-deploy.sh`
  - or omit BUILD_ID to deploy the last built ID (reads from `tools/LAST_BUILD_ID`)

Side-by-side testing (no root flip):

- Include the generated side-by conf: `include /etc/nginx/mux/builds/BUILD_ID.sideby.conf;` in `/etc/nginx/mux/build.current.conf` and reload Nginx.
  - Or run: `BUILD_ID=… npm run web:nginx:sideby` (falls back to `tools/LAST_BUILD_ID` if unset)

Verify:

- `/` redirects to `/b/BUILD_ID/`
- SW scriptURL ends with `/b/BUILD_ID/sw.js`
- App routes function under `/b/BUILD_ID/...`

Rollback: repoint the symlink to the previous `BUILD_ID.conf` and reload Nginx.

## Notes

- Mark these as no-store: `index.html`, `sw.js`, `manifest.webmanifest`, `version.json`.
- Long-cache only for `/assets/` (hashed filenames).
- For path‑scoped builds, keep all files (icons, manifest) inside each build folder for simplicity.
- You can A/B by routing a subset of users to a different `/b/ID/` via a separate include and map.
