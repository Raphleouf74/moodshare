import { loadLanguage, t } from "./lang.js";
import { fetchWithAuth, getCurrentUser } from './auth.js';

// Détection backend : local en dev, prod sinon
const API = "https://moodshare-7dd7.onrender.com/api";

// --- Live updates via Server-Sent Events (SSE) ---
try {
    const streamUrl = `${API}/stream`;
    const es = new EventSource(streamUrl, { withCredentials: true });

    es.addEventListener('new_post', (e) => {
        try {
            const post = JSON.parse(e.data);
            // Avoid duplicates
            if (!document.querySelector(`.post[data-id="${post.id}"]`)) {
                displayMood(post);
            }
        } catch (err) { console.warn('Invalid new_post event', err); }
    });

    es.addEventListener('post_update', (e) => {
        try {
            const post = JSON.parse(e.data);
            const el = document.querySelector(`.post[data-id="${post.id}"]`);
            if (el) {
                const likeCount = el.querySelector('.like-count');
                if (likeCount) likeCount.textContent = (post.likes || 0);
            }
        } catch (err) { console.warn('Invalid post_update event', err); }
    });

    es.addEventListener('new_story', (e) => {
        try { const story = JSON.parse(e.data); addStoryToList(story); } catch (err) { console.warn('Invalid new_story event', err); }
    });

    es.addEventListener('stories_update', (e) => {
        try { const stories = JSON.parse(e.data); /* optional: refresh story list */ stories.forEach(addStoryToList); } catch (err) { console.warn('Invalid stories_update event', err); }
    });

    es.addEventListener('connected', (e) => { /* connected */ });
} catch (err) {
    console.warn('SSE not supported or failed to connect', err);
}

document.addEventListener('DOMContentLoaded', async () => {
    // load recommended users on home
    // await loadRecommended();
    // try to restore session for UI (auth.js already handles initial state)
    const user = await getCurrentUser();
    if (user) {
        // set some UI state if needed
    }
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
const profileheader = document.getElementById('accountheader');

window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;

    // Scroll vers le bas : cache la nav
    if (currentScroll > 50) {
        header.classList.add('scrolled');
        profileheader.classList.add('scrolled');
    }
    // Scroll vers le haut : affiche la nav
    else {
        header.classList.remove('scrolled');
        profileheader.classList.remove('scrolled');
    }
});
profileheader.addEventListener('mouseover', () => {
    profileheader.classList.remove('scrolled');
});
profileheader.addEventListener('mouseout', () => {
    if (window.scrollY > 50) {
        profileheader.classList.add('scrolled');
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
    ephemeralpickdiv.style.height = ephemeralToggle.checked ? '175px' : '30px';
});


function displayMood(mood) {
    const moodcard = document.createElement("div");
    moodcard.className = "post";
    moodcard.dataset.id = mood.id;
    wall.prepend(moodcard);
    if (mood.id == "1") {
        moodcard.classList.add('WelcomeMood');
    }

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

    // Appliquer couleur de texte si fournie, sinon choisir automatiquement
    const textColor = mood.textColor || (() => {
        try {
            return (getBrightness(mood.color || "#ffffff") < 128) ? "#FFFFFF" : "#000000";
        } catch (e) { return "#000000"; }
    })();

    emojiSpan.style.color = textColor;
    textSpan.style.color = textColor;

    content.appendChild(emojiSpan);
    content.appendChild(textSpan);

    // Expiration
    if (mood.ephemeral && mood.expiresAt) {
        const expiration = document.createElement("p");
        expiration.className = "expiration-date";

        const icon = document.createElement("svg");
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert-icon lucide-triangle-alert"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

        const expirationDate = new Date(mood.expiresAt).toLocaleString("fr-FR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        expiration.appendChild(icon);
        document.getElementById('msgdeletetime').textContent = " Expire le " + expirationDate;

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


    // Like button
    const likeBtn = document.createElement("button");
    likeBtn.className = "likebtn";

    const likeIcon = document.createElement("span");
    likeIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>`;

    const likeCount = document.createElement("span");
    likeCount.className = "like-count";
    likeCount.textContent = mood.likes || 0;

    likeBtn.appendChild(likeIcon);
    likeBtn.appendChild(likeCount);

    buttons.appendChild(likeBtn);

    // ---- Restaurer les likes ----
    const likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "[]");
    if (likedPosts.includes(String(mood.id))) {
        likeBtn.classList.add("liked");
    }

    // handle post like click
    likeBtn.addEventListener('click', async () => {
        const isLiked = likeBtn.classList.contains('liked');
        try {
            const endpoint = isLiked ? `${API}/posts/${mood.id}/unlike` : `${API}/posts/${mood.id}/like`;
            const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
            if (res.ok) {
                const updated = await res.json();
                mood.likes = updated.likes;
                likeCount.textContent = mood.likes;
                likeBtn.classList.toggle('liked');
                // persist locally
                let arr = JSON.parse(localStorage.getItem('likedPosts') || '[]');
                if (!isLiked) { arr.push(String(mood.id)); } else { arr = arr.filter(x => x !== String(mood.id)); }
                localStorage.setItem('likedPosts', JSON.stringify(arr));
            } else {
                showFeedback("warning", "not_logged_in");
            }
        } catch (e) { console.error(e); showFeedback("error", "network_error"); }
    });

    // ---- ACTIONS: comment / share / report / repost ----
    const actionBar = document.createElement('div');
    actionBar.className = 'post-actions';

    const shareBtn = document.createElement('button');
    shareBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link-icon lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    shareBtn.title = 'Partager';
    actionBar.appendChild(shareBtn);

    const repostBtn = document.createElement('button');
    repostBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-repeat2-icon lucide-repeat-2"><path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/></svg>';
    repostBtn.title = 'Reposter';
    actionBar.appendChild(repostBtn);

    // ---- Report button ----
    const reportBtn = document.createElement('button');
    reportBtn.className = 'reportbtn';
    reportBtn.title = 'Signaler ce post';
    reportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
    actionBar.appendChild(reportBtn);

    reportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openReportModal(mood.id);
    });

    buttons.appendChild(actionBar);

    dateP.textContent = "Créé le " + createdDate;
    buttons.appendChild(dateP);

    shareBtn.addEventListener('click', () => {
        const url = `${location.origin}${location.pathname}#post-${mood.id}`;
        if (navigator.share) {
            navigator.share({ title: 'MoodShare', text: mood.text, url }).catch(() => { });
        } else {
            navigator.clipboard.writeText(url).then(() => showFeedback("success", "copied_link"));
        }
    });

    repostBtn.addEventListener('click', async () => {
        try {
            const res = await fetchWithAuth(`/posts/${mood.id}/repost`, { method: 'POST' });
            if (res.status === 201) {
                const newp = await res.json();
                displayMood(newp);
                showFeedback("success", "reposted");
            } else if (res.status === 401) {
                showFeedback("error", "login_required");
            } else {
                const errData = await res.json().catch(() => ({}));
                console.error('❌ Repost error:', res.status, errData);
                showFeedback("error", "repost_failed");
            }
        } catch (err) {
            console.error('❌ Repost fetch error:', err);
            showFeedback("error", "repost_failed");
        }
    });

}

// ============================================================
// REPORT MODAL
// ============================================================
function openReportModal(postId) {
    const overlay = document.getElementById('reportModalOverlay');
    if (!overlay) return;

    // Reset form
    document.getElementById('reportCategory').value = '';
    document.getElementById('reportDetail').value = '';
    document.getElementById('reportCharCount').textContent = '0 / 500';
    document.getElementById('reportError').style.display = 'none';
    document.getElementById('reportSuccess').style.display = 'none';
    document.getElementById('reportSubmitBtn').disabled = false;
    document.getElementById('reportSubmitBtn').textContent = 'Envoyer le signalement';

    // Store post id on the form
    overlay.dataset.postId = postId;

    overlay.classList.remove('hidden');
    overlay.classList.add('visible');
    // Slight delay so animation fires
    requestAnimationFrame(() => overlay.querySelector('.report-modal-panel').classList.add('open'));
}

function closeReportModal() {
    const overlay = document.getElementById('reportModalOverlay');
    if (!overlay) return;
    overlay.querySelector('.report-modal-panel').classList.remove('open');
    setTimeout(() => {
        overlay.classList.remove('visible');
        overlay.classList.add('hidden');
    }, 280);
}

async function submitReport() {
    const overlay = document.getElementById('reportModalOverlay');
    const postId = overlay.dataset.postId;
    const category = document.getElementById('reportCategory').value;
    const detail = document.getElementById('reportDetail').value.trim();
    const errorEl = document.getElementById('reportError');
    const successEl = document.getElementById('reportSuccess');
    const submitBtn = document.getElementById('reportSubmitBtn');

    errorEl.style.display = 'none';

    if (!category) {
        errorEl.textContent = 'Veuillez choisir une catégorie.';
        errorEl.style.display = 'block';
        return;
    }
    if (!detail || detail.length < 5) {
        errorEl.textContent = 'Merci de décrire le problème (5 caractères minimum).';
        errorEl.style.display = 'block';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi…';

    const reason = `[${category}] ${detail}`;

    try {
        const res = await fetch(`${API}/posts/${postId}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ reason })
        });

        if (res.ok) {
            successEl.style.display = 'block';
            submitBtn.textContent = 'Signalement envoyé ✓';
            setTimeout(() => closeReportModal(), 1800);
        } else if (res.status === 401) {
            errorEl.textContent = 'Vous devez être connecté pour signaler un post.';
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Envoyer le signalement';
        } else {
            const data = await res.json().catch(() => ({}));
            errorEl.textContent = data.error || 'Une erreur est survenue.';
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Envoyer le signalement';
        }
    } catch (err) {
        errorEl.textContent = 'Erreur réseau. Réessaie dans quelques secondes.';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer le signalement';
    }
}

// Expose to global scope for inline HTML handlers
window.closeReportModal = closeReportModal;
window.submitReport = submitReport;
(async () => {
    const res = await fetch(`${API}/posts`);
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

// Empêche de fermer quand on clique dans le picker
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
        success: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"36\" height=\"36\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.25\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-circle-check-icon lucide-circle-check\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m9 12 2 2 4-4\"/></svg>",
        error: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"36\" height=\"36\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.25\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-circle-x-icon lucide-circle-x\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m15 9-6 6\"/><path d=\"m9 9 6 6\"/></svg>",
        warning: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"36\" height=\"36\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.25\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-triangle-alert-icon lucide-triangle-alert\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>   ",
        info: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"36\" height=\"36\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.25\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-circle-alert-icon lucide-circle-alert\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\"/><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\"/></svg>",
        remark: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"36\" height=\"36\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.25\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-message-circle-warning-icon lucide-message-circle-warning\"><path d=\"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719\"/><path d=\"M12 8v4\"/><path d=\"M12 16h.01\"/></svg>",
        welcome: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"36\" height=\"36\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.25\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-party-popper-icon lucide-party-popper\"><path d=\"M5.8 11.3 2 22l10.7-3.79\"/><path d=\"M4 3h.01\"/><path d=\"M22 8h.01\"/><path d=\"M15 2h.01\"/><path d=\"M22 20h.01\"/><path d=\"m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10\"/><path d=\"m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17\"/><path d=\"m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7\"/><path d=\"M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1..93-2..83-4..75, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5\""
    };

    // ---- Icône ----
    const icon = document.createElement("span");
    icon.className = "material-symbols-rounded";
    icon.innerHTML = icons[type];

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
    p.textContent = message;

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
    wall.innerHTML = "<i>Chargement des posts...</i>";

    try {
        // ⚙️ Si tu as une API user spécifique :
        const res = await fetch(`${API}/posts`);
        const posts = await res.json();

        // Simule l’utilisateur connecté
        const currentUser = localStorage.getItem("username") || "Anonyme";

        const userPosts = posts.filter(p => p.user === currentUser || !p.user);
        userPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        wall.textContent = "";

        if (userPosts.length === 0) {
            wall.textContent = "Aucun post pour le moment.";
            return;
        }

        userPosts.forEach(p => {
            const div = document.createElement("div");
            div.className = "user-post";
            div.textContent = p.text;
            wall.appendChild(div);
        });

        document.getElementById("countPosts").textContent = userPosts.length;
    } catch (err) {
        wall.textContent = "Erreur lors du chargement des posts";
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
                    textColor: document.getElementById('textColor')?.value || null,
                    emoji,
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                };

                const resStory = await fetch(`${API}/stories`, {
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
                    textColor: document.getElementById('textColor')?.value || null,
                    emoji,
                    ephemeral: ephemeralToggle.checked,
                    expiresAt
                };

                const response = await fetch(`${API}/posts`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newMood)
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const savedMood = await response.json();
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

const loader = document.getElementById('loader');
loader.style.display = 'flex';
setTimeout(() => {
    loader.style.display = 'none';
}, 2000);
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
const openBtn = document.getElementById("currentLangLabel");

const langPopup = document.getElementById("langPopup");
const langGrid = document.getElementById("langGrid");
const searchInput = document.getElementById("langSearch");

async function initLanguageSelector() {
    const langs = await loadLanguages();

    function render(filtered) {
        langGrid.textContent = "";

        filtered.forEach(lang => {
            const item = document.createElement("div");
            item.className = "lp-item";
            item.dataset.lang = lang.code;
            item.textContent = `
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


console.log(`%c⚠ Attention: Ne rentrez JAMAIS de commande ici sans connaître son but !`, "color: orange; font-size: 25px; font-family: impact");

// Générer les skeleton loaders avec cercles/carrés défilants
function enhanceSkeletons() {
    document.querySelectorAll('.skeleton').forEach(skeleton => {
        if (skeleton.dataset.enhanced) return;

        skeleton.textContent = '';
        skeleton.dataset.enhanced = 'true';

        // Créer 5 formes (alternance carré/cercle)
        for (let i = 0; i < 7; i++) {
            const shape = document.createElement('div');
            shape.className = 'skeleton-circle';

            const isCircle = i % 2 === 0;
            const borderRadius = isCircle ? '50%' : '15px';

            shape.style.cssText = `
                width: 60px;
                height: 60px;
                border-radius: ${borderRadius};
                transform: scale(1) translateY(-22px);
            `;

            skeleton.appendChild(shape);
        }
    });
}

// Lancer après le chargement du DOM
document.addEventListener('DOMContentLoaded', enhanceSkeletons);

function detectLowEnd() {
    const mem = navigator.deviceMemory || 1; // GB
    const cores = navigator.hardwareConcurrency || 1;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // court test FPS
    return new Promise(resolve => {
        let frames = 0, start = performance.now();
        function f() {
            frames++; if (performance.now() - start < 200) { requestAnimationFrame(f); } else {
                const fps = frames / ((performance.now() - start) / 1000);
                const score = (mem * 2 + cores + (reduceMotion ? 2 : 0) + (fps > 45 ? 2 : fps > 25 ? 1 : 0));
                resolve(score < 5); // true = low-end
            }
        }; requestAnimationFrame(f);
    });
}

async function applyLowEndMode() {
    const pref = localStorage.getItem('lowEndMode') || 'auto';
    let isLow = false;
    if (pref === 'on') isLow = true;
    else if (pref === 'off') isLow = false;
    else isLow = await detectLowEnd();
    document.documentElement.classList.toggle('low-end', isLow);
}
applyLowEndMode();


// gestion propre du contrôle radio "low-end"
(async function initLowEndUI() {
    // récupération des radios
    const radios = document.querySelectorAll('input[name="lowEndMode"]');
    if (!radios || radios.length === 0) return; // rien à faire si le HTML n'est pas présent

    // lecture de la préférence et mise à jour de l'UI
    const pref = localStorage.getItem('lowEndMode') || 'auto';
    const match = Array.from(radios).find(r => r.value === pref);
    if (match) match.checked = true;

    // quand l'utilisateur change la sélection
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (!e.target.checked) return;
            localStorage.setItem('lowEndMode', e.target.value);
            // réapplique immédiatement le mode low-end
            applyLowEndMode();
        });
    });

    // applique l'état au chargement (applyLowEndMode est async)
    await applyLowEndMode();

    // charger conditionnellement le picker emoji si pas en low-end
    if (!document.documentElement.classList.contains('low-end')) {
        import('https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js').catch(() => {/* ignore load errors */ });
    }
})();

// Affichage des stories dans la liste
function addStoryToList(story) {
    const storiesList = document.querySelector('.stories-list');
    if (!storiesList) return;

    const storyDiv = document.createElement('div');
    storyDiv.className = 'story-item';

    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'story-emoji';
    emojiSpan.textContent = story.emoji || '📸';

    const textSpan = document.createElement('span');
    textSpan.className = 'sr-only';
    textSpan.textContent = story.text || '';

    storyDiv.appendChild(emojiSpan);
    storyDiv.appendChild(textSpan);

    // Appliquer style: fond + couleur texte (si fournie sinon contraste)
    if (story.color) storyDiv.style.background = story.color;
    const sTextColor = story.textColor || ((story.color && getBrightness(story.color) < 128) ? "#FFFFFF" : "#000000");
    emojiSpan.style.color = sTextColor;
    textSpan.style.color = sTextColor;

    storiesList.appendChild(storyDiv);

    // passe l'élément source à la visionneuse pour l'animation
    storyDiv.addEventListener('click', () => openStoryViewer(story, storyDiv));
}

// Visionneuse simple
function openStoryViewer(story, sourceEl) {
    if (!sourceEl) {
        // fallback simple
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

        // couleur texte pour le viewer
        const vTextColor = story.textColor || ((story.color && getBrightness(story.color) < 128) ? "#FFFFFF" : "#000000");
        emojiEl.style.color = vTextColor;
        p.style.color = vTextColor;

        content.appendChild(emojiEl);
        content.appendChild(p);
        viewer.appendChild(content);
        document.body.appendChild(viewer);
        viewer.addEventListener('click', () => viewer.remove());
        setTimeout(() => viewer.remove(), 4000);
        return;
    }

    // clone la bulle source et place en position fixe
    const rect = sourceEl.getBoundingClientRect();
    const clone = sourceEl.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    clone.style.zIndex = 9999;
    clone.style.display = 'flex';
    clone.style.alignItems = 'center';
    clone.style.justifyContent = 'center';
    clone.style.overflow = 'hidden';
    clone.style.transition = 'all 450ms cubic-bezier(.2,.8,.2,1)';
    clone.style.borderRadius = '50%';
    clone.style.boxShadow = '0 0 0px 0px rgba(0,0,0,0.3)';
    // applique couleur si fournie
    clone.style.background = story.color || getComputedStyle(sourceEl).backgroundColor || '#111';
    // force le rendu
    document.body.appendChild(clone);
    clone.getBoundingClientRect();

    // calcule taille cible (centre écran)
    const targetW = Math.min(window.innerWidth * 0.9, 900);
    const targetH = Math.min(window.innerHeight * 0.82, 700);
    const targetLeft = (window.innerWidth - targetW) / 2;
    const targetTop = (window.innerHeight - targetH) / 2;

    // anime vers le centre et passe en rectangle
    requestAnimationFrame(() => {
        clone.style.left = targetLeft + 'px';
        clone.style.top = targetTop + 'px';
        clone.style.width = targetW + 'px';
        clone.style.height = targetH + 'px';
        clone.style.borderRadius = '12px';
        clone.style.boxShadow = '0 0 8000px 2400px rgba(0,0,0,0.3)';
    });

    // après l'animation, affiche le contenu détaillé dans le clone
    clone.addEventListener('transitionend', function handler() {
        clone.removeEventListener('transitionend', handler);

        // remplace l'intérieur par le viewer réel
        clone.innerHTML = '';
        clone.style.cursor = 'pointer';
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.padding = '20px';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        wrapper.style.boxSizing = 'border-box';
        const emojiEl = document.createElement('span');
        emojiEl.style.fontSize = '4rem';
        emojiEl.textContent = story.emoji || '';
        const p = document.createElement('p');
        p.textContent = story.text || '';
        p.style.marginTop = '12px';
        p.style.textAlign = 'center';
        p.style.wordBreak = 'break-word';

        // appliquer couleur texte fournie ou automatique
        const viewerTextColor = story.textColor || ((story.color && getBrightness(story.color) < 128) ? "#FFFFFF" : "#000000");
        emojiEl.style.color = viewerTextColor;
        p.style.color = viewerTextColor;

        wrapper.appendChild(emojiEl);
        wrapper.appendChild(p);
        clone.appendChild(wrapper);

        // ferme avec animation de retour
        let autoTimeout = setTimeout(close, 4000);
        function close() {
            clearTimeout(autoTimeout);
            const srcRect = sourceEl.getBoundingClientRect();
            clone.style.transition = 'all 320ms ease';
            clone.style.left = srcRect.left + 'px';
            clone.style.top = srcRect.top + 'px';
            clone.style.width = srcRect.width + 'px';
            clone.style.height = srcRect.height + 'px';
            clone.style.borderRadius = '50%';
            clone.addEventListener('transitionend', () => clone.remove(), { once: true });
        }

        clone.addEventListener('click', close);
    });
}

const profilename = document.getElementById('userName');
if (profilename) {
    const storedName = localStorage.getItem('username') || 'Invité';
    profilename.textContent = storedName;
}
setTimeout(() => {
    addInboxNotification("info", "update_title", "update_info");
}, 500);