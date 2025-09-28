mux monorepo (api + web)

Lightweight TikTok-lite POC using Mux for upload/transcode/playback. Monorepo with two apps:

mux/
  api/        # Node/Express (ESM + TS)
  web/        # PWA/SPA (TS; Vite or your choice)
  packages/   # optional shared libs later

Prereqs

Node 20+ (or 22+), npm 9+

Mux account with:

Server Access Token (MUX_TOKEN_ID, MUX_TOKEN_SECRET)

Playback Signing Key (MUX_SIGNING_KEY_ID, PEM private key)

Webhook Secret (MUX_WEBHOOK_SECRET)

Setup

# clone
git clone https://github.com/cnm4us/mux.git
cd mux

# install deps
npm i -w api
npm i -w web

# env templates
cp api/.env.example api/.env
cp web/.env.example web/.env


Fill in api/.env with your real values:

MUX_TOKEN_ID, MUX_TOKEN_SECRET

MUX_SIGNING_KEY_ID and either MUX_SIGNING_KEY_PRIVATE_KEY or MUX_SIGNING_KEY_FILE

MUX_WEBHOOK_SECRET

CORS_ORIGINS, APP_ORIGIN, PORT (as needed)

If using a PEM file, ensure permissions:

chmod 600 /home/ubuntu/mux/api/keys/mux-signing-key.pem

Run (dev)

# API (Express + TSX)
npm -w api run dev
# -> API listening on 127.0.0.1:3200 (ESM)

# WEB (if/when you have the PWA scaffold)
npm -w web run dev

Health check: curl -s http://127.0.0.1:3200/api/health

Smoke test (no real upload client needed)

1. Create a Direct Upload

curl -s -X POST http://127.0.0.1:3200/api/v1/uploads \
  -H 'content-type: application/json' \
  -d '{"title":"first clip"}' | jq
# copy: video.id and directUpload.id

2. Simulate Mux webhook (pretend the asset finished)
UPLOAD_ID="paste-directUpload.id"
ASSET_ID="as_dev_test_1"
PLAYBACK_ID="pb_dev_test_1"

jq -n --arg up "$UPLOAD_ID" --arg aid "$ASSET_ID" --arg pid "$PLAYBACK_ID" \
  '{type:"video.asset.ready",
    data:{id:$aid, upload_id:$up, playback_ids:[{id:$pid, policy:"signed"}], duration:12.3}}' \
| curl -s -X POST http://127.0.0.1:3200/api/v1/webhooks/mux \
    -H 'content-type: application/json' \
    --data-binary @- -o /dev/null -w "%{http_code}\n"
# expect: 200

3. Feed shows the item

curl -s http://127.0.0.1:3200/api/v1/feed | jq

4. Get signed playback
VID="paste-video.id"
curl -s http://127.0.0.1:3200/api/v1/videos/$VID/play | jq
# returns { playback: { url: m3u8-with-token, expiresAt } }

# Or by playback ID:
PID="$PLAYBACK_ID"
curl -s http://127.0.0.1:3200/api/v1/playback/$PID/play | jq

Note: persistence is in-memory for the POC. Restarting the API clears state—create a fresh /uploads then replay the webhook.

Scripts

From repo root (workspaces):

# typecheck both
npm run typecheck

# or per app
npm -w api run typecheck
npm -w web run typecheck

# build both (when you add web build)
npm run build


API scripts (in api/package.json):

dev: tsx watch src/server.ts

typecheck: tsc -p tsconfig.json --noEmit

build: tsc -p tsconfig.json

Webhook verification (prod)

We currently accept webhooks permissively for dev. When pointing Mux → your public URL:

Keep raw body for /api/v1/webhooks/mux (mounted before express.json()).

Verify Mux-Signature using MUX_WEBHOOK_SECRET.

On verify fail → 400.

Next steps

Swap repos from memory → MySQL behind the same interfaces.

Add minimal auth (even stub) and rate limiting on token issuance.

Consider reverse proxying playback through your domain/CDN later.

Add CI (lint/typecheck) and path-filtered deploys.

Security & housekeeping

Never commit real secrets. Keep only *.env.example.

Rotate tokens/keys after sharing them anywhere.

.gitignore already excludes .env, node_modules, build outputs, etc.

Poster Config

- Defaults live in `api/src/config/index.ts:50` under `config.THUMBNAIL` and are overrideable via env in `api/.env`.
- Env keys (see examples in `api/.env.example:76`):
  - `MUX_POSTER_TIME_SECONDS` – default time offset for poster frame (e.g., `0.0` for first frame).
  - `MUX_POSTER_HEIGHT`, `MUX_POSTER_WIDTH` – optional default dimensions; usually omit and let the client pass viewport size.
  - `MUX_POSTER_FIT_MODE` – `smartcrop | pad | crop` (defaults to `smartcrop`).
  - `MUX_POSTER_FORMAT` – `png | jpg` (defaults to `png`).
  - `MUX_POSTER_TTL_SECONDS` – token lifetime for signed image URLs.

Trade‑offs & tips

- First frame vs. black frame: `TIME_SECONDS=0.0` is seamless, but if some sources begin with black, bump slightly (e.g., `0.05`). You can still override per request with `?time=`.
- Bandwidth vs. quality: `png` is crisp but heavier; switch to `jpg` for lighter payloads if mobile bandwidth is a concern.
- Fit mode: `smartcrop` keeps the subject centered for vertical feeds; use `pad` to preserve full frame without cropping.
- TTL: Long TTLs (e.g., 600s) are convenient in dev; consider shorter in prod.
- Consistency: The feed’s unsigned `thumbnailUrl` also uses `TIME_SECONDS` for parity with signed posters.
- Client behavior: The web app passes only viewport‑driven `height/width`; all policy decisions (time/fit/format/ttl) come from the API config.

## How this works

```mermaid
sequenceDiagram
    participant Client as Client (Web/PWA)
    participant API as API (Express/TS)
    participant Mux as Mux Platform
    participant Repo as Repo (memory→MySQL)

    Client->>API: POST /uploads {title}
    API->>Mux: Create Direct Upload (signed playback policy)
    API->>Repo: Save provisional video (status=uploading, upload_id)
    API-->>Client: {video, directUpload.url}

    Note over Client: Client uploads raw file → directUpload.url

    Mux-->>API: Webhook: video.asset.ready<br/>{upload_id, asset_id, playback_ids}
    API->>Repo: Mark video ready, attach playback_id
    API-->>Mux: 200 OK

    Client->>API: GET /feed
    API->>Repo: List videos where status=ready
    API-->>Client: JSON feed (title, id, thumbnailUrl)

    Client->>API: GET /videos/:id/play
    API->>Repo: Lookup video (mux_playback_id)
    API->>API: Sign playback token (RS256 w/ KID + PEM)
    API-->>Client: playback.url (m3u8?token=...)

    Client->>Mux: GET playback.url
    Mux-->>Client: HLS video stream
