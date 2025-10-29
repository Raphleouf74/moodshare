// Ce fichier gère la synchronisation des données lorsque l'application revient en ligne.

const CACHE_NAME = 'moodshare-cache-v1';
const DATA_CACHE_NAME = 'moodshare-data-cache-v1';

// Fonction pour synchroniser les données
async function syncData() {
  const cache = await caches.open(DATA_CACHE_NAME);
  const cachedRequests = await cache.keys();

  for (const request of cachedRequests) {
    const response = await cache.match(request);
    if (response) {
      const data = await response.json();
      // Logique pour envoyer les données au serveur
      await sendDataToServer(data);
      // Supprimer la requête du cache après l'envoi
      await cache.delete(request);
    }
  }
}

// Fonction pour envoyer les données au serveur
async function sendDataToServer(data) {
  try {
    const response = await fetch('/api/data', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Erreur lors de l\'envoi des données au serveur');
    }
  } catch (error) {
    console.error('Erreur de synchronisation:', error);
  }
}

// Écouteur d'événements pour la synchronisation en ligne
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-moodshare-data') {
    event.waitUntil(syncData());
  }
});