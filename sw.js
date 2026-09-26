/* ============================================================================
   Minimal service worker — caches the app shell so the installed (Add to
   Home Screen) version keeps working offline. Cache-first for same-origin
   GET requests; everything else (fonts, jsPDF/html2canvas CDN) passes through
   to the network normally.
   ============================================================================ */

const CACHE_NAME = "rama-console-v5";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/style.css",
  "./assets/js/data.js",
  "./assets/js/bulletin-data.js",
  "./assets/js/utils.js",
  "./assets/js/components.js",
  "./assets/js/export.js",
  "./assets/js/router.js",
  "./assets/js/main.js",
  "./assets/js/pages/dashboard.js",
  "./assets/js/pages/transfers.js",
  "./assets/js/pages/files.js",
  "./assets/js/pages/documents.js",
  "./assets/js/pages/bulletin.js",
  "./assets/js/pages/accounts.js",
  "./assets/js/pages/servers.js",
  "./assets/js/pages/logs.js",
  "./assets/js/pages/history.js",
  "./assets/js/pages/settings.js",
  "./assets/img/icon-192.png",
  "./assets/img/icon-512.png",
  "./assets/img/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => cached);
    })
  );
});
