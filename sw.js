/* ============================================================================
   KILL-SWITCH — this replaces the old caching service worker entirely.
   The previous version (cache-first for the app shell) got stuck serving
   stale files on some devices even after "delete site data" + reinstall,
   because a service worker's own cache isn't reliably cleared by that UI
   path on iOS. This version does the opposite: on activate, it wipes every
   cache this origin ever created and unregisters itself, then forces any
   open tab to reload straight from the network. Browsers check a page's
   service worker for updates on every navigation regardless of how stale
   the HTML/JS itself is cached, so this reaches already-affected devices
   without the user doing anything.

   After this has rolled out, the app no longer registers a service worker
   at all (see main.js) — no more offline caching, but no more of this
   class of bug either. If offline support comes back later, it should ship
   as a new, carefully-versioned file, not a revival of this one.
   ============================================================================ */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((client) => client.navigate(client.url)))
  );
});
