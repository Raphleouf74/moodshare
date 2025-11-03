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

        console.log('Ancienne version/build :', 'V:', latest, 'B:', latestBuild);
        console.log('Version/build actuel :', 'V:', current, 'B:', currentBuild);
        setTimeout(() => {
            showFeedback("info", `Version stable du site ${latest} (build ${latestBuild})`);
        }, 4000);
    } catch (error) {
        console.error('Erreur lors de la vérification de la version du site:', error);
        showFeedback("error", `Erreur lors de la vérification de la version du site. Voire console.`);

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



// Ajouter après les autres constantes
const ephemeralToggle = document.getElementById('ephemeralToggle');
const durationPicker = document.getElementById('durationPicker');
const ephemeralpickdiv = document.querySelector('.ephemeral-options');
const durationInputs = document.querySelectorAll('#durationPicker .duration-input');
const msgDeleteTime = document.getElementById('msgdeletetime');

// Mise à jour du texte de suppression en fonction des inputs
// Vérification et mise à jour du temps de suppression
function updateMsgDeleteTime() {


    const years = parseInt(document.getElementById('durationYear')?.value || 0);
    const months = parseInt(document.getElementById('durationMonths')?.value || 0);
    const days = parseInt(document.getElementById('durationDays')?.value || 0);
    const hours = parseInt(document.getElementById('durationHours')?.value || 0);
    const minutes = parseInt(document.getElementById('durationMinutes')?.value || 0);
    const seconds = parseInt(document.getElementById('durationSeconds')?.value || 0);

    // ✅ Vérification des valeurs invalides
    if (years > 5) {
        showFeedback("error", "Un message éphémère ne peut pas dépasser 5 ans.");
        document.getElementById('durationYear').value = 5;
    }
    if (months >= 12) {
        showFeedback("error", "Le nombre de mois ne peut pas dépasser 11.");
        document.getElementById('durationMonths').value = 11;
    }
    if (days >= 31) {
        showFeedback("error", "Le nombre de jours ne peut pas dépasser 30.");
        document.getElementById('durationDays').value = 30;
    }
    if (hours >= 24) {
        showFeedback("error", "Le nombre d'heures ne peut pas dépasser 23.");
        document.getElementById('durationHours').value = 23;
    }
    if (minutes >= 60) {
        showFeedback("error", "Le nombre de minutes ne peut pas dépasser 59.");
        document.getElementById('durationMinutes').value = 59;
    }
    if (seconds >= 60) {
        showFeedback("error", "Le nombre de secondes ne peut pas dépasser 59.");
        document.getElementById('durationSeconds').value = 59;
    }
    if (!ephemeralToggle.checked) {
        msgDeleteTime.textContent = '---';
        return;
    }
    // Recalcul après correction
    const totalMs =
        (((years * 365 + days) * 24 + hours) * 60 + minutes) * 60 * 1000 + (seconds * 1000);

    if (totalMs <= 0) {
        msgDeleteTime.textContent = '';
        return;
    }

    const expirationDate = new Date(Date.now() + totalMs);
    const formatted = expirationDate.toLocaleString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    msgDeleteTime.textContent = formatted;
}

// ✅ Relier correctement la fonction à chaque champ
durationInputs.forEach(input => {
    input.addEventListener('input', updateMsgDeleteTime);
});

// ✅ Réinitialiser quand on (dé)coche
ephemeralToggle.addEventListener('change', updateMsgDeleteTime);




// Mettre à jour quand on modifie une durée
durationInputs.forEach(input => {
    input.addEventListener('input', updateMsgDeleteTime);
    if (document.getElementById('durationYear') >= 5) {
        showFeedback("warning", "Un message ephémère à une limite de 5 ans.");
    }

    if (document.getElementById('durationMonths') >= 12 || document.getElementById('durationDays') >= 31 || document.getElementById('durationHours') >= 24 || document.getElementById('durationMinutes') >= 60 || document.getElementById('durationSeconds') >= 60) {
        showFeedback("warning", "Veuillez entrer des valeurs valides.");
    }
});

// Réinitialiser quand on (dé)coche la case
ephemeralToggle.addEventListener('change', updateMsgDeleteTime);

// Appel initial
updateMsgDeleteTime();

// Ajouter des écouteurs d'événements aux inputs de durée
durationInputs.forEach(input => {
    input.addEventListener('input', updateMsgDeleteTime);
});

// Gestion du toggle
ephemeralToggle.addEventListener('change', () => {
    durationInputs.forEach((input, index) => {
        input.style.opacity = ephemeralToggle.checked ? '1' : '0';
        input.style.transform = ephemeralToggle.checked ? 'translateY(0)' : 'translateY(15px)';
        input.style.transitionDelay = (index * 0.05) + 's';
    });

    ephemeralpickdiv.style.width = ephemeralToggle.checked ? '500px' : '300px';
    ephemeralpickdiv.style.height = ephemeralToggle.checked ? '175px' : '30px';
});


function displayMood(mood) {
    const moodcard = document.createElement("div");
    moodcard.className = "post";
    wall.prepend(moodcard);

    // Formatage de la date de création
    const createdDate = new Date(mood.createdAt).toLocaleString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Préparation du texte d'expiration si le post est éphémère
    let expirationText = '';
    if (mood.ephemeral && mood.expiresAt) {
        const expirationDate = new Date(mood.expiresAt).toLocaleString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        expirationText = `<p class="expiration-date"><span class="material-symbols-rounded">warning</span> Expire le ${expirationDate}</p>`;
    }

    moodcard.innerHTML = `
    <div class="post-content" style="background: ${mood.color}">${mood.emoji} ${mood.text} ${expirationText}</div>
    <div id="postoptions">
        <div class="post-dates">
            <p class="postdate">Créé le ${createdDate}</p>
        </div>
        <div class="buttons">
            <button class="likebtn"><span class="material-symbols-rounded">thumb_up</span> <span class="like-count">${mood.likes || 0}</span></button>
            <button class="commentbtn"><span class="material-symbols-rounded">comment</span> <span class="comment-count">0</span></button>
            <button class="sharebtn"><span class="material-symbols-rounded">share</span></button>
            <button class="savebtn"><span class="material-symbols-rounded">bookmark</span></button>
            <button class="reportbtn"><span class="material-symbols-rounded">report</span></button>
            <button class="morebtn"><span class="material-symbols-rounded">more_horiz</span></button>
        </div>
    </div>`;
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

// Fonction pour montrer le feedback
function showFeedback(type, message) {
    const feedback = document.createElement("div");
    feedback.className = `upload-feedback feedback-${type}`;

    // Choix des icônes selon le type
    const icons = {
        success: "check_circle",
        error: "error",
        warning: "warning",
        info: "info",
        remark: "chat_bubble",
        welcome: "celebration",
    };

    // Icône par défaut
    const icon = icons[type];

    feedback.innerHTML = `
    <span class="material-symbols-rounded">${icon}</span>
    ${message}
  `;

    document.body.appendChild(feedback);


    // Supprimer après animation
    if (icon === "warning") {
        feedback.style.animation = "slideInOut 30s ease forwards";
        setTimeout(() => {
            feedback.style.display = "none";
        }, 30000);
    } else {
        feedback.style.animation = "slideInOut 3s ease forwards";
        setTimeout(() => {
            feedback.style.display = "none";
        }, 3000);
    }
}

showFeedback("warning", "Votre version de Moodshare n'est pas à jour. Veuillez mettre à jour l'application. <a href='FAQ/downloadlastver.html'>Comment faire ?</a>");

document.addEventListener('DOMContentLoaded', () => {
    showFeedback("welcome", "Bienvenue !");

});

// Modifier la gestion du submit
if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
        try {
            const text = document.getElementById("moodInput").value.trim();
            const color = document.getElementById("moodColor").value;
            const emoji = document.querySelector(".moodEmoji").value;

            if (!text) {
                showFeedback("error", "Écris quelque chose !");
                return;
            }

            // Ajouter classe pour animation de chargement
            submitBtn.classList.add('submitting');
            submitBtn.disabled = true;

            // Calcul de la durée si éphémère
            let expiresAt = null;
            if (ephemeralToggle.checked) {
                const years = parseInt(document.getElementById('durationYear').value) || 0;
                const months = parseInt(document.getElementById('durationMonths').value) || 0;
                const days = parseInt(document.getElementById('durationDays').value) || 0;
                const hours = parseInt(document.getElementById('durationHours').value) || 0;
                const minutes = parseInt(document.getElementById('durationMinutes').value) || 0;
                const seconds = parseInt(document.getElementById('durationSeconds').value) || 0;

                const totalMs = ((years * 365 * 24 * 60 * 60) + (months * 30 * 24 * 60 * 60) + (days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60) + seconds) * 1000;
                if (totalMs > 0) {
                    expiresAt = new Date(Date.now() + totalMs).toISOString();
                }
            }

            const newMood = {
                text,
                color,
                emoji,
                ephemeral: ephemeralToggle.checked,
                expiresAt
            };

            const response = await fetch("https://moodshare-7dd7.onrender.com/api/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newMood)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const savedMood = await response.json();
            displayMood(savedMood);
            modal.classList.add("hidden");
            document.getElementById("moodInput").value = "";

            showFeedback("success", "Mood partagé avec succès !");

        } catch (error) {
            console.error('Erreur envoi post:', error);
            showFeedback("error", "Erreur lors de l'envoi du mood.");
        } finally {
            // Retirer l'animation de chargement
            submitBtn.classList.remove('submitting');
            submitBtn.disabled = false;
        }
    });
}


