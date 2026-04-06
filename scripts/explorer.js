// ============================================================
// explorer.js — Page Explorateur
// Grille de posts tendance avec filtres par émotion
// API : GET /api/posts?sort=popular&limit=30
// ============================================================

const API = 'https://moodshare-7dd7.onrender.com/api';

// Catégories de filtrage par sentiment
const CATEGORIES = [
    { id: 'all', label: 'Tout', emoji: '🌍' },
    { id: 'happy', label: 'Heureux', emoji: '😊', emojis: ['😊', '😄', '🥳', '😁', '🎉', '✨', '💫', '🌟', '😍', '🥰'] },
    { id: 'sad', label: 'Mélancolie', emoji: '😢', emojis: ['😢', '😔', '💔', '😞', '🥺', '😿', '🌧️', '💭'] },
    { id: 'fire', label: 'Enflammé', emoji: '🔥', emojis: ['🔥', '⚡', '💥', '🌶️', '💢', '😤', '🤬'] },
    { id: 'chill', label: 'Zen', emoji: '🧘', emojis: ['🧘', '🌊', '🍃', '🌙', '💤', '😌', '🌿', '🕊️'] },
    { id: 'funny', label: 'Drôle', emoji: '😂', emojis: ['😂', '🤣', '😜', '🤪', '😅', '🙃'] },
];

// ─── Point d'entrée ──────────────────────────────────────────
export async function initExplorer() {
    _injectExplorerTab();
    // Charger les posts au premier clic sur l'onglet Explorer
    const explorerBtn = document.getElementById('explorerTab');
    if (explorerBtn) {
        explorerBtn.addEventListener('click', () => {
            const section = document.getElementById('explorer-section');
            if (section && !section.dataset.loaded) {
                section.dataset.loaded = 'true';
                _loadExplorer();
            }
        }, { once: false });
    }
}

// ─── Injection de l'onglet dans la nav ──────────────────────
function _injectExplorerTab() {
    const nav = document.querySelector('nav');
    if (!nav || document.getElementById('explorerTab')) return;

    // Bouton nav
    const navLink = document.querySelector('.explorerbtn');
    navLink.id = 'explorerTab';
    navLink.className = 'sort-btn';

    // Section tab
    const section = document.createElement('section');
    section.id = 'explorer-section';
    section.className = 'tab hidden';
    section.innerHTML = `
        <div class="exp-header">
            <button class="explorerbackbtn"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-big-left-icon lucide-arrow-big-left"><path d="M10.793 19.793a.707.707 0 0 0 1.207-.5V16a1 1 0 0 1 1-1h6a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-6a1 1 0 0 1-1-1V4.707a.707.707 0 0 0-1.207-.5l-6.94 6.94a1.207 1.207 0 0 0 0 1.707z"/></svg> Retour en arrière</button>
            <h2 class="exp-title"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1d88ec" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-compass-icon lucide-compass"><circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/></svg> Explorer</h2>
            <p class="exp-sub">Les posts les plus populaires de la communauté</p>
        </div>
        <div class="exp-filters" id="exp-filters"></div>
        <div class="exp-stats" id="exp-stats"></div>
        <div class="exp-grid" id="exp-grid">
            <div class="exp-loading">
                <span class="loader-dot"></span>
                <span class="loader-dot"></span>
                <span class="loader-dot"></span>
            </div>
        </div>
    `;

    // Clic sur le back → revenir au feed
    section.querySelector('.explorerbackbtn')?.addEventListener('click', () => {
        document.querySelector('section#homeTab')?.classList.remove('hidden');
        document.querySelector('section#homeTab')?.classList.add('active');
        section.classList.add('hidden');
        section.classList.remove('active');
        document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
        document.querySelector('nav a#homeTab')?.classList.add('active');
    });
    // Insérer avant le footer ou à la fin du main
    const main = document.querySelector('main') || document.body;
    main.appendChild(section);

    // Intégrer avec le système d'onglets existant
    navLink.addEventListener('click', (e) => {
        document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
        navLink.classList.add('active');
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('hidden', t.id !== 'explorer-section');
            t.classList.toggle('active', t.id === 'explorer-section');
        });
    });

    // Rendre les onglets existants fermer l'explorer
    document.querySelectorAll('nav a:not(#explorerTab)').forEach(a => {
        a.addEventListener('click', () => section.classList.add('hidden'));
    });
}

// ─── Chargement des posts ────────────────────────────────────
let _allPosts = [];
let _activeFilter = 'all';

async function _loadExplorer() {
    try {
        // Essayer plusieurs endpoints (le backend peut avoir des noms différents)
        let posts = [];
        const urls = [
            `${API}/posts?sort=popular&limit=40`,
            `${API}/posts?sort=likes&limit=40`,
            `${API}/posts?limit=40`,
        ];
        for (const url of urls) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    posts = await res.json();
                    if (Array.isArray(posts) && posts.length > 0) break;
                }
            } catch { }
        }

        if (!Array.isArray(posts)) posts = [];

        // Trier par likes
        posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        _allPosts = posts;

        _renderFilters();
        _renderStats(posts);
        _renderGrid(posts);
    } catch (err) {
        console.error('❌ Explorer load error:', err);
        const grid = document.getElementById('exp-grid');
        if (grid) grid.innerHTML = '<p class="exp-empty">Impossible de charger les posts.</p>';
    }
}

// ─── Filtres de catégorie ────────────────────────────────────
function _renderFilters() {
    const container = document.getElementById('exp-filters');
    if (!container) return;

    container.innerHTML = '';
    CATEGORIES.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `exp-filter${cat.id === _activeFilter ? ' exp-filter--active' : ''}`;
        btn.dataset.cat = cat.id;
        btn.innerHTML = `${cat.emoji} ${cat.label}`;
        btn.addEventListener('click', () => {
            _activeFilter = cat.id;
            container.querySelectorAll('.exp-filter').forEach(b => {
                b.classList.toggle('exp-filter--active', b.dataset.cat === cat.id);
            });
            const filtered = cat.id === 'all' ? _allPosts : _filterByCategory(_allPosts, cat);
            _renderGrid(filtered);
        });
        container.appendChild(btn);
    });
}

function _filterByCategory(posts, cat) {
    if (!cat.emojis) return posts;
    return posts.filter(p => cat.emojis.some(e => (p.emoji || '').includes(e)));
}

// ─── Stats rapides ───────────────────────────────────────────
function _renderStats(posts) {
    const el = document.getElementById('exp-stats');
    if (!el) return;

    const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
    const topEmoji = _getMostFrequentEmoji(posts);

    el.innerHTML = `
        <div class="exp-stat">
            <strong>${posts.length}</strong>
            <span>posts</span>
        </div>
        <div class="exp-stat">
            <strong>${totalLikes}</strong>
            <span>likes</span>
        </div>
        <div class="exp-stat">
            <strong>${topEmoji}</strong>
            <span>emoji top</span>
        </div>
    `;
}

function _getMostFrequentEmoji(posts) {
    const freq = {};
    posts.forEach(p => {
        if (p.emoji) freq[p.emoji] = (freq[p.emoji] || 0) + 1;
    });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || '🌍';
}

// ─── Grille de posts ─────────────────────────────────────────
function _renderGrid(posts) {
    const grid = document.getElementById('exp-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!posts.length) {
        grid.innerHTML = '<p class="exp-empty">Aucun post dans cette catégorie.</p>';
        return;
    }

    posts.forEach((post, idx) => {
        const card = _createExplorerCard(post, idx);
        grid.appendChild(card);
    });
}

function _createExplorerCard(post, idx) {
    const card = document.createElement('div');
    card.className = 'exp-card';
    card.style.setProperty('--idx', idx);

    const bg = post.color || '#1a1a2e';
    const textColor = _getTextColor(bg);

    card.style.background = bg;

    // Badge rang
    let rankBadge = '';
    if (idx === 0) rankBadge = `<span class="exp-rank exp-rank--gold">🥇</span>`;
    else if (idx === 1) rankBadge = `<span class="exp-rank exp-rank--silver">🥈</span>`;
    else if (idx === 2) rankBadge = `<span class="exp-rank exp-rank--bronze">🥉</span>`;

    const likes = post.likes || 0;
    const text = (post.text || '').substring(0, 120);
    const date = post.createdAt ? new Date(post.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';

    card.innerHTML = `
        ${rankBadge}
        <div class="exp-card__emoji" style="color:${textColor}">${post.emoji || '📝'}</div>
        <p class="exp-card__text" style="color:${textColor}">${_esc(text)}${text.length >= 120 ? '…' : ''}</p>
        <div class="exp-card__footer">
            <span class="exp-card__likes" style="color:${textColor}88">❤️ ${likes}</span>
            <span class="exp-card__date" style="color:${textColor}88">${date}</span>
        </div>
    `;

    // Clic → ouvre la modale permalink
    card.addEventListener('click', () => {
        if (typeof window.openPermalinkModal === 'function') {
            window.openPermalinkModal(post.id || post._id);
        } else {
            // Fallback : mettre le hash
            window.location.hash = `#post-${post.id || post._id}`;
        }
    });

    // Animation d'entrée en cascade
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px)';
    setTimeout(() => {
        card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, idx * 40);

    return card;
}

// ─── Utilitaires ─────────────────────────────────────────────
function _esc(t) {
    const d = document.createElement('div'); d.textContent = t; return d.innerHTML;
}

function _getTextColor(bg) {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#1a1a1a' : '#ffffff';
    } catch { return '#ffffff'; }
}