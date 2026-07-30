/**
 * Service worker — coquille applicative hors-ligne.
 *
 * Stratégie :
 *   - App shell (HTML/CSS/JS/manifest) : cache-first, pré-caché à l'install.
 *   - Requêtes API : network-first avec repli silencieux (les données métier
 *     vivent dans IndexedDB, gérées par store.js — le SW ne cache pas l'API).
 */
const CACHE = "pointage-btp-v1";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/store.js",
  "/domain.js",
  "/manifest.webmanifest",
  "/icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // On ne met pas l'API en cache : store.js gère l'état local + la synchro.
  if (url.pathname.startsWith("/api/")) return;
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => cached || caches.match("/index.html"));
      return cached || network;
    }),
  );
});
