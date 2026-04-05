// ============================================================
// feed-extras.js — Améliorations du feed
// • Tri : Récents / Populaires / Tendances
// • Compteur de vues (IntersectionObserver)
// • Bannière "Mood du jour"
// • Regroupement des posts par émotion
// • Infinite scroll (si l'API supporte ?page=X&limit=20)
// ============================================================

const API = 'https://moodshare-7dd7.onrender.com/api';

// ─── Mood du jour — couleur/emoji basé sur la date ───────────
const DAILY_MOODS = [
    { emoji: '☀️', theme: 'Bonne énergie', color: '#f7971e', text: 'Quel est votre mood aujourd\'hui ?' },
    { emoji: '🌙', theme: 'Soirée calme', color: '#302b63', text: 'La nuit porte conseil…' },
    { emoji: '🌊', theme: 'Flow', color: '#4facfe', text: 'Laissez-vous porter par le courant.' },
    { emoji: '🔥', theme: 'Motivation', color: '#f5576c', text: 'Aujourd\'hui on donne tout !' },
    { emoji: '🌸', theme: 'Douceur', color: '#a18cd1', text: 'Prenez soin de vous.' },
    { emoji: '⚡', theme: 'Électrique', color: '#00b09b', text: 'L\'énergie est palpable !' },
    { emoji: '🍂', theme: 'Nostalgie', color: '#8b5e3c', text: 'Les souvenirs ont leur beauté.' },
    { emoji: '🌈', theme: 'Optimisme', color: '#43cea2', text: 'Après la pluie, le beau temps.' }
    
];

function _getTodayMood() {
    const day = Math.floor(Date.now() / 86400000);
    return DAILY_MOODS[day % DAILY_MOODS.length];
}

// ─── Point d'entrée ──────────────────────────────────────────
export function initFeedExtras() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }
}

function _init() {
    _injectSortBar();
    _injectMoodOfDay();
    _initViewCounter();
    _initInfiniteScroll();
}

// ─── 1. Barre de tri ─────────────────────────────────────────
function _injectSortBar() {
    const wall = document.getElementById('moodWall');
    if (!wall || document.getElementById('sort-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'sort-bar';
    bar.className = 'sort-bar';
    bar.innerHTML = `
        <button class="sort-btn sort-btn--active" data-sort="recent">Récents</button>
        <button class="sort-btn" data-sort="popular">Populaires</button>
        <button class="sort-btn" data-sort="trending">Tendances</button>
        <button class="sort-btn nav-icon explorerbtn">Explorer</button>
    `;

    wall.insertAdjacentElement('beforebegin', bar);

    bar.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            bar.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('sort-btn--active'));
            btn.classList.add('sort-btn--active');
            _sortFeed(btn.dataset.sort);
        });
    });
}

function _sortFeed(mode) {
    const wall = document.getElementById('moodWall');
    if (!wall) return;

    const posts = Array.from(wall.querySelectorAll('.post:not(.WelcomeMood)'));
    if (!posts.length) return;

    posts.sort((a, b) => {
        if (mode === 'popular') {
            const la = parseInt(a.querySelector('.like-count')?.textContent || '0', 10);
            const lb = parseInt(b.querySelector('.like-count')?.textContent || '0', 10);
            return lb - la;
        }
        if (mode === 'trending') {
            // Score = likes + (nouveauté : posts récents ont un bonus)
            const la = parseInt(a.querySelector('.like-count')?.textContent || '0', 10);
            const lb = parseInt(b.querySelector('.like-count')?.textContent || '0', 10);
            const ia = posts.indexOf(a); // indice = plus petit = plus récent
            const ib = posts.indexOf(b);
            const scoreA = la * 2 + (posts.length - ia);
            const scoreB = lb * 2 + (posts.length - ib);
            return scoreB - scoreA;
        }
        // recent = ordre DOM actuel (ne rien faire)
        return posts.indexOf(a) - posts.indexOf(b);
    });

    // Réordonner dans le DOM avec animation
    posts.forEach((post, i) => {
        post.style.transition = 'opacity 0.2s';
        post.style.opacity = '0';
        setTimeout(() => {
            wall.appendChild(post);
            post.style.opacity = '1';
        }, i * 30);
    });
}

// ─── 2. Bannière Mood du jour ────────────────────────────────
function _injectMoodOfDay() {
    const wall = document.getElementById('moodWall');
    if (!wall || document.getElementById('mood-today')) return;

    const mood = _getTodayMood();
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    const banner = document.createElement('div');
    banner.id = 'mood-today';
    banner.className = 'mood-today';
    banner.style.setProperty('--mood-color', mood.color);
    banner.innerHTML = `
        <div class="mood-today__emoji">${mood.emoji}</div>
        <div class="mood-today__content">
            <p class="mood-today__theme">${mood.theme} du ${today}</p>
            <p class="mood-today__text">${mood.text}</p>
        </div>
        <button class="mood-today__share" title="Partager mon mood">Partager un post</button>
        <button class="mood-today__close" title="Fermer" aria-label="Fermer">✕</button>
    `;

    wall.insertAdjacentElement('beforebegin', banner);

    // Bouton "Partager"  → focus sur le créateur
    banner.querySelector('.mood-today__share').addEventListener('click', () => {
        const createBtn = document.getElementById('createTab');
        if (createBtn) createBtn.click();
        const moodInput = document.getElementById('moodInput');
        if (moodInput) {
            moodInput.focus();
            if (!moodInput.value) moodInput.value = mood.emoji + ' ';
            moodInput.dispatchEvent(new Event('input'));
        }
    });

    // Bouton fermer
    banner.querySelector('.mood-today__close').addEventListener('click', () => {
        banner.style.animation = 'v2FadeOut 0.3s ease forwards';
        setTimeout(() => banner.remove(), 300);
        try { sessionStorage.setItem('mood_today_closed', Date.now()); } catch { }
    });

    // Ne pas réafficher si fermé dans la même session
    try {
        const closed = sessionStorage.getItem('mood_today_closed');
        if (closed) banner.style.display = 'none';
    } catch { }
}

// ─── 3. Compteur de vues ────────────────────────────────────
const _viewedPosts = new Set();

function _initViewCounter() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const post = entry.target;
            const postId = post.dataset.id;
            if (!postId || _viewedPosts.has(postId)) return;

            _viewedPosts.add(postId);
            observer.unobserve(post);

            // Incrémenter côté serveur (fire-and-forget)
            fetch(`${API}/posts/${postId}/view`, {
                method: 'POST',
                credentials: 'include'
            }).catch(() => { });

            // Afficher le compteur local si pas encore fait
            _showViewCount(post, postId);
        });
    }, { threshold: 0.6, rootMargin: '0px' });

    // Observer les posts existants
    document.querySelectorAll('.post[data-id]').forEach(p => observer.observe(p));

    // Observer les nouveaux posts
    const wall = document.getElementById('moodWall');
    if (wall) {
        new MutationObserver(mutations => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.classList?.contains('post') && node.dataset?.id) {
                        observer.observe(node);
                    }
                });
            });
        }).observe(wall, { childList: true });
    }
}

async function _showViewCount(postEl, postId) {
    const dateP = postEl.querySelector('.postdate');
    if (!dateP || postEl.querySelector('.views')) return;

    const viewsEl = document.createElement('span');
    viewsEl.className = 'views';
    viewsEl.textContent = ' · 👁 …';
    dateP.appendChild(viewsEl);

    try {
        const res = await fetch(`${API}/posts/${postId}`);
        if (res.ok) {
            const data = await res.json();
            const views = data.views || data.viewCount || 1;
            viewsEl.textContent = ` · 👁 ${views}`;
        }
    } catch {
        viewsEl.textContent = ' · 👁 1';
    }
}

// ─── 4. Infinite scroll ──────────────────────────────────────
let _currentPage = 1;
let _isLoadingMore = false;
let _hasMore = true;

function _initInfiniteScroll() {
    if (!('IntersectionObserver' in window)) return;

    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.className = 'scroll-sentinel';
    sentinel.innerHTML = `<div class="scroll-loader" style="display:none">
        <span class="loader-dot"></span><span class="loader-dot"></span><span class="loader-dot"></span>
    </div>`;

    const wall = document.getElementById('moodWall');
    if (!wall) return;
    wall.insertAdjacentElement('afterend', sentinel);

    const loader = sentinel.querySelector('.scroll-loader');

    const observer = new IntersectionObserver(async (entries) => {
        if (!entries[0].isIntersecting) return;
        if (_isLoadingMore || !_hasMore) return;

        _isLoadingMore = true;
        loader.style.display = 'flex';

        try {
            _currentPage++;
            const res = await fetch(`${API}/posts?page=${_currentPage}&limit=20`);
            if (!res.ok) { _hasMore = false; return; }
            const posts = await res.json();

            if (!Array.isArray(posts) || posts.length === 0) {
                _hasMore = false;
                sentinel.innerHTML = '<p class="no-more">Vous avez tout vu ! 🎉</p>';
                return;
            }

            // Appeler displayMood depuis app.js (via window)
            if (typeof window.displayMoodV2 === 'function') {
                posts.forEach(p => window.displayMoodV2(p));
            }
        } catch {
            _hasMore = false;
        } finally {
            _isLoadingMore = false;
            loader.style.display = 'none';
        }
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
}

// ─── Exposer pour que app.js puisse notifier qu'un post est ajouté ──
export function notifyPostAdded(postEl) {
    // Pour que le view counter observe les nouveaux posts dynamiques
    // (déjà géré par le MutationObserver interne)
}

// ─── Réinitialiser la pagination (si on recharge le feed) ────
export function resetPagination() {
    _currentPage = 1;
    _hasMore = true;
    _isLoadingMore = false;
}