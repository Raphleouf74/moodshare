// Fichier pour gérer les fonctionnalités d'accessibilité de l'application MoodShare

// Fonction pour activer le mode contraste élevé
function toggleHighContrast() {
    document.body.classList.toggle('high-contrast');
}

// Fonction pour agrandir le texte
function increaseFontSize() {
    const body = document.body;
    const currentSize = window.getComputedStyle(body).fontSize;
    const newSize = parseFloat(currentSize) * 1.2; // Augmente la taille de 20%
    body.style.fontSize = newSize + 'px';
}

// Fonction pour réduire la taille du texte
function decreaseFontSize() {
    const body = document.body;
    const currentSize = window.getComputedStyle(body).fontSize;
    const newSize = parseFloat(currentSize) * 0.8; // Réduit la taille de 20%
    body.style.fontSize = newSize + 'px';
}

// Fonction pour lire le contenu à voix haute
function readContent() {
    const content = document.body.innerText; // Récupère le texte du corps
    const speech = new SpeechSynthesisUtterance(content);
    window.speechSynthesis.speak(speech);
}

// Écouteurs d'événements pour les boutons d'accessibilité
document.getElementById('highContrastBtn').addEventListener('click', toggleHighContrast);
document.getElementById('increaseFontBtn').addEventListener('click', increaseFontSize);
document.getElementById('decreaseFontBtn').addEventListener('click', decreaseFontSize);
document.getElementById('readContentBtn').addEventListener('click', readContent);