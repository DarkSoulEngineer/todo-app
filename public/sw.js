// Stride offline service worker.
// Conservative strategy: precache both shell routes ("/" and "/tasks") plus
// hashed static assets, never cache RSC/data requests, and fall back to the
// cached shell offline.
//
// Versioning: every cache key is prefixed. On activate, ANY cache that does not
// carry the current prefix is deleted, so a redeploy never serves a stale shell
// or stale hashed assets.
const CACHE_VERSION = "v3";
const CACHE_PREFIX = `stride-${CACHE_VERSION}-`;
const SHELL_CACHE = `${CACHE_PREFIX}shell`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime`;
const SHELL_URLS = ["/", "/tasks"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([...SHELL_URLS, "/manifest.webmanifest"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Lets the page ask a waiting worker to take over immediately.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname.startsWith("/apple-touch-icon") ||
    /\.(?:png|svg|ico|webp|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept RSC/data or API traffic.
  if (
    url.pathname.startsWith("/api/") ||
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1"
  ) {
    return;
  }

  // Navigations: network first, fall back to the cached shell for the same
  // pathname, then to the cached "/" shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/"))
            .then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  // Static assets: cache first, then network.
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined);
            return response;
          }),
      ),
    );
  }
});
