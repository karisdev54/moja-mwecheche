// Caches only an offline page. Everything else always comes from the network, so updates are instant.
const CACHE = "offline-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add("/offline.html")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return; // only page loads, never data or images
  e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html").then((r) => r || Response.error())));
});