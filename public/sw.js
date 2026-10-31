// Minimal service worker: caches nothing, so every deploy reaches users immediately
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));