// scripts/app.js
import './social/feed.js';
import { setupLocalization } from './i18n/i18n.js';
import { initializeSocialFeatures } from './social/feed.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeSocialFeatures();
    } catch (error) {
        console.error('Erreur initialisation:', error);
    }
});

// ...existing code...

document.addEventListener('DOMContentLoaded', () => {
    // Initialize storage for offline capabilities
    initializeStorage();

    // Setup localization for multilingual support
    setupLocalization();

});

const wall = document.getElementById("moodWall");
const postBtn = document.getElementById("postMoodBtn");
const modal = document.getElementById("postModal");
const submitBtn = document.getElementById("submitMood");


if (submitBtn) {
    submitBtn.addEventListener("click", async () => {



        const text = document.getElementById("moodInput").value.trim();
        const color = document.getElementById("moodColor").value;
        const emoji = document.querySelector(".moodEmoji").value;

        if (!text) return alert("Écris quelque chose !");

        const newMood = { text, color, emoji, date: Date.now() };

        // Affichage instantané
        displayMood(newMood);

        // Envoi au backend
        await fetch("https://moodshare-7dd7.onrender.com/api/moods", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newMood)
        });

        modal.classList.add("hidden");
        document.getElementById("moodInput").value = "";
    });
}

function displayMood(mood) {
    const div = document.createElement("div");
    div.className = "mood-card";
    div.style.background = mood.color;
    div.innerHTML = `${mood.emoji} ${mood.text}`;
    wall.prepend(div);
}

// Chargement initial
(async () => {
    const res = await fetch("https://moodshare-7dd7.onrender.com/api/moods");
    const moods = await res.json();
    moods.reverse().forEach(displayMood);
})();
const tabs = document.querySelectorAll("nav button");
const sections = document.querySelectorAll(".tab");

tabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
        // Supprime la classe active de tous les boutons
        tabs.forEach(btn => btn.classList.remove("active"));
        // Ajoute la classe active au bouton cliqué
        tab.classList.add("active");

        // Récupère l'ID du bouton (ex: "Home", "Posts", etc.)
        const tabId = tab.id;

        // Affiche la section correspondante
        sections.forEach(section => {
            if (section.id.startsWith(tabId)) {
                section.classList.add("active");
                section.classList.remove("hidden");
            } else {
                section.classList.remove("active");
                section.classList.add("hidden");
            }
        });
    });
});
const header = document.querySelector('header');
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {

    if (window.scrollY > 30) {
        header.classList.add('scrolled');
        nav.classList.add('scrolled');


    } else {
        header.classList.remove('scrolled');
        nav.classList.remove('scrolled');
    }
});
const editBtn = document.getElementById('editEmojiBtn');
const pickerContainer = document.getElementById('emojiPickerContainer');
editBtn.addEventListener('click', () => {
    pickerContainer.classList.toggle('shown');
});
document.querySelector('emoji-picker').addEventListener('emoji-click', event => {
    document.querySelector('.moodEmoji').value = event.detail.unicode;
    pickerContainer.classList.toggle('shown');
});

// ...existing code...

const previewMood = document.getElementById('previewMood');
const previewEmoji = document.getElementById('previewEmoji');
const previewText = document.getElementById('previewText');
const moodInput = document.getElementById('moodInput');
const moodColor = document.getElementById('moodColor');
const moodEmoji = document.querySelector('.moodEmoji');

// Fonction de mise à jour de l'aperçu
function updatePreview() {
    previewMood.style.background = moodColor.value;
    previewEmoji.textContent = moodEmoji.value;
    previewText.textContent = moodInput.value;
}

// Mise à jour en direct sur chaque changement
moodInput.addEventListener('input', updatePreview);
moodColor.addEventListener('input', updatePreview);
moodEmoji.addEventListener('input', updatePreview);

// Mise à jour aussi après sélection d'un emoji
document.querySelector('emoji-picker').addEventListener('emoji-click', updatePreview);

// Initialisation à l'ouverture
updatePreview();