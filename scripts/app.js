import { loadLanguage } from "./lang.js";
document.addEventListener("DOMContentLoaded", async () => {
    const selector = document.getElementById("languageSelect");

    if (!selector) {
        console.warn("⚠️ #languageSelect not found in DOM");
        return;
    }
    const lang = localStorage.getItem("lang") || "fr";
    await loadLanguage(lang);

    selector.value = lang;
    selector.addEventListener("change", async () => {
        const selected = selector.value;
        localStorage.setItem("lang", selected);
        await loadLanguage(selected);
    });
});


const header = document.querySelector('header');
const nav = document.querySelector('nav');
window.addEventListener(('scroll'), () => {
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
        if (current && current !== latest || currentBuild && currentBuild !== latestBuild) {
            showFeedback("warning", "Votre version de Moodshare n'est pas à jour. Veuillez mettre à jour l'application. <a href='../FAQ/downloadlastver.html'>Comment faire ?</a> <button onclick='location.reload()'>Recharger la page</button>");
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

        setTimeout(() => {
            showFeedback("info", `Version stable du site ${latest} (build ${latestBuild})`);
        }, 1500);
    } catch (error) {
        console.error('Erreur lors de la vérification de la version du site:', error);
        showFeedback("error", `Erreur lors de la vérification de la version du site. Voir console.`);
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
    moodcard.dataset.id = mood.id;
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
        
        <div class="buttons">
            <button class="likebtn"><span class="material-symbols-rounded">favorite</span> <span class="like-count">${mood.likes || 0}</span></button>
            <p class="postdate">Créé le ${createdDate}</p>
        </div>
    </div>`;

    if (moodcard.dataset.id == "1") {
        moodcard.innerHTML = `<div class="post-content" style="background: ${mood.color}">${mood.emoji} ${mood.text} ${expirationText}</div>`;
        moodcard.classList.add('WelcomeMood');
    }
    // Restaurer l'état like si déjà liké
    const likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "[]");
    if (likedPosts.includes(String(mood.id))) {
        const btn = moodcard.querySelector(".likebtn");
        if (btn) btn.classList.add("liked");
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

// Fonction pour montrer le feedback
async function showFeedback(type, messageKey) {

    // charge la langue actuelle depuis le cache si disponible
    const lang = localStorage.getItem("lang") || "fr";
    const t = window.__translations__ || await loadLanguage(lang);

    // si la clé existe → traduction
    const message = (t && t[messageKey]) ? t[messageKey] : messageKey;

    const feedback = document.createElement("div");
    feedback.className = `upload-feedback feedback-${type}`;

    const icons = {
        success: "check_circle",
        error: "error",
        warning: "warning",
        info: "info",
        remark: "chat_bubble",
        welcome: "celebration",
    };

    feedback.innerHTML = `
        <span class="material-symbols-rounded">${icons[type]}</span>
        ${message}
    `;

    document.body.appendChild(feedback);

    const duration = type === "warning" || type === "remark" ? 30000 : 3000;
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
async function addInboxNotification(type, titleKey, messageKey, icon = "notifications", actionLabel, actionFn) {
    const lang = localStorage.getItem("lang") || "fr";
    const t = await (await fetch(`/lang/${lang}.json`)).json();

    const title = t[titleKey] || titleKey;
    const message = t[messageKey] || messageKey;

    const inboxDiv = document.getElementById("inboxdiv");
    if (!inboxDiv) return console.error("❌ Inbox non trouvée dans le DOM");

    // Palette de couleurs par type
    const typeColors = {
        info: "#3498db",
        success: "#27ae60",
        warning: "#f1c40f",
        error: "#e74c3c",
        critical: "#c0392b"
    };

    // Création de la notification
    const notif = document.createElement("div");
    notif.className = `notificationInbox ${type}`;
    notif.style.borderLeft = `6px solid ${typeColors[type] || "#777"}`;

    notif.innerHTML = `
        <span class="material-symbols-rounded" style="color:${typeColors[type] || "#777"}">${icon}</span>
        <div>
            <h3>${title}</h3>
            <p>${message}</p>
            ${actionLabel ? `<button class="notif-action">${actionLabel}</button>` : ""}
        </div>
    `;

    // Si un bouton d’action est défini
    if (actionLabel && typeof actionFn === "function") {
        notif.querySelector(".notif-action").addEventListener("click", actionFn);
    }

    // Ajout à l’inbox
    inboxDiv.prepend(notif);

    // Animation d’apparition
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
    wall.innerHTML = "<i>Chargement des posts...</i>";

    try {
        // ⚙️ Si tu as une API user spécifique :
        const res = await fetch("https://moodshare-7dd7.onrender.com/api/posts");
        const posts = await res.json();

        // Simule l’utilisateur connecté
        const currentUser = localStorage.getItem("username") || "Anonyme";

        const userPosts = posts.filter(p => p.user === currentUser || !p.user);
        userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        wall.innerHTML = "";

        if (userPosts.length === 0) {
            wall.innerHTML = "<i>Aucun post pour le moment.</i>";
            return;
        }

        userPosts.forEach(p => {
            const div = document.createElement("div");
            div.className = "user-post";
            div.innerHTML = `
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
        wall.innerHTML = "<p style='color:red;'>Erreur lors du chargement des posts</p>";
        console.error(err);
    }
}

document.addEventListener("DOMContentLoaded", loadUserPosts);

const addStoryBtn = document.getElementById('addStoryBtn');
const storyModeToggle = document.getElementById('storyModeToggle');

if (addStoryBtn) {
    addStoryBtn.addEventListener('click', () => {
        // Active automatiquement le mode "Story"
        const createTabBtn = document.getElementById('createTab');
        createTabBtn.click();
        storyModeToggle.checked = true;
        showFeedback("info", "Mode story activé – les posts disparaîtront après 24h.");
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
                showFeedback("error", "Écris quelque chose !");
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

                const resStory = await fetch("https://moodshare-7dd7.onrender.com/api/stories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(storyData)
                });

                if (!resStory.ok) throw new Error(`HTTP ${resStory.status}`);

                const savedStory = await resStory.json();
                addStoryToList(savedStory);
                showFeedback("success", "Story publiée !");
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

                const response = await fetch("https://moodshare-7dd7.onrender.com/api/posts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newMood)
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const savedMood = await response.json();
                displayMood(savedMood);
                showFeedback("success", "Mood partagé !");
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
            showFeedback("error", "Erreur lors de l'envoi du mood ou de la story.");
        } finally {
            submitBtn.classList.remove('submitting');
            submitBtn.disabled = false;
        }
    });
}


// Affichage des stories dans la liste
function addStoryToList(story) {
    const storiesList = document.querySelector('.stories-list');
    const storyDiv = document.createElement('div');
    storyDiv.className = 'story';
    storyDiv.innerHTML = `<span>${story.emoji || '📸'}</span>`;
    storiesList.appendChild(storyDiv);

    storyDiv.addEventListener('click', () => {
        openStoryViewer(story);
    });
}

// Visionneuse simple
function openStoryViewer(story) {
    const viewer = document.createElement('div');
    viewer.className = 'story-viewer';
    viewer.innerHTML = `
    <div class="story-content" style="background:${story.color}">
      <span style="font-size:3rem">${story.emoji}</span>
      <p>${story.text}</p>
    </div>
  `;
    document.body.appendChild(viewer);

    setTimeout(() => viewer.remove(), 4000); // auto-close after 4s
}
window.addEventListener('DOMContentLoaded', () => {
    // Simule un temps de chargement (enlève ce setTimeout en production)
    setTimeout(() => {
        const loader = document.getElementById('loader');
        const mainContent = document.getElementById('main-content');

        // Cache le loader
        loader.classList.add('hidden');

    }, 4000); // 4 secondes de démo, à supprimer en prod
});


document.addEventListener("DOMContentLoaded", () => {

    const dot = document.querySelector(".cursor-dot");
    const clickRing = document.querySelector(".cursor-click");
    const locateRing = document.querySelector(".cursor-locate");

    const enableToggle = document.getElementById("cursorEnable");
    const sizeSlider = document.getElementById("cursorSize");
    const opacitySlider = document.getElementById("cursorOpacity");
    const colorPicker = document.getElementById("cursorColor");
    const hoverSelect = document.getElementById("cursorHover");

    let mouseX = 0, mouseY = 0;

    /* -----------------------------
       LOAD SETTINGS (localStorage)
    ------------------------------*/
    const saved = JSON.parse(localStorage.getItem("cursorSettings")) || {};

    if (saved.size) sizeSlider.value = saved.size;
    if (saved.opacity) opacitySlider.value = saved.opacity;
    if (saved.color) colorPicker.value = saved.color;
    if (saved.hover) hoverSelect.value = saved.hover;
    if (saved.enabled !== undefined) enableToggle.checked = saved.enabled;

    applySettings();


    /* -----------------------------
          FOLLOW CURSOR
    ------------------------------*/
    window.addEventListener("mousemove", (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        dot.style.top = clickRing.style.top = locateRing.style.top = mouseY + "px";
        dot.style.left = clickRing.style.left = locateRing.style.left = mouseX + "px";

        // Remove the locate circle after movement
        locateRing.classList.remove("active");
    });


    /* -----------------------------
             CLICK PULSE
    ------------------------------*/
    window.addEventListener("mousedown", () => {
        clickRing.classList.add("active");
    });

    window.addEventListener("mouseup", () => {
        setTimeout(() => clickRing.classList.remove("active"), 100);
    });


    /* -----------------------------
           SAVE & APPLY SETTINGS
    ------------------------------*/
    function saveSettings() {
        localStorage.setItem("cursorSettings", JSON.stringify({
            size: sizeSlider.value,
            opacity: opacitySlider.value,
            color: colorPicker.value,
            hover: hoverSelect.value,
            enabled: enableToggle.checked
        }));
    }

    function applySettings() {
        // Enable/disable
        document.body.style.cursor = enableToggle.checked ? "none" : "auto";
        document.querySelector(".custom-cursor").style.display = enableToggle.checked ? "block" : "none";

        // Size
        dot.style.width = dot.style.height = sizeSlider.value + "px";

        // Color & opacity
        const rgba = hexToRGBA(colorPicker.value, opacitySlider.value);
        dot.style.background = rgba;
        clickRing.style.borderColor = rgba;
    }

    [sizeSlider, opacitySlider, colorPicker, hoverSelect, enableToggle].forEach(el => {
        el.addEventListener("input", () => {
            applySettings();
            saveSettings();
        });
    });


    /* -----------------------------
          CTRL → LOCATOR RING
    ------------------------------*/
    window.addEventListener("keydown", (e) => {
        if (e.key === "Control") {
            locateRing.classList.add("active");
        }
    });


    /* -----------------------------
           UTIL: HEX → RGBA
    ------------------------------*/
    function hexToRGBA(hex, alpha) {
        const r = parseInt(hex.substr(1, 2), 16);
        const g = parseInt(hex.substr(3, 2), 16);
        const b = parseInt(hex.substr(5, 2), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    // Hover behaviour
    document.querySelectorAll("a, button, .hoverable, .container").forEach(el => {
        el.addEventListener("mouseenter", () => {
            switch (hoverSelect.value) {
                case "invert":
                    dot.style.filter = "invert(100%)";
                    break;
                case "grow":
                    dot.style.transform = "translate(-50%, -50%) scale(1.8)";
                    break;
            }
        });

        el.addEventListener("mouseleave", () => {
            dot.style.filter = "invert(0)";
            dot.style.transform = "translate(-50%, -50%) scale(1)";
        });
    });
});

async function loadLanguages() {
    const manifest = await fetch("/lang/manifest.json").then(r => r.json());

    const languages = [];

    for (const entry of manifest.languages) {
        const fileName = entry.file;   // ex: "fr.json"
        const code = entry.code;       // ex: "fr"

        // sécurité : s'assurer que c’est bien une string
        if (typeof fileName !== "string") {
            console.error("❌ Mauvais format file:", fileName);
            continue;
        }

        const data = await fetch(`/lang/${fileName}`).then(r => r.json());

        languages.push({
            code,
            name: entry.name || data.__name__ || code,
            flag: entry.flag || data.__flag__ || "🌐"
        });
    }

    return languages;
}


const grid = document.getElementById("langGrid");
const popup = document.getElementById("langPopup");
const openBtn = document.getElementById("openLangPicker");
const currentLang = document.getElementById("currentLangLabel");

const langPopup = document.getElementById("langPopup");
const langGrid = document.getElementById("langGrid");
const searchInput = document.getElementById("langSearch");

async function initLanguageSelector() {
    const langs = await loadLanguages();

    function render(filtered) {
        langGrid.innerHTML = "";

        filtered.forEach(lang => {
            const item = document.createElement("div");
            item.className = "lp-item";
            item.dataset.lang = lang.code;
            item.innerHTML = `
                <div class="lp-flag">${lang.flag}</div>
                <div>${lang.name}</div>
            `;

            item.addEventListener("click", () => {
                localStorage.setItem("lang", lang.code);
                location.reload();
            });

            langGrid.appendChild(item);
        });
    }

    // Search filter
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const q = searchInput.value.toLowerCase();
            const filtered = langs.filter(l =>
                l.name.toLowerCase().includes(q) ||
                l.code.toLowerCase().includes(q)
            );
            render(filtered);
        });
    }

}

initLanguageSelector();
if (openBtn) {
    openBtn.addEventListener("click", () => {
        popup.style.display = popup.style.display === "block" ? "none" : "block";
    });
}



console.log(`%c⚠ Avertissement: Le site est en développement, des erreurs ou des bugs peuvent survenir !`, "color: yellow; font-size: 25px; font-family: impact");
console.log(`%c⚠ Attention: Ne rentrez JAMAIS de commande ici sans connaître son but !`, "color: orange; font-size: 25px; font-family: impact");
