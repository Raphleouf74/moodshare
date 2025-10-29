// service-worker.js
const CACHE_NAME = 'moodshare-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/scripts/app.js',
  '/assets/icons/logo_cropped.jpg',
  '/assets/icons/Logo.jpg',
  // Ajoutez d'autres ressources à mettre en cache ici
];

// Installation du service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Gestion des requêtes
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si une réponse est trouvée dans le cache, la retourner
        if (response) {
          return response;
        }
        // Sinon, effectuer une requête réseau
        return fetch(event.request).then((response) => {
          // Vérifier si nous avons reçu une réponse valide
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Cloner la réponse pour la mettre en cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          return response;
        });
      })
  );
});

// Synchronisation des données lorsque l'application revient en ligne
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-posts') {
    event.waitUntil(
      // Logique pour synchroniser les posts
      // Par exemple, récupérer les posts en attente et les envoyer au serveur
    );
  }
});