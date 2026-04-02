// assets/js/social.js
// Bannière suggestions + partage posts + favoris

const API = 'https://moodshare-7dd7.onrender.com/api';

export async function initSocial() {
    console.log('🔧 Init social features');
    await new Promise(r => setTimeout(r, 1000)); // Attendre auth + feed

    // Injecter bannière suggestions
    injectSuggestionsBanner();

    // Share + favorite sur tous les posts
    attachPostActions();

    // Refresh toutes les 30s
    setInterval(injectSuggestionsBanner, 30000);
}

// ============================================================
// BANNIÈRE SUGGESTIONS (comme Instagram)
// ============================================================

async function injectSuggestionsBanner() {
    try {
        const token = localStorage.getItem('moodshare_token');
        if (!token) return; // Pas connecté

        const res = await fetch(`${API}/social/suggestions`, { credentials: 'include' });
        if (!res.ok) return;

        const data = await res.json();
        if (!data.suggestions || data.suggestions.length === 0) return;

        // Trouver le feed
        const feed = document.querySelector('#homeTab .posts-container, #posts');
        if (!feed) return;

        // Vérifier si bannière existe déjà
        let banner = feed.querySelector('.suggestions-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.className = 'suggestions-banner';

            // Insérer après 3 posts
            const posts = feed.querySelectorAll('.post');
            if (posts.length >= 3) {
                posts[2].after(banner);
            } else {
                feed.appendChild(banner);
            }
        }

        // Remplir bannière
        banner.innerHTML = `
      <div class="banner-header">
        <h3>✨ Comptes que vous pourriez aimer</h3>
        <button class="banner-refresh" title="Actualiser">🔄</button>
      </div>
      <div class="suggestions-list"></div>
    `;

        const list = banner.querySelector('.suggestions-list');

        // Afficher 3 suggestions max
        data.suggestions.slice(0, 3).forEach(user => {
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            card.innerHTML = `
        <div class="suggestion-avatar">${user.avatar || '👤'}</div>
        <div class="suggestion-info">
          <strong class="suggestion-name">${escHtml(user.displayName)}</strong>
          <small class="suggestion-stats">${user.followersCount || 0} followers • ${user.postsCount || 0} posts</small>
          ${user.bio ? `<p class="suggestion-bio">${escHtml(user.bio.substring(0, 50))}...</p>` : ''}
        </div>
        <button class="btn-follow-suggestion" data-user-id="${user._id}">+ Suivre</button>
      `;

            // Click sur la carte → profil
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-follow-suggestion')) {
                    import('./profile.js').then(m => m.viewProfile(user._id));
                }
            });

            // Bouton follow
            const followBtn = card.querySelector('.btn-follow-suggestion');
            followBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await handleQuickFollow(user._id, followBtn, card);
            });

            list.appendChild(card);
        });

        // Refresh button
        banner.querySelector('.banner-refresh').addEventListener('click', injectSuggestionsBanner);

    } catch (err) {
        console.error('❌ Erreur suggestions:', err);
    }
}

async function handleQuickFollow(userId, btn, card) {
    try {
        const res = await fetch(`${API}/social/follow/${userId}`, {
            method: 'POST',
            credentials: 'include'
        });

        if (res.ok) {
            btn.textContent = '✓ Suivi';
            btn.classList.add('followed');
            btn.disabled = true;

            // Fadeout après 1s
            setTimeout(() => {
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                card.style.opacity = '0';
                card.style.transform = 'translateX(-20px)';
                setTimeout(() => card.remove(), 300);
            }, 1000);
        }
    } catch (err) {
        console.error('❌ Erreur follow:', err);
    }
}

// ============================================================
// ACTIONS SUR POSTS (share + favorite)
// ============================================================

function attachPostActions() {
    // Observer pour nouveaux posts
    const observer = new MutationObserver(() => {
        document.querySelectorAll('.post:not([data-social-attached])').forEach(addActionsToPost);
    });

    const feed = document.querySelector('#homeTab .posts-container, #posts');
    if (feed) {
        observer.observe(feed, { childList: true, subtree: true });
    }

    // Ajouter aux posts existants
    document.querySelectorAll('.post').forEach(addActionsToPost);
}

function addActionsToPost(postEl) {
    postEl.setAttribute('data-social-attached', 'true');

    const postId = postEl.dataset.id;
    if (!postId) return;

    // Trouver ou créer actions container
    let actions = postEl.querySelector('.post-actions-social');
    if (!actions) {
        actions = document.createElement('div');
        actions.className = 'post-actions-social';

        // Insérer avant le footer ou à la fin
        const footer = postEl.querySelector('.post-footer');
        if (footer) {
            footer.before(actions);
        } else {
            postEl.appendChild(actions);
        }
    }

    // Boutons
    actions.innerHTML = `
    <button class="btn-share" data-post-id="${postId}" title="Partager">📤</button>
    <button class="btn-favorite" data-post-id="${postId}" title="Ajouter aux favoris">⭐</button>
  `;

    // Listeners
    actions.querySelector('.btn-share').addEventListener('click', () => sharePost(postId, postEl));
    actions.querySelector('.btn-favorite').addEventListener('click', () => toggleFavorite(postId, actions.querySelector('.btn-favorite')));
}

async function sharePost(postId, postEl) {
    try {
        // Demander commentaire optionnel
        const comment = prompt('Commentaire (optionnel) :');
        if (comment === null) return; // Annulé

        const res = await fetch(`${API}/posts/${postId}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text: comment || undefined })
        });

        if (res.ok) {
            // Feedback visuel
            const shareBtn = postEl.querySelector('.btn-share');
            shareBtn.textContent = '✅';
            setTimeout(() => shareBtn.textContent = '📤', 2000);

            // Notification
            showToast('Post partagé ! 🎉');
        } else {
            showToast('Erreur partage', 'error');
        }
    } catch (err) {
        console.error('❌ Erreur share:', err);
        showToast('Erreur partage', 'error');
    }
}

async function toggleFavorite(postId, btn) {
    try {
        // Check si déjà favori (stocké en local)
        let favs = JSON.parse(localStorage.getItem('moodshare_favorites') || '[]');
        const isFav = favs.includes(postId);

        const endpoint = isFav ? 'unfavorite' : 'favorite';
        const res = await fetch(`${API}/social/${endpoint}/${postId}`, {
            method: 'POST',
            credentials: 'include'
        });

        if (res.ok) {
            // Toggle UI
            if (isFav) {
                favs = favs.filter(id => id !== postId);
                btn.textContent = '⭐';
                btn.classList.remove('favorited');
            } else {
                favs.push(postId);
                btn.textContent = '⭐';
                btn.classList.add('favorited');
            }

            localStorage.setItem('moodshare_favorites', JSON.stringify(favs));
        }
    } catch (err) {
        console.error('❌ Erreur favorite:', err);
    }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================
// UTILS
// ============================================================

function escHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSocial);
} else {
    setTimeout(initSocial, 1000);
}