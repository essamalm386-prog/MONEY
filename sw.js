/* ============================================================
   SERVICE WORKER — l'application marche sans reseau
   ------------------------------------------------------------
   Un atelier n'a pas toujours de connexion, et le forfait mobile
   est compte. Toute la coquille est mise en cache a
   l'installation : apres la premiere ouverture, l'application se
   lance sans une seule requete reseau.

   Les donnees, elles, ne passent jamais par ici : clientes,
   mesures et photos vivent dans IndexedDB, sur l'appareil.
   ============================================================ */

const VERSION = 'dress-code-v1';

/* La coquille complete. La liste est explicite plutot que
   calculee : un fichier oublie se voit en verifiant que la liste
   correspond aux fichiers du projet, pas en decouvrant un ecran
   blanc dans un atelier sans reseau. */
const COQUILLE = [
  './',
  './index.html',
  './manifest.webmanifest',

  './design/tokens/tokens.css',
  './design/polices/polices.css',
  './design/icones/icones.css',
  './design/composants/composants.css',
  './app/app.css',

  /* Seuls les sous-ensembles latins sont precharges : les jeux
     etendus se chargeront au besoin, pour les rares noms qui en
     ont l'usage. */
  './design/polices/roboto-flex/roboto-flex-latin-full-normal.woff2',
  './design/polices/roboto/roboto-latin-standard-normal.woff2',
  './design/icones/material-symbols-rounded.woff2',

  './design/icones/icones.js',
  './app/js/app.js',
  './app/js/donnees.js',
  './app/js/metier.js',
  './app/js/interface.js',
  './app/js/routeur.js',
  './app/js/photo.js',
  './app/js/recap.js',
  './app/js/partage.js',
  './app/js/theme.js',
  './app/js/rappels.js',
  './app/js/vues/aujourdhui.js',
  './app/js/vues/commandes.js',
  './app/js/vues/commande.js',
  './app/js/vues/nouvelle-commande.js',
  './app/js/vues/clients.js',
  './app/js/vues/client.js',
  './app/js/vues/modeles.js',
  './app/js/vues/atelier.js',
  './app/js/vues/recap-partage.js',

  './app/img/icone.svg',
  './app/img/icone-192.png',
  './app/img/icone-512.png',
];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(COQUILLE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  /* Une navigation retombe toujours sur index.html : l'application
     tient en une page, les ecrans sont des fragments d'URL. */
  if (requete.mode === 'navigate') {
    evenement.respondWith(
      caches.match('./index.html').then((cache) => cache || fetch(requete)),
    );
    return;
  }

  /* Cache d'abord. La coquille ne change qu'a une nouvelle version
     du service worker, et servir depuis le cache est la difference
     entre une ouverture instantanee et une attente sur un reseau
     lent. */
  evenement.respondWith(
    caches.match(requete).then((enCache) => {
      if (enCache) return enCache;
      return fetch(requete)
        .then((reponse) => {
          if (reponse.ok && reponse.type === 'basic') {
            const copie = reponse.clone();
            caches.open(VERSION).then((cache) => cache.put(requete, copie));
          }
          return reponse;
        })
        .catch(() => enCache);
    }),
  );
});

/* Un appui sur le resume du matin ouvre l'application sur
   « Aujourd'hui », pas sur un onglet vide. */
self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  evenement.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => f.url.includes(self.registration.scope));
      if (ouverte) return ouverte.focus();
      return self.clients.openWindow('./#/');
    }),
  );
});
