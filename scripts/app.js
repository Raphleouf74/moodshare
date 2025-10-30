// ----- Vérification de version -----
// ----- Vérification de version -----
async function checkSiteVersion() {
    const siteVersion = document.getElementById("SiteVersion");
    const buildVersion = document.getElementById("BuildVersion");
    
    try {
        const res = await fetch('/version.json', { 
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        const latest = data.version;
        const latestBuild = data.build;
        
        const current = localStorage.getItem('siteVersion');
        const currentBuild = localStorage.getItem('buildVersion');

        // Mise à jour de l'affichage
        if (siteVersion) siteVersion.innerText = latest;
        if (buildVersion) buildVersion.innerText = latestBuild;

        // Vérification des mises à jour
        if (current && current !== latest) {
            showUpdateNotification();
        }
        if (currentBuild && currentBuild !== latestBuild) {
            showUpdateNotification();
        }

        // Sauvegarde des nouvelles versions
        localStorage.setItem('siteVersion', latest);
        localStorage.setItem('buildVersion', latestBuild);

        console.log('Ancienne version/build :','V:', latest,'B:',latestBuild);
        console.log('Version/build actuel :','V:', current,'B:', currentBuild);
    } catch (error) {
        console.error('Erreur lors de la vérification de la version du site:', error);
    }
}

function showUpdateNotification() {
    const notif = document.createElement('div');
    notif.className = 'update-notification';
    notif.innerHTML = `
        <p>Une nouvelle version du site est en ligne, cliquez sur le bouton pour recharger la page et la mettre à jour</p>
        <button onclick="location.reload()">Recharger la page</button>
    `;
    document.body.appendChild(notif);
}

window.addEventListener('DOMContentLoaded', () => {
    checkSiteVersion();
});
// scripts/app.js
import './social/feed.js';
// Supprimer les imports en double et restructurer
import { setupLocalization } from './i18n/i18n.js';
import { initializeSocialFeatures } from './social/feed.js';
import { initializeStorage } from './utils/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (await initializeStorage()) {
            await initializeSocialFeatures();
            setupLocalization();
        }
    } catch (error) {
        console.log('Erreur initialisation:', error);
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
    const res = await fetch("https://moodshare-7dd7.onrender.com/api/posts");
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

