// @ts-check
/// <reference lib="webworker" />

/** @type {ServiceWorkerGlobalScope} */ // eslint-disable-line
const sw = /** @type {any} */ (self);

// --- Cache keys & app shell ---
const CACHE = "muxpoc-shell-v3";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/** @type {(url: URL) => boolean} */
const SAME_ORIGIN = (url) => url.origin === self.location.origin;

/** @type {(url: URL) => boolean} */
const IS_STATIC_ASSET = (url) =>
  SAME_ORIGIN(url) &&
  (url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest"));

/** @type {(url: URL) => boolean} */
const IS_API = (url) => SAME_ORIGIN(url) && url.pathname.startsWith("/api/");

/** @type {(url: URL) => boolean} */
const IS_MUX_MEDIA = (url) =>
  url.hostname.endsWith("stream.mux.com") || url.hostname.endsWith("image.mux.com");

// --- Install: warm app shell only ---
sw.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      try {
        const c = await caches.open(CACHE);
        await c.addAll(APP_SHELL);
      } catch {
        // ignore caching errors (offline first run, etc.)
      } finally {
        sw.skipWaiting();
      }
    })()
  );
});

// --- Activate: clean old caches ---
sw.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await sw.clients.claim();
    })()
  );
});

// --- Fetch: cautious, media-safe handler ---
sw.addEventListener("fetch", (e) => {
  /** @type {Request} */
  const req = e.request;

  // Never touch non-GET or range requests (streaming segments often use Range)
  if (req.method !== "GET") return;
  if (req.headers.has("range")) return;

  /** @type {URL} */
  const url = new URL(req.url);

  // Never intercept Mux media or images (let the network handle them directly)
  if (IS_MUX_MEDIA(url)) return;

  // Never intercept API calls
  if (IS_API(url)) return;

  // Handle same-origin navigations with a network-first strategy (simple app shell)
  if (req.mode === "navigate" && SAME_ORIGIN(url)) {
    e.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const c = await caches.open(CACHE);
          if (fresh.ok) {
            // Cache a clone of index for future navs
            c.put("/index.html", fresh.clone());
          }
          return fresh;
        } catch {
          const cached = await caches.match("/index.html");
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Cache-first for same-origin static assets only; ignore everything else
  if (IS_STATIC_ASSET(url)) {
    e.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok && SAME_ORIGIN(new URL(fresh.url))) {
            const c = await caches.open(CACHE);
            c.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          const fallback = await caches.match(req);
          return fallback || Response.error();
        }
      })()
    );
    return;
  }

  // Default: do nothing — let the network handle it
});
