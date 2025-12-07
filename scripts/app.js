import { loadLanguage, t } from "./lang.js";

document.addEventListener("DOMContentLoaded", async () => {

    // 1️⃣ Charger la langue AVANT TOUTE CHOSE
    const lang = localStorage.getItem("lang") || "fr";
    await loadLanguage(lang);

    // 2️⃣ Maintenant le site peut utiliser t()=
    checkSiteVersion();
    loadUserPosts();

    // Sécurité anti-code dans le textarea
    const moodInput = document.getElementById("moodInput");

    // Regex détectant TOUT code suspect (script, tags, JS, HTML, onerror, onclick...)
    const forbiddenPattern = /(script|javascript:|onerror=|onclick=|onload=|<iframe|<img|<svg|document\.|window\.)/i;

    // Compteur de tentatives
    let securityStrike = parseInt(localStorage.getItem("xss_strikes") || "0");

    moodInput.addEventListener("input", () => {
        const text = moodInput.value;

        if (forbiddenPattern.test(text)) {

            // Efface automatiquement
            moodInput.value = "";

            // Ajoute un strike
            securityStrike++;
            localStorage.setItem("xss_strikes", securityStrike.toString());

            // Feedback
            showFeedback("warning", "fb_xss_detected");

            // (OPTIONNEL) → Au bout de 3 tentatives, on bloque temporairement :
            if (securityStrike >= 3) {
                showFeedback("error", "fb_xss_ban_warning");
                addInboxNotification("critical", ":(", "fb_xss_ban_warning");
                moodInput.disabled = true;

                // Tu peux réactiver après 5 minutes :
                setTimeout(() => {
                    moodInput.disabled = false;
                    securityStrike = 0;
                    localStorage.setItem("xss_strikes", "0");
                    showFeedback("info", "fb_xss_unblocked");
                }, 5 * 60 * 1000); // Ban de 5 minutes
            }
        }
    });

});


const nav = document.querySelector('nav');
const header = document.querySelector('header');

window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;

    // Scroll vers le bas : cache la nav
    if (currentScroll > 50) {
        nav.classList.add('scrolled');
        header.classList.add('scrolled');
    }
    // Scroll vers le haut : affiche la nav
    else {
        nav.classList.remove('scrolled');
        header.classList.remove('scrolled');
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
        if (current && current !== latest || currentBuild && currentBuild !== latestBuild) {
            showFeedback("warning", "fb_version_not_up_to_date");
            addInboxNotification("warning", "fb_version_not_up_to_date", "fb_update_how_to");
            caches.keys().then(names => names.forEach(name => caches.delete(name)));
            localStorage.clear();

            // Recharge après un petit délai
            setTimeout(() => {
                window.location.reload(true);
            }, 1500);
        }

        // Sauvegarde des nouvelles versions
        localStorage.setItem('siteVersion', latest);
        localStorage.setItem('buildVersion', latestBuild);

        console.log(`%c Version du site: ${latest} (Build ${latestBuild})`, "color: blue; font-size: 16px;");
    } catch (error) {
        console.error('Erreur lors de la vérification de la version du site:', error);
        showFeedback("error", "fb_error_verify_version");
        addInboxNotification("critical", "Erreur lors de la vérification de la version du site", "Voir console.", "dangerous")            // Désactive le cache du navigateur et recharge la page proprement

    }
}

window.addEventListener('DOMContentLoaded', () => {
    checkSiteVersion();
});
// scripts/app.js
import './social/feed.js';
const wall = document.getElementById("moodWall");
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
        showFeedback("error", "fb_error_year");
        document.getElementById('durationYear').value = 5;
    }
    if (months >= 12) {
        showFeedback("error", "fb_error_month");
        document.getElementById('durationMonths').value = 11;
    }
    if (days >= 31) {
        showFeedback("error", "fb_error_day");
        document.getElementById('durationDays').value = 30;
    }
    if (hours >= 24) {
        showFeedback("error", "fb_error_hour");
        document.getElementById('durationHours').value = 23;
    }
    if (minutes >= 60) {
        showFeedback("error", "fb_error_minute");
        document.getElementById('durationMinutes').value = 59;
    }
    if (seconds >= 60) {
        showFeedback("error", "fb_error_seconds");
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
        showFeedback("warning", "fb_error_year");
    }

    if (document.getElementById('durationMonths') >= 12 || document.getElementById('durationDays') >= 31 || document.getElementById('durationHours') >= 24 || document.getElementById('durationMinutes') >= 60 || document.getElementById('durationSeconds') >= 60) {
        showFeedback("warning", "fb_error_invalid_value");
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
    moodcard.dataset.id = mood.id;
    wall.prepend(moodcard);

    // ---- POST CONTENT ----
    const content = document.createElement("div");
    content.className = "post-content";
    content.style.background = mood.color;

    const emojiSpan = document.createElement("span");
    emojiSpan.textContent = mood.emoji + " ";
    emojiSpan.className = "post-emoji";

    const textSpan = document.createElement("span");
    textSpan.textContent = mood.text;
    textSpan.className = "post-text";

    content.appendChild(emojiSpan);
    content.appendChild(textSpan);

    // Expiration
    if (mood.ephemeral && mood.expiresAt) {
        const expiration = document.createElement("p");
        expiration.className = "expiration-date";

        const icon = document.createElement("span");
        icon.className = "material-symbols-rounded";
        icon.textContent = "warning";

        const expirationDate = new Date(mood.expiresAt).toLocaleString("fr-FR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        expiration.appendChild(icon);
        expiration.appendChild(document.createTextNode(" Expire le " + expirationDate));

        content.appendChild(expiration);
    }

    moodcard.appendChild(content);

    // ---- OPTIONS ----
    const options = document.createElement("div");
    options.id = "postoptions";
    moodcard.appendChild(options);

    const buttons = document.createElement("div");
    buttons.className = "buttons";
    options.appendChild(buttons);

    // Like button
    const likeBtn = document.createElement("button");
    likeBtn.className = "likebtn";

    const likeIcon = document.createElement("span");
    likeIcon.className = "material-symbols-rounded";
    likeIcon.textContent = "favorite";

    const likeCount = document.createElement("span");
    likeCount.className = "like-count";
    likeCount.textContent = mood.likes || 0;

    likeBtn.appendChild(likeIcon);
    likeBtn.appendChild(likeCount);

    buttons.appendChild(likeBtn);

    // Date
    const dateP = document.createElement("p");
    dateP.className = "postdate";

    const createdDate = new Date(mood.createdAt).toLocaleString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    dateP.textContent = "Créé le " + createdDate;
    buttons.appendChild(dateP);

    // ---- Restaurer les likes ----
    const likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "[]");
    if (likedPosts.includes(String(mood.id))) {
        likeBtn.classList.add("liked");
    }
}

// Chargement initial
(async () => {
    const res = await fetch("https://moodshare-7dd7.onrender.com/api/posts");
    const moods = await res.json();
    moods.reverse().forEach(displayMood);
})();
const tabs = document.querySelectorAll("nav a");
const sections = document.querySelectorAll(".tab");

tabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
        // Supprime la classe active de tous les boutons
        tabs.forEach(btn => btn.classList.remove("active"));
        // Ajoute la classe active au bouton cliqué
        tab.classList.add("active");

        // Récupère l'ID du bouton (ex: "homeTab", "postsTab", etc.)
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

// 🔥 Bouton Settings dans le profil → navigue vers settingsTab
const goToSettingsBtn = document.getElementById('goToSettingsBtn');
if (goToSettingsBtn) {
    goToSettingsBtn.addEventListener('click', () => {
        // Enlève active de tous les tabs nav
        tabs.forEach(btn => btn.classList.remove("active"));

        // Active le settingsTab dans nav (s'il existe)
        const settingsNavTab = document.querySelector('nav a#settingsTab');
        if (settingsNavTab) settingsNavTab.classList.add('active');

        // Affiche la section settingsTab
        sections.forEach(section => {
            if (section.id === 'settingsTab') {
                section.classList.add("active");
                section.classList.remove("hidden");
            } else {
                section.classList.remove("active");
                section.classList.add("hidden");
            }
        });
    });
};

const editBtn = document.getElementById('editEmojiBtn');
const pickerContainer = document.getElementById('emojiPickerContainer');
const pickerContent = document.getElementById('emojiPicker');

// Ouvre/ferme le picker quand on clique sur le bouton
editBtn.addEventListener('click', () => {
    pickerContainer.classList.toggle('shown');
});

// Ferme le picker quand on clique à l'extérieur
pickerContainer.addEventListener('click', (e) => {
    if (e.target === pickerContainer) {
        pickerContainer.classList.remove('shown');
    }
});

// Empêche de fermer quand on clique *dans* le picker
pickerContent.addEventListener('click', (e) => {
    e.stopPropagation();
});

// Quand on sélectionne un emoji
pickerContent.addEventListener('emoji-click', (event) => {
    document.querySelector('.moodEmoji').value = event.detail.unicode;
    pickerContainer.classList.remove('shown');
});


const previewMood = document.getElementById('previewMood');
const previewEmoji = document.getElementById('previewEmoji');
const previewText = document.getElementById('previewText');
const moodInput = document.getElementById('moodInput');
const moodColor = document.getElementById('moodColor');
const moodEmoji = document.querySelector('.moodEmoji');

// Fonction de mise à jour de l'aperçu
const textColorInput = document.getElementById('textColor');
let useManualTextColor = false;

textColorInput.addEventListener('input', () => {
    useManualTextColor = true;
    updatePreview();
});

function updatePreview() {
    const bgColor = moodColor.value;
    previewMood.style.background = bgColor;
    previewEmoji.textContent = moodEmoji.value;
    previewText.textContent = moodInput.value;

    if (useManualTextColor) {
        const color = textColorInput.value;
        previewText.style.color = color;
        previewEmoji.style.color = color;
    } else {
        const brightness = getBrightness(bgColor);
        const autoColor = brightness < 128 ? "#FFFFFF" : "#000000";
        previewText.style.color = autoColor;
        previewEmoji.style.color = autoColor;
    }
}


// Fonction utilitaire pour calculer la luminosité perçue
function getBrightness(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
}


// Mise à jour en direct sur chaque changement
moodInput.addEventListener('input', updatePreview);
moodColor.addEventListener('input', updatePreview);
moodEmoji.addEventListener('input', updatePreview);

// Mise à jour aussi après sélection d'un emoji
document.querySelector('emoji-picker').addEventListener('emoji-click', updatePreview);

// Initialisation à l'ouverture
updatePreview();


function showFeedback(type, messageKey, vars = {}) {
    const translated = t(messageKey, vars) || messageKey;

    const feedback = document.createElement("div");
    feedback.className = `upload-feedback feedback-${type}`;

    const icons = {
        success: "check_circle",
        error: "error",
        warning: "warning",
        info: "info",
        remark: "chat_bubble",
        welcome: "celebration"
    };

    // ---- Icône ----
    const icon = document.createElement("span");
    icon.className = "material-symbols-rounded";
    icon.textContent = icons[type];

    // ---- Texte ----
    const p = document.createElement("p");
    p.textContent = translated;

    // ---- Ajout DOM ----
    feedback.appendChild(icon);
    feedback.appendChild(p);

    document.body.appendChild(feedback);

    const duration = 3000;
    feedback.style.animation = `slideInOut ${duration / 1000}s ease forwards`;

    setTimeout(() => feedback.remove(), duration);
}





/**
 * Ajoute une notification dans la boîte de réception (Inbox)
 * @param {string} type - Le type de notification (info, success, warning, error, critical)
 * @param {string} title - Le titre de la notification
 * @param {string} message - Le message à afficher (HTML autorisé)
 * @param {string} [icon] - Icône Material Symbols facultative
 * @param {string} [actionLabel] - Texte du bouton d'action (facultatif)
 * @param {function} [actionFn] - Fonction à exécuter au clic sur le bouton
 */

async function addInboxNotification(
    type,
    titleKey,
    messageKey,
    icon = "notifications",
    actionLabel,
    actionFn
) {
    const title = t(titleKey) || titleKey;
    const message = t(messageKey) || messageKey;

    const inboxDiv = document.getElementById("inboxdiv");
    if (!inboxDiv) return console.error("❌ Inbox non trouvée dans le DOM");

    const typeColors = {
        info: "#3498dbb0",
        success: "#27ae60b0",
        warning: "#f1c40fb0",
        error: "#e74c3cb0",
        critical: "#c0392bb0"
    };

    const notif = document.createElement("div");
    notif.className = `notificationInbox ${type}`;
    notif.style.borderLeft = `6px solid ${typeColors[type] || "#777"}`;

    // Structure de base
    const iconSpan = document.createElement("span");
    iconSpan.className = "material-symbols-rounded";
    iconSpan.style.color = typeColors[type] || "#777";
    iconSpan.textContent = icon; // 🔒 OK : icône interne, safe

    const wrapper = document.createElement("div");

    const h3 = document.createElement("h3");
    h3.textContent = title;

    const p = document.createElement("p");
    p.innerHTML = message;

    wrapper.appendChild(h3);
    wrapper.appendChild(p);

    // Bouton d'action sécurisé
    if (actionLabel) {
        const btn = document.createElement("button");
        btn.className = "notif-action";
        if (typeof actionFn === "function") {
            btn.addEventListener("click", actionFn);
        }
        wrapper.appendChild(btn);
    }

    notif.appendChild(iconSpan);
    notif.appendChild(wrapper);

    // Injection finale
    inboxDiv.prepend(notif);

    // Animation safe
    notif.style.opacity = "0";
    notif.style.transform = "translateY(-10px)";
    setTimeout(() => {
        notif.style.transition = "all 0.3s ease";
        notif.style.opacity = "1";
        notif.style.transform = "translateY(0)";
    }, 50);
}



async function loadUserPosts() {
    const wall = document.getElementById("userPostsWall");
    wall.textContent = "<i>Chargement des posts...</i>";

    try {
        // ⚙️ Si tu as une API user spécifique :
        const res = await fetch("https://moodshare-7dd7.onrender.com/api/posts");
        const posts = await res.json();

        // Simule l’utilisateur connecté
        const currentUser = localStorage.getItem("username") || "Anonyme";

        const userPosts = posts.filter(p => p.user === currentUser || !p.user);
        userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        wall.textContent = "";

        if (userPosts.length === 0) {
            wall.textContent = "<i>Aucun post pour le moment.</i>";
            return;
        }

        userPosts.forEach(p => {
            const div = document.createElement("div");
            div.className = "user-post";
            div.textContent = `
        <div class="user-post-header">
          <span>${p.emoji || "🙂"}</span>
          <span>${new Date(p.createdAt).toLocaleString("fr-FR")}</span>
        </div>
        <p>${p.text}</p>
      `;
            wall.appendChild(div);
        });

        document.getElementById("countPosts").textContent = userPosts.length;
    } catch (err) {
        wall.textContent = "<p style='color:red;'>Erreur lors du chargement des posts</p>";
        console.error(err);
    }
}


const addStoryBtn = document.getElementById('addStoryBtn');
const storyModeToggle = document.getElementById('storyModeToggle');

if (addStoryBtn) {
    addStoryBtn.addEventListener('click', () => {
        // Active automatiquement le mode "Story"
        const createTabBtn = document.getElementById('createTab');
        createTabBtn?.click();
        if (storyModeToggle) storyModeToggle.checked = true;
    });
}

// Lors de la création d’un post
// Remplace le code du submitBtn par celui-ci dans app.js

if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
        try {
            const text = document.getElementById("moodInput").value.trim();
            const color = document.getElementById("moodColor").value;
            const emoji = document.querySelector(".moodEmoji").value;
            const isStory = storyModeToggle?.checked;

            if (!text) {
                showFeedback("error", "Écris quelque chose !", "fb_write_something");
                return;
            }

            submitBtn.classList.add('submitting');
            submitBtn.disabled = true;

            // ✅ Cas STORY - on crée UNIQUEMENT une story
            if (isStory) {
                const storyData = {
                    text,
                    color,
                    emoji,
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                };

                const resStory = await fetch("/api/stories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(storyData)
                });

                if (!resStory.ok) throw new Error(`HTTP ${resStory.status}`);

                const savedStory = await resStory.json();
                addStoryToList(savedStory);
                showFeedback("success", "Story publiée !", "fb_story_posted");
            }
            // ✅ Cas POST classique - on crée UNIQUEMENT un post
            else {
                // Calcul de l'expiration si ephemeral
                let expiresAt = null;
                if (ephemeralToggle.checked) {
                    const years = parseInt(document.getElementById('durationYear')?.value || 0);
                    const months = parseInt(document.getElementById('durationMonths')?.value || 0);
                    const days = parseInt(document.getElementById('durationDays')?.value || 0);
                    const hours = parseInt(document.getElementById('durationHours')?.value || 0);
                    const minutes = parseInt(document.getElementById('durationMinutes')?.value || 0);
                    const seconds = parseInt(document.getElementById('durationSeconds')?.value || 0);

                    const totalMs =
                        ((((years * 365) + (months * 30) + days) * 24 + hours) * 60 + minutes) * 60 * 1000 +
                        (seconds * 1000);

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

                const response = await fetch("/api/posts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newMood)
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const savedMood = await response.json();
                displayMood(savedMood);
                showFeedback("success", "fb_post_shared"); // au lieu d'un texte brut
            }

            // Réinitialisation du formulaire
            modal.classList.add("hidden");
            document.getElementById("moodInput").value = "";
            document.querySelector(".moodEmoji").value = "";
            ephemeralToggle.checked = false;
            if (storyModeToggle) storyModeToggle.checked = false;
            updateMsgDeleteTime();

        } catch (error) {
            console.error('Erreur envoi post:', error);
            showFeedback("error", "fb_error_post");
        } finally {
            submitBtn.classList.remove('submitting');
            submitBtn.disabled = false;
        }
    });
}


// Affichage des stories dans la liste
function addStoryToList(story) {
    const storiesList = document.querySelector('.stories-list');
    if (!storiesList) return;

    const storyDiv = document.createElement('div');
    storyDiv.className = 'story';

    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'story-emoji';
    emojiSpan.textContent = story.emoji || '📸';

    const textSpan = document.createElement('span');
    textSpan.className = 'sr-only';
    textSpan.textContent = story.text || '';

    storyDiv.appendChild(emojiSpan);
    storyDiv.appendChild(textSpan);

    storiesList.appendChild(storyDiv);

    storyDiv.addEventListener('click', () => openStoryViewer(story));
}

// Visionneuse simple
function openStoryViewer(story) {
    const viewer = document.createElement('div');
    viewer.className = 'story-viewer';

    const content = document.createElement('div');
    content.className = 'story-content';
    content.style.background = story.color || '#111';

    const emojiEl = document.createElement('span');
    emojiEl.style.fontSize = '3rem';
    emojiEl.textContent = story.emoji || '';

    const p = document.createElement('p');
    p.textContent = story.text || '';

    content.appendChild(emojiEl);
    content.appendChild(p);
    viewer.appendChild(content);

    document.body.appendChild(viewer);

    // close on click or after timeout
    viewer.addEventListener('click', () => viewer.remove());
    setTimeout(() => {
        if (viewer.parentNode) viewer.remove();
    }, 4000);
}