// Ce fichier contient des fonctions utilitaires pour la gestion du stockage local.

const STORAGE_KEY = 'moodshare_data';

// Fonction pour sauvegarder des données dans le stockage local
export function saveToLocalStorage(data) {
    try {
        const serializedData = JSON.stringify(data);
        localStorage.setItem(STORAGE_KEY, serializedData);
    } catch (error) {
        console.error("Erreur lors de la sauvegarde des données dans le stockage local:", error);
    }
}

export function initializeStorage() {
    try {
        localStorage.setItem('moodshare_initialized', 'true');
        return true;
    } catch (error) {
        console.error('Erreur initialisation storage:', error);
        return false;
    }
}


// Fonction pour récupérer des données du stockage local
export function loadFromLocalStorage() {
    try {
        const serializedData = localStorage.getItem(STORAGE_KEY);
        if (serializedData === null) {
            return undefined;
        }
        return JSON.parse(serializedData);
    } catch (error) {
        console.error("Erreur lors de la récupération des données du stockage local:", error);
        return undefined;
    }
}

// Fonction pour supprimer les données du stockage local
export function removeFromLocalStorage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error("Erreur lors de la suppression des données du stockage local:", error);
    }
}