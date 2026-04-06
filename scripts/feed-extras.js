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
    { emoji: '🌈', theme: 'Optimisme', color: '#43cea2', text: 'Après la pluie, le beau temps.' },
    { emoji: '💤', theme: 'Fatigue', color: '#9e9e9e', text: 'Besoin d\'une petite pause ?' },
    { emoji: '💖', theme: 'Amour', color: '#ff6f91', text: 'Répandez un peu d\'amour aujourd\'hui.' },
    { emoji: '😎', theme: 'Cool', color: '#1f4037', text: 'Restez détendu et confiant.' },
    { emoji: '😢', theme: 'Tristesse', color: '#4b6cb7', text: 'Les émotions font partie de la vie.' },
    { emoji: '🤯', theme: 'Stress', color: '#f2994a', text: 'Respirez profondément, ça ira.' },
    { emoji: '😂', theme: 'Humour', color: '#f9d423', text: 'Le rire est contagieux !' },
    { emoji: '🤗', theme: 'Bienveillance', color: '#43cea2', text: 'Un câlin virtuel pour vous.' },
    { emoji: '🌀', theme: 'Confusion', color: '#5f2c82', text: 'Prenez le temps de clarifier vos idées.' },
    { emoji: '🌿', theme: 'Nature', color: '#76b852', text: 'Reconnectez-vous avec le vert.' },
    { emoji: '🕊️', theme: 'Paix', color: '#c0c0c0', text: 'Calmez votre esprit et respirez.' },
    { emoji: '🏃‍♂️', theme: 'Énergie', color: '#f12711', text: 'Bougez et sentez-vous vivant !' },
    { emoji: '🎶', theme: 'Musique', color: '#ff9a9e', text: 'Laissez la musique guider votre humeur.' },
    { emoji: '📚', theme: 'Concentration', color: '#2c3e50', text: 'Plongez-vous dans vos passions.' },
    { emoji: '🎨', theme: 'Créativité', color: '#ff6a00', text: 'Exprimez-vous avec des couleurs.' },
    { emoji: '💡', theme: 'Inspiration', color: '#fceabb', text: 'Une idée peut tout changer.' },
    { emoji: '🛌', theme: 'Relaxation', color: '#6a11cb', text: 'Prenez un moment pour vous.' },
    { emoji: '💪', theme: 'Force', color: '#56ab2f', text: 'Vous êtes plus fort que vous ne le pensez.' },
    { emoji: '🌻', theme: 'Joie', color: '#fbd786', text: 'Souriez, même pour un instant !' },
    { emoji: '🍁', theme: 'Automne', color: '#d1913c', text: 'Les saisons nous rappellent le changement.' },
    { emoji: '🌌', theme: 'Mystère', color: '#141e30', text: 'Contemplez l\'univers et rêvez.' },
    { emoji: '🕹️', theme: 'Jeu', color: '#ff512f', text: 'Amusez-vous un peu !' },
    { emoji: '💭', theme: 'Réflexion', color: '#00c6ff', text: 'Pensez à ce qui compte vraiment.' },
    { emoji: '🌟', theme: 'Émerveillement', color: '#fceabb', text: 'Les petites choses sont magiques.' },
    { emoji: '🌪️', theme: 'Chaos', color: '#283c86', text: 'Acceptez l\'imprévu.' },
    { emoji: '🧘‍♀️', theme: 'Sérénité', color: '#56ab2f', text: 'Respirez, tout est sous contrôle.' },
    { emoji: '🥳', theme: 'Fête', color: '#ff9a9e', text: 'Célébrez les petits moments !' },
    { emoji: '💔', theme: 'Cœur brisé', color: '#b31217', text: 'Les émotions sont valides.' },
    { emoji: '🤩', theme: 'Excitation', color: '#f7971e', text: 'Aujourd\'hui promet quelque chose de grand !' },
    { emoji: '🛶', theme: 'Aventure', color: '#2193b0', text: 'Partez à la découverte du monde.' },
    { emoji: '🖤', theme: 'Mélancolie', color: '#000000', text: 'Prenez un moment pour vous recentrer.' },
    { emoji: '🍀', theme: 'Chance', color: '#76b852', text: 'Un peu de chance ne fait jamais de mal.' },
    { emoji: '💎', theme: 'Élégance', color: '#6a11cb', text: 'Brillez avec confiance.' },
    { emoji: '🌐', theme: 'Connexion', color: '#1f4037', text: 'Rapprochez-vous des autres.' },
    { emoji: '🍕', theme: 'Confort', color: '#f857a6', text: 'Un petit plaisir pour se sentir bien.' },
    { emoji: '🦋', theme: 'Transformation', color: '#43cea2', text: 'Chaque jour est une nouvelle chance.' },
    { emoji: '📸', theme: 'Souvenirs', color: '#ff512f', text: 'Capturez les moments précieux.' },
    { emoji: '🌅', theme: 'Espoir', color: '#f7971e', text: 'Demain est un nouveau départ.' },
    { emoji: '🧩', theme: 'Curiosité', color: '#ff6a00', text: 'Explorez, apprenez, découvrez.' },
    { emoji: '🥰', theme: 'Gratitude', color: '#ff9a9e', text: 'Remerciez pour ce que vous avez.' },
    { emoji: '🛡️', theme: 'Protection', color: '#283c86', text: 'Prenez soin de vous et de vos proches.' },
    { emoji: '⚓', theme: 'Stabilité', color: '#00c6ff', text: 'Restez ancré dans le présent.' },
    { emoji: '🌺', theme: 'Beauté', color: '#fbd786', text: 'Appréciez la beauté autour de vous.' },
    { emoji: '🦄', theme: 'Magie', color: '#a18cd1', text: 'Croyez en l\'impossible !' },
    { emoji: '🛍️', theme: 'Shopping', color: '#ff512f', text: 'Un petit plaisir pour soi-même.' },
    { emoji: '🗻', theme: 'Défi', color: '#2c3e50', text: 'Relevez de nouveaux défis.' },
    { emoji: '🧸', theme: 'Confort émotionnel', color: '#f9d423', text: 'Prenez soin de votre cœur.' },
    { emoji: '🎯', theme: 'Objectifs', color: '#f12711', text: 'Focalisez-vous sur ce qui compte.' },
    { emoji: '🚀', theme: 'Ambition', color: '#56ab2f', text: 'Visez haut et atteignez vos rêves.' },
    { emoji: '🎉', theme: 'Célébration', color: '#ff9a9e', text: 'Fêtez chaque victoire, petite ou grande.' },
    { emoji: '🥺', theme: 'Vulnérabilité', color: '#a18cd1', text: 'C\'est ok de montrer vos émotions.' },
    { emoji: '🪁', theme: 'Légèreté', color: '#43cea2', text: 'Laissez vos soucis s\'envoler.' },
    { emoji: '🏖️', theme: 'Détente', color: '#f7971e', text: 'Un moment pour respirer et se relaxer.' },
    { emoji: '🌪️', theme: 'Tourbillon', color: '#283c86', text: 'Tout peut changer rapidement, restez calme.' },
    { emoji: '🕵️‍♂️', theme: 'Curiosité', color: '#ff6a00', text: 'Explorez ce qui vous intrigue.' },
    { emoji: '🪄', theme: 'Magie du quotidien', color: '#fbd786', text: 'Cherchez la magie dans les petits gestes.' },
    { emoji: '🌼', theme: 'Fraîcheur', color: '#76b852', text: 'Un souffle de nouveauté et d\'énergie.' },
    { emoji: '💃', theme: 'Danse', color: '#ff512f', text: 'Bougez pour libérer vos émotions.' },
    { emoji: '🛶', theme: 'Aventure', color: '#2193b0', text: 'Partez à la découverte de nouvelles expériences.' },
    { emoji: '🍩', theme: 'Plaisir', color: '#f9d423', text: 'Un petit plaisir pour se remonter le moral.' },
    { emoji: '🎈', theme: 'Enfance', color: '#f7971e', text: 'Rappelez-vous des joies simples.' },
    { emoji: '🧩', theme: 'Réflexion', color: '#00c6ff', text: 'Résolvez vos problèmes étape par étape.' },
    { emoji: '🌙', theme: 'Calme nocturne', color: '#302b63', text: 'La nuit aide à apaiser l’esprit.' },
    { emoji: '💭', theme: 'Rêverie', color: '#ff6a00', text: 'Laissez votre esprit vagabonder librement.' },
    { emoji: '📖', theme: 'Sagesse', color: '#2c3e50', text: 'Apprenez quelque chose de nouveau aujourd’hui.' },
    { emoji: '💫', theme: 'Espoir', color: '#fceabb', text: 'Même les petites lueurs comptent.' },
    { emoji: '🛡️', theme: 'Protection', color: '#283c86', text: 'Protégez vos limites et vos proches.' },
    { emoji: '🌺', theme: 'Épanouissement', color: '#fbd786', text: 'Fleurissez malgré les obstacles.' },
    { emoji: '🦋', theme: 'Métamorphose', color: '#43cea2', text: 'Changez et évoluez à votre rythme.' },
    { emoji: '🧸', theme: 'Confort', color: '#f9d423', text: 'Un moment pour se sentir en sécurité.' },
    { emoji: '🏔️', theme: 'Défi', color: '#2c3e50', text: 'Chaque sommet est atteignable avec patience.' },
    { emoji: '🥂', theme: 'Réussite', color: '#ff9a9e', text: 'Célébrez vos accomplissements.' },
    { emoji: '🎭', theme: 'Expression', color: '#ff512f', text: 'Exprimez vos émotions sans retenue.' },
    { emoji: '💡', theme: 'Idée', color: '#fceabb', text: 'Une étincelle peut changer la journée.' },
    { emoji: '📸', theme: 'Souvenirs', color: '#ff512f', text: 'Capturez vos moments précieux.' },
    { emoji: '🧘‍♂️', theme: 'Zen', color: '#56ab2f', text: 'Respirez et trouvez l’équilibre.' },
    { emoji: '🚴‍♀️', theme: 'Énergie active', color: '#f12711', text: 'Bougez pour recharger vos batteries.' },
    { emoji: '🌌', theme: 'Inspiration', color: '#141e30', text: 'Laissez le ciel étoilé vous guider.' },
    { emoji: '🤝', theme: 'Solidarité', color: '#1f4037', text: 'Soutenez et soyez soutenu.' },
    { emoji: '📬', theme: 'Communication', color: '#00b09b', text: 'Partagez vos pensées avec les autres.' },
    { emoji: '⚡', theme: 'Pulsion', color: '#f5576c', text: 'Laissez l’énergie vous guider.' },
    { emoji: '🥳', theme: 'Joyeux', color: '#ff9a9e', text: 'Faites la fête pour vous-même !' },
    { emoji: '🤔', theme: 'Réflexion', color: '#4b6cb7', text: 'Prenez le temps d’analyser calmement.' },
    { emoji: '🪁', theme: 'Liberté', color: '#43cea2', text: 'Laissez votre esprit s’envoler.' },
    { emoji: '🏖️', theme: 'Évasion', color: '#f7971e', text: 'Changez d’air, même mentalement.' },
    { emoji: '🎶', theme: 'Musicalité', color: '#ff9a9e', text: 'Laissez les sons guider vos émotions.' },
    { emoji: '🥰', theme: 'Gratitude', color: '#ff6a00', text: 'Remerciez pour ce que vous avez aujourd’hui.' },
    { emoji: '😇', theme: 'Bienveillance', color: '#43cea2', text: 'Faites du bien autour de vous.' },
    { emoji: '😤', theme: 'Détermination', color: '#f12711', text: 'Ne lâchez rien, persévérez !' },
    { emoji: '🧚‍♀️', theme: 'Rêve', color: '#a18cd1', text: 'Croyez aux merveilles du quotidien.' },
    { emoji: '💌', theme: 'Amour', color: '#ff6f91', text: 'Envoyez un mot doux à quelqu’un.' },
    { emoji: '🪞', theme: 'Introspection', color: '#283c86', text: 'Regardez à l’intérieur pour mieux avancer.' },
    { emoji: '🎬', theme: 'Cinéma', color: '#f9d423', text: 'Plongez dans une autre réalité.' },
    { emoji: '📍', theme: 'Focus', color: '#2c3e50', text: 'Restez concentré sur vos objectifs.' },
    { emoji: '🛶', theme: 'Exploration', color: '#2193b0', text: 'Découvrez de nouveaux horizons.' },
    { emoji: '💎', theme: 'Brillance', color: '#6a11cb', text: 'Soyez fier de ce que vous êtes.' },
    { emoji: '🌈', theme: 'Positivité', color: '#43cea2', text: 'Cherchez le bon côté des choses.' },
    { emoji: '🦸‍♀️', theme: 'Pouvoir', color: '#f5576c', text: 'Chaque action compte, soyez votre héros.' },
    { emoji: '🌿', theme: 'Calme naturel', color: '#76b852', text: 'Respirez l’air frais et détendez-vous.' },
    { emoji: '📅', theme: 'Organisation', color: '#00c6ff', text: 'Planifiez pour mieux avancer.' },
    { emoji: '🗺️', theme: 'Aventure', color: '#ff512f', text: 'Chaque jour est un nouveau voyage.' },
    { emoji: '🎨', theme: 'Art', color: '#ff6a00', text: 'Exprimez vos émotions avec créativité.' },
    { emoji: '🤹‍♂️', theme: 'Polyvalence', color: '#f9d423', text: 'Multitâchez avec équilibre.' },
    { emoji: '🕊️', theme: 'Paix intérieure', color: '#c0c0c0', text: 'Trouvez la sérénité malgré le chaos.' },
    { emoji: '🏹', theme: 'Objectif', color: '#f12711', text: 'Visez juste et atteignez vos buts.' },
    { emoji: '🛍️', theme: 'Plaisir simple', color: '#ff512f', text: 'Offrez-vous un petit bonheur.' },
    { emoji: '🧗‍♂️', theme: 'Challenge', color: '#2c3e50', text: 'Relevez des défis pour grandir.' },
    { emoji: '🌟', theme: 'Émerveillement', color: '#fceabb', text: 'Admirez les beautés autour de vous.' },
    { emoji: '🕹️', theme: 'Jeu', color: '#ff512f', text: 'Amusez-vous et détendez-vous.' },
    { emoji: '🥗', theme: 'Santé', color: '#76b852', text: 'Prenez soin de votre corps.' },
    { emoji: '🛌', theme: 'Repos', color: '#6a11cb', text: 'Un moment pour récupérer et recharger.' },
    { emoji: '🌅', theme: 'Renouveau', color: '#f7971e', text: 'Chaque jour apporte une nouvelle chance.' }
];

function _getTodayMood() {
    // Pioche une phrase au hasard chaque jour
    return DAILY_MOODS[Math.floor(new Date().getTime() / (1000 * 60 * 60 * 24)) % DAILY_MOODS.length];
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