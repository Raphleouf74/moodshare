const API_ME = '/api/users/me';

function openOAuthPopup(path, name = 'oauth', w = 600, h = 700) {
    try {
        const left = (screen.width / 2) - (w / 2);
        const top = (screen.height / 2) - (h / 2);
        const popup = window.open(path, name,
            `width=${w},height=${h},top=${top},left=${left}`);

        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            throw new Error('Popup blocked');
        }
        return popup;
    } catch (e) {
        console.error('OAuth popup error:', e);
        alert('Veuillez autoriser les popups pour vous connecter');
    }
}

function listenForOAuthResponse() {
    window.addEventListener('message', (e) => {
        if (e.origin !== window.location.origin) return;
        const data = e.data;
        if (!data || data.type !== 'oauth' || !data.user) return;
        populateProfile(data.user);
    });
}

export async function fetchMe() {
    try {
        const res = await fetch(API_ME, { credentials: 'same-origin' });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn('fetchMe error', e);
        return null;
    }
}

export function populateProfile(user) {
    if (!user) return;
    const avatar = document.getElementById('accountavatar');
    const username = document.getElementById('profileUsername');
    const fullname = document.getElementById('profileFullName');
    const email = document.getElementById('profileEmail');
    const followers = document.getElementById('countFollowers');
    const likes = document.getElementById('countLikes');
    const socialStats = document.getElementById('socialStats');

    if (user.photo) avatar.src = user.photo;
    username.value = user.displayName || user.username || '';
    fullname.value = [user.name, user.familyName].filter(Boolean).join(' ') || user.displayName || '';
    email.value = user.email || '';
    followers.textContent = user.followers || 0;
    likes.textContent = user.likes || 0;
    socialStats.style.display = (user.followers || user.likes) ? 'block' : 'none';
}

async function init() {
    listenForOAuthResponse();

    // Configuration des boutons de connexion sociale
    const g = document.getElementById('loginGoogle');
    const ig = document.getElementById('loginInstagram');

    if (g) g.addEventListener('click', () => openOAuthPopup('/auth/google', 'google-oauth'));
    if (ig) ig.addEventListener('click', () => openOAuthPopup('/auth/instagram', 'instagram-oauth'));

    // Configuration du bouton d'édition
    const editBtn = document.getElementById('editProfileBtn');
    let editing = false;
    if (editBtn) {
        editBtn.addEventListener('click', async () => {
            editing = !editing;
            const inputs = ['profileUsername', 'profileFullName', 'profileEmail', 'profilePhone', 'profilePassword']
                .map(id => document.getElementById(id))
                .filter(Boolean);

            inputs.forEach(i => i.disabled = !editing);

            if (!editing) {
                const payload = {
                    displayName: document.getElementById('profileUsername').value,
                    name: document.getElementById('profileFullName').value,
                    email: document.getElementById('profileEmail').value
                };

                await fetch(API_ME, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    credentials: 'same-origin'
                });
            }

            editBtn.textContent = editing ? 'Enregistrer' : 'Modifier';
        });
    }

    // Chargement initial du profil
    const me = await fetchMe();
    if (me) populateProfile(me);
}

document.addEventListener('DOMContentLoaded', init);

const loginButtons = ['loginGoogle', 'loginInstagram'];

loginButtons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            btn.disabled = true;
            try {
                openOAuthPopup(`/auth/${id.replace('login', '').toLowerCase()}`);
            } finally {
                // Réactive le bouton après 5s dans tous les cas
                setTimeout(() => btn.disabled = false, 5000);
            }
        });
    }
});