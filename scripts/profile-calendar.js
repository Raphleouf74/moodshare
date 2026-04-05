// ============================================================
// profile-calendar.js — Calendrier des moods (heatmap)
// Affiche 12 semaines d'activité dans l'onglet profil,
// avec couleur dominante de chaque post.
// API : GET /api/users/:id/posts  ou  /api/posts?userId=:id
// ============================================================

const API = 'https://moodshare-7dd7.onrender.com/api';

// ─── Point d'entrée ──────────────────────────────────────────
export async function initMoodCalendar(userId) {
    // Trouver le bon container dans le profil
    const container = document.getElementById('accountinfo') ||
                      document.getElementById('profileTab');
    if (!container || document.getElementById('calendar')) return;

    const posts = await _fetchUserPosts(userId);
    _renderCalendar(container, posts);
}

// ─── Chargement posts utilisateur ───────────────────────────
async function _fetchUserPosts(userId) {
    if (!userId) {
        // Essayer de récupérer depuis le DOM existant (posts affichés)
        return _extractPostsFromDOM();
    }
    try {
        const res = await fetch(`${API}/users/${userId}/posts`);
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : (data.posts || []);
        }
    } catch {}
    return _extractPostsFromDOM();
}

function _extractPostsFromDOM() {
    const posts = [];
    document.querySelectorAll('.post[data-id]').forEach(el => {
        const dateText = el.querySelector('.postdate')?.textContent?.replace('Créé le ', '') || '';
        const color = el.querySelector('.post-content')?.style.background || '#667eea';
        const emoji = el.querySelector('.post-emoji')?.textContent || '';
        const text = el.querySelector('.post-text')?.textContent || '';
        const id = el.dataset.id;
        if (dateText) posts.push({ id, color, emoji, text, createdAt: dateText });
    });
    return posts;
}

// ─── Rendu calendrier ────────────────────────────────────────
function _renderCalendar(container, posts) {
    // Grouper posts par date (YYYY-MM-DD)
    const byDate = {};
    posts.forEach(p => {
        const d = _toDateKey(p.createdAt);
        if (!d) return;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(p);
    });

    // Générer les 16 dernières semaines (112 jours)
    const WEEKS = 16;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Reculer jusqu'au lundi précédent
    const start = new Date(today);
    start.setDate(start.getDate() - (WEEKS * 7));
    // Aligner sur lundi
    const day0 = start.getDay();
    start.setDate(start.getDate() - (day0 === 0 ? 6 : day0 - 1));

    const wrapper = document.createElement('div');
    wrapper.id = 'calendar';
    wrapper.className = 'cal';

    const title = document.createElement('h3');
    title.className = 'cal__title';
    title.innerHTML = `📅 Activité des ${WEEKS} dernières semaines <span class="cal__count">${posts.length} posts</span>`;
    wrapper.appendChild(title);

    const scroll = document.createElement('div');
    scroll.className = 'cal__scroll';

    // Jours de semaine (Mon → Sun)
    const labels = document.createElement('div');
    labels.className = 'cal__labels';
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(l => {
        const span = document.createElement('span'); span.textContent = l; labels.appendChild(span);
    });
    scroll.appendChild(labels);

    const grid = document.createElement('div');
    grid.className = 'cal__grid';

    // Tooltips container
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'cal__tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);

    for (let w = 0; w < WEEKS; w++) {
        const col = document.createElement('div');
        col.className = 'cal__col';

        // Mois label si premier jour du mois dans cette semaine
        const weekStart = new Date(start);
        weekStart.setDate(start.getDate() + w * 7);
        const monthLabel = document.createElement('div');
        monthLabel.className = 'cal__month';
        const isFirstOfMonth = weekStart.getDate() <= 7;
        monthLabel.textContent = isFirstOfMonth
            ? weekStart.toLocaleDateString('fr-FR', { month: 'short' })
            : '';
        col.appendChild(monthLabel);

        for (let d = 0; d < 7; d++) {
            const date = new Date(start);
            date.setDate(start.getDate() + w * 7 + d);
            if (date > today) {
                const empty = document.createElement('div');
                empty.className = 'cal__cell cal__cell--future';
                col.appendChild(empty);
                continue;
            }

            const key = _dateToKey(date);
            const dayPosts = byDate[key] || [];
            const count = dayPosts.length;

            const cell = document.createElement('div');
            cell.className = 'cal__cell';
            cell.dataset.date = key;
            cell.dataset.count = count;

            if (count > 0) {
                // Couleur dominante du jour
                const dominantColor = _getDominantColor(dayPosts);
                cell.style.background = dominantColor;
                cell.style.opacity = Math.min(0.4 + count * 0.2, 1);
                cell.classList.add('cal__cell--active');

                // Tooltip
                cell.addEventListener('mouseenter', (e) => {
                    const label = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                    const emojis = dayPosts.map(p => p.emoji || '📝').slice(0, 5).join(' ');
                    const preview = dayPosts[0]?.text?.substring(0, 60) || '';
                    tooltipEl.innerHTML = `
                        <strong>${label}</strong> — ${count} post${count > 1 ? 's' : ''}<br>
                        <span style="font-size:1.1em">${emojis}</span><br>
                        <em>${preview}${preview.length >= 60 ? '…' : ''}</em>
                    `;
                    tooltipEl.style.display = 'block';
                    const rect = cell.getBoundingClientRect();
                    tooltipEl.style.left = (rect.left + window.scrollX - 60) + 'px';
                    tooltipEl.style.top  = (rect.top  + window.scrollY - tooltipEl.offsetHeight - 8) + 'px';
                });
                cell.addEventListener('mouseleave', () => {
                    tooltipEl.style.display = 'none';
                });
            }

            // Aujourd'hui
            if (key === _dateToKey(today)) cell.classList.add('cal__cell--today');

            col.appendChild(cell);
        }
        grid.appendChild(col);
    }

    scroll.appendChild(grid);
    wrapper.appendChild(scroll);

    // Légende
    const legend = document.createElement('div');
    legend.className = 'cal__legend';
    legend.innerHTML = `
        <span>Moins</span>
        <div class="cal__leg-cells">
            ${[0.2, 0.4, 0.6, 0.8, 1].map(o =>
                `<div class="cal__leg-cell" style="background:#667eea;opacity:${o}"></div>`
            ).join('')}
        </div>
        <span>Plus</span>
    `;
    wrapper.appendChild(legend);

    // Insérer dans le profil
    container.appendChild(wrapper);
}

// ─── Utilitaires ─────────────────────────────────────────────
function _toDateKey(dateStr) {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (isNaN(d)) return null;
        return _dateToKey(d);
    } catch { return null; }
}

function _dateToKey(d) {
    return d.toISOString().slice(0, 10);
}

function _getDominantColor(posts) {
    // Utiliser la couleur du dernier post du jour (ou dégradé si plusieurs)
    const colors = posts.map(p => p.color || '#667eea').filter(Boolean);
    if (colors.length === 0) return '#667eea';
    if (colors.length === 1) return colors[0];

    // Retourner la couleur la plus fréquente
    const freq = {};
    colors.forEach(c => { freq[c] = (freq[c] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}