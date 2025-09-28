// @ts-check
/// <reference lib="webworker" />

/** @type {ServiceWorkerGlobalScope} */ // eslint-disable-line
const sw = /** @type {any} */ (self);
const VERSION_URL = "/version.json"; // written at build time
let BUILD_ID = undefined;
function cacheName() {
  return `muxpoc-shell-${BUILD_ID ?? 'dev'}`;
}
function withBuildParam(u) {
  try {
    const url = new URL(u, self.location.origin);
    if (BUILD_ID) url.searchParams.set('v', BUILD_ID);
    return url.pathname + (url.search ? url.search : '');
  } catch { return u; }
}
const APP_SHELL_BASE = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
function appShell() {
  return APP_SHELL_BASE.map(withBuildParam);
}

async function fetchBuildId() {
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-cache' });
    if (!res.ok) return;
    const j = await res.json();
    if (j && j.buildId) BUILD_ID = String(j.buildId);
  } catch {}
}

/** @param {ExtendableEvent} e */
sw.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    await fetchBuildId();
    const c = await caches.open(cacheName());
    try { await c.addAll(appShell()); } catch {}
    sw.skipWaiting();
  })());
});

/** @param {ExtendableEvent} e */
sw.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    await fetchBuildId();
    const keys = await caches.keys();
    const keep = cacheName();
    await Promise.all(keys.filter(k => k !== keep).map(k => caches.delete(k)));
    sw.clients.claim();
    // Tell clients our build id
    const clients = await sw.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({ type: 'SW_READY', buildId: BUILD_ID }));
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
      const c = await caches.open(cacheName());
      c.put(e.request, fresh.clone());
      return fresh;
    } catch {
      return cached ?? Response.error();
    }
  })());
});

// React to app messages (e.g., ask SW to check if a new version is available)
sw.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'CHECK_VERSION') {
    (async () => {
      const oldId = BUILD_ID;
      await fetchBuildId();
      if (BUILD_ID && oldId && BUILD_ID !== oldId) {
        // Purge old caches, notify clients a new version is available
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== cacheName()).map(k => caches.delete(k)));
        const clients = await sw.clients.matchAll({ type: 'window' });
        clients.forEach(c => c.postMessage({ type: 'NEW_VERSION_AVAILABLE', buildId: BUILD_ID }));
      }
    })();
  }
});
