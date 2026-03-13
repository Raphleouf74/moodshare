// assets/js/profile.js
import { fetchWithAuth } from './auth.js';
const API = 'https://moodshare-7dd7.onrender.com/api';

export async function initProfile() {
  await new Promise(r => setTimeout(r, 800)); // Attendre auth
  renderOwnProfile();
  document.addEventListener('userLoggedIn', renderOwnProfile);
}

async function renderOwnProfile() {
  const tab = document.getElementById('profileTab');
  if (!tab) return;

  try {
    const meRes = await fetchWithAuth('auth/me');
    if (!meRes.ok) throw new Error();
    const me = await meRes.json();
    const uid = me.user?.id || me.id || me._id;

    const pRes = await fetch(`${API}/social/profile/${uid}`, { credentials: 'include' });
    const data = await pRes.json();

    tab.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${data.user.avatar || '👤'}</div>
        <h2>${esc(data.user.displayName)}</h2>
        <p class="bio">${esc(data.user.bio || '')}</p>
        <div class="stats">
          <div><strong>${data.user.postsCount || 0}</strong>Posts</div>
          <div class="stat-click" data-a="followers" data-u="${uid}"><strong>${data.user.followersCount || 0}</strong>Followers</div>
          <div class="stat-click" data-a="following" data-u="${uid}"><strong>${data.user.followingCount || 0}</strong>Following</div>
        </div>
        <button id="editBtn">✏️ Modifier</button>
        <button id="favBtn">⭐ Favoris</button>
      </div>
      <div class="posts-section">
        <h3>Mes posts</h3>
        <div class="posts-grid" id="pGrid"></div>
      </div>
    `;

    const grid = tab.querySelector('#pGrid');
    data.posts.forEach(p => grid.appendChild(postCard(p)));

    tab.querySelector('#editBtn').onclick = editProfile;
    tab.querySelector('#favBtn').onclick = showFavs;
    tab.querySelectorAll('.stat-click').forEach(el => el.onclick = () => {
      if (el.dataset.a === 'followers') showFollowers(el.dataset.u);
      else showFollowing(el.dataset.u);
    });
  } catch { tab.innerHTML = '<p>Connectez-vous</p>'; }
}

export async function viewProfile(uid) {
  const res = await fetch(`${API}/social/profile/${uid}`, { credentials: 'include' });
  const d = await res.json();
  const m = showModal(`
    <div class="profile-avatar">${d.user.avatar || '👤'}</div>
    <h2>${esc(d.user.displayName)}</h2>
    <p>${esc(d.user.bio || '')}</p>
    <div class="stats">
      <div><strong>${d.user.postsCount || 0}</strong>Posts</div>
      <div><strong>${d.user.followersCount || 0}</strong>Followers</div>
      <div><strong>${d.user.followingCount || 0}</strong>Following</div>
    </div>
    ${!d.user.isOwnProfile ? `<button class="follow-btn ${d.user.isFollowing ? 'following' : ''}" data-u="${uid}">${d.user.isFollowing ? '✓ Suivi' : '+ Suivre'}</button>` : ''}
    <div class="posts-grid" id="mGrid"></div>
  `);
  const grid = m.querySelector('#mGrid');
  d.posts.slice(0, 10).forEach(p => grid.appendChild(postCard(p)));
  const fb = m.querySelector('.follow-btn');
  if (fb) fb.onclick = () => toggleFollow(fb);
}

async function editProfile() {
  const meRes = await fetchWithAuth('auth/me');
  const me = await meRes.json();
  const u = me.user || me;

  const m = showModal(`
    <h2>Modifier profil</h2>
    <form id="editForm">
      <label>Nom<input id="eName" value="${esc(u.displayName)}" maxlength="50"></label>
      <label>Avatar<input id="eAvatar" value="${u.avatar || '👤'}" maxlength="10"></label>
      <label>Bio<textarea id="eBio" maxlength="200">${esc(u.bio || '')}</textarea></label>
      <button type="submit">Enregistrer</button>
    </form>
  `);

  m.querySelector('#editForm').onsubmit = async e => {
    e.preventDefault();
    await fetch(`${API}/social/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        displayName: document.getElementById('eName').value,
        avatar: document.getElementById('eAvatar').value,
        bio: document.getElementById('eBio').value
      })
    });
    m.remove();
    renderOwnProfile();
  };
}

async function toggleFollow(btn) {
  const uid = btn.dataset.u;
  const isF = btn.classList.contains('following');
  const res = await fetch(`${API}/social/${isF ? 'unfollow' : 'follow'}/${uid}`, {
    method: 'POST',
    credentials: 'include'
  });
  if (res.ok) {
    btn.classList.toggle('following');
    btn.textContent = isF ? '+ Suivre' : '✓ Suivi';
  }
}

async function showFollowers(uid) {
  const res = await fetch(`${API}/social/followers/${uid}`, { credentials: 'include' });
  const d = await res.json();
  showUserList('Followers', d.followers);
}

async function showFollowing(uid) {
  const res = await fetch(`${API}/social/following/${uid}`, { credentials: 'include' });
  const d = await res.json();
  showUserList('Following', d.following);
}

function showUserList(title, users) {
  const m = showModal(`<h2>${title}</h2><div class="user-list"></div>`);
  const list = m.querySelector('.user-list');
  users.forEach(u => {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.innerHTML = `<span>${u.avatar || '👤'}</span><strong>${esc(u.displayName)}</strong><button data-u="${u._id}">Voir</button>`;
    card.querySelector('button').onclick = () => { m.remove(); viewProfile(u._id); };
    list.appendChild(card);
  });
}

async function showFavs() {
  const res = await fetch(`${API}/social/favorites`, { credentials: 'include' });
  const d = await res.json();
  const m = showModal('<h2>⭐ Favoris</h2><div class="posts-grid" id="fGrid"></div>');
  const grid = m.querySelector('#fGrid');
  d.posts.forEach(p => grid.appendChild(postCard(p)));
}

function postCard(p) {
  const c = document.createElement('div');
  c.className = 'post-card';
  c.style.background = p.color || '#111';
  c.innerHTML = `<div class="emoji">${p.emoji || '💭'}</div><p>${esc(p.text || '')}</p><div class="footer"><span>${p.date || new Date(p.createdAt).toLocaleDateString('fr')}</span><span>❤️ ${p.likes || 0}</span></div>`;
  return c;
}

function showModal(html) {
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.innerHTML = `<div class="modal-content"><button class="modal-close">×</button>${html}</div>`;
  document.body.appendChild(m);
  m.querySelector('.modal-close').onclick = () => m.remove();
  m.onclick = e => { if (e.target === m) m.remove(); };
  return m;
}

function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initProfile);
else setTimeout(initProfile, 500);