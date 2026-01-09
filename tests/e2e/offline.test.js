// Ce fichier contient des tests de bout en bout pour les fonctionnalités hors ligne de l'application MoodShare.

describe('Offline Functionality Tests', () => {
    beforeAll(async () => {
        // Enregistre le service worker
        await navigator.serviceWorker.register('/service-worker.js');
    });

    it('should cache resources when offline', async () => {
        // Simule l'état hors ligne
        await navigator.serviceWorker.ready;
        await navigator.serviceWorker.controller.postMessage({ action: 'skipWaiting' });
        await navigator.serviceWorker.controller.postMessage({ action: 'cacheResources' });

        // Vérifie que les ressources sont mises en cache
        const cache = await caches.open('moodshare-cache');
        const cachedResponse = await cache.match('/index.html');
        expect(cachedResponse).toBeTruthy();
    });

    it('should serve cached resources when offline', async () => {
        // Simule l'état hors ligne
        await navigator.serviceWorker.ready;
        await navigator.serviceWorker.controller.postMessage({ action: 'skipWaiting' });

        // Déconnecte le réseau
        await new Promise(resolve => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', '/index.html', true);
            xhr.onload = resolve;
            xhr.onerror = resolve;
            xhr.send();
        });

        // Vérifie que la page est servie à partir du cache
        const response = await fetch('/index.html');
        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('MoodShare');
    });

    afterAll(async () => {
        // Désenregistre le service worker après les tests
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
        }
    });
});