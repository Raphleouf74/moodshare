// assets/js/auth.js
// Détection simple : en dev (localhost/127.0.0.1) on utilise le backend local,
// sinon on utilise l'URL de production (Render)
const API_BASE = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "http://localhost:3000"
  : "https://moodshare-7dd7.onrender.com";

async function postJSON(url, body) {
    const res = await fetch(API_BASE + url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) throw json;
    return json;
}

// fournit: registerUser, loginUser, loginGuest, logout, getCurrentUser
const API = API_BASE + '/api';

export function getToken() {
  return localStorage.getItem('moodshare_token');
}

export function setToken(t) {
  localStorage.setItem('moodshare_token', t);
}

export function clearToken() {
  localStorage.removeItem('moodshare_token');
}

export async function fetchWithAuth(url, opts = {}) {
  const token = getToken();
  const headers = opts.headers || {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
}

export async function registerUser(username, password) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error('Register failed');
  const data = await res.json();
  setToken(data.token);
  return data.user;
}

export async function loginUser(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  setToken(data.token);
  return data.user;
}

export async function loginGuest() {
  const res = await fetch(`${API}/auth/guest`, { method: 'POST' });
  if (!res.ok) throw new Error('Guest failed');
  const data = await res.json();
  setToken(data.token);
  return data.user;
}

export async function logout() {
  clearToken();
}

export async function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  const res = await fetchWithAuth(`${API}/auth/me`);
  if (!res.ok) return null;
  return res.json();
}

// UI wiring (simple)
document.addEventListener('DOMContentLoaded', () => {
  const openLogin = document.getElementById('openLogin');
  const openRegister = document.getElementById('openRegister');
  const guestBtn = document.getElementById('guestLogin');
  const authModal = document.getElementById('authModal');
  const authForm = document.getElementById('authForm');
  const authTitle = document.getElementById('authFormTitle');
  const usernameInput = document.getElementById('authUsername');
  const passwordInput = document.getElementById('authPassword');
  const cancelBtn = document.getElementById('authCancel');
  const userMenu = document.getElementById('userMenu');
  const userName = document.getElementById('userName');
  const logoutBtn = document.getElementById('logoutBtn');

  let isRegister = false;

  function showModal(register = false) {
    isRegister = register;
    authTitle.textContent = register ? "S'inscrire" : 'Connexion';
    authModal.classList.remove('hidden');
  }
  function hideModal() {
    authModal.classList.add('hidden');
    usernameInput.value = '';
    passwordInput.value = '';
  }

  openLogin.addEventListener('click', () => showModal(false));
  openRegister.addEventListener('click', () => showModal(true));
  cancelBtn.addEventListener('click', hideModal);

  authForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      if (isRegister) {
        const user = await registerUser(usernameInput.value, passwordInput.value);
        userName.textContent = user.username;
      } else {
        const user = await loginUser(usernameInput.value, passwordInput.value);
        userName.textContent = user.username;
      }
      hideModal();
      openLogin.classList.add('hidden');
      openRegister.classList.add('hidden');
      guestBtn.classList.add('hidden');
      userMenu.classList.remove('hidden');
    } catch (err) {
      alert(err.message);
    }
  });

  guestBtn.addEventListener('click', async () => {
    const user = await loginGuest();
    userName.textContent = user.username;
    openLogin.classList.add('hidden');
    openRegister.classList.add('hidden');
    guestBtn.classList.add('hidden');
    userMenu.classList.remove('hidden');
  });

  logoutBtn.addEventListener('click', async () => {
    await logout();
    userMenu.classList.add('hidden');
    openLogin.classList.remove('hidden');
    openRegister.classList.remove('hidden');
    guestBtn.classList.remove('hidden');
  });

  // When page loads, check token and UI
  (async () => {
    const user = await getCurrentUser();
    if (user) {
      userName.textContent = user.username;
      openLogin.classList.add('hidden');
      openRegister.classList.add('hidden');
      guestBtn.classList.add('hidden');
      userMenu.classList.remove('hidden');
    }
  })();
});
