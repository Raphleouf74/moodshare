const CACHE_NAME = 'moodshare-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/styles/a11y.css',
    '/scripts/app.js',
    '/assets/icons/logo_cropped.jpg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});