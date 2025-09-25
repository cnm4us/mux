// @ts-check
/// <reference lib="webworker" />

/** @type {ServiceWorkerGlobalScope} */ // eslint-disable-line
const sw = /** @type {any} */ (self);
const CACHE = "muxpoc-shell-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

/** @param {ExtendableEvent} e */
sw.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    try { await c.addAll(APP_SHELL); } catch {}
    sw.skipWaiting();
  })());
});

/** @param {ExtendableEvent} e */
sw.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    sw.clients.claim();
  })());
});

/** @param {FetchEvent} e */
sw.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const isApi = url.pathname.startsWith("/api/");
  const isWrite = ["POST","PUT","PATCH","DELETE"].includes(e.request.method);
  const isStream = url.pathname.endsWith(".m3u8") || url.pathname.endsWith(".ts");
  if (isApi || isWrite || isStream) return;

  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const fresh = await fetch(e.request);
      const c = await caches.open(CACHE);
      c.put(e.request, fresh.clone());
      return fresh;
    } catch {
      return cached ?? Response.error();
    }
  })());
});
