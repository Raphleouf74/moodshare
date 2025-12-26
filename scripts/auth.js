// assets/js/auth.js
// Détection simple : en dev (localhost/127.0.0.1 ou 127.0.0.1) on utilise le backend local,
// sinon on utilise l'URL de production (Render)
const API_BASE = "https://moodshare-7dd7.onrender.com";
const API = API_BASE + '/api';

// debug : vérifier à l'exécution quelle API est utilisée
console.log('API base:', API, 'hostname:', location.hostname);

export function getToken() {
  return localStorage.getItem('moodshare_token');
}

export function setToken(t) {
  localStorage.setItem('moodshare_token', t);
}

export function clearToken() {
  localStorage.removeItem('moodshare_token');
}

export async function fetchWithAuth(path, opts = {}) {
  const token = getToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Accept either a full URL or a path starting with '/'
  const url = path && (path.startsWith('http://') || path.startsWith('https://')) ? path : `${API}${path}`;

  return fetch(url, { ...opts, headers, credentials: 'include' });
}

export async function registerUser(username, password) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error(txt || 'Register failed');
  }
  const data = await res.json();
  setToken(data.token);
  return data.user;
}

export async function loginUser(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error(txt || 'Login failed');
  }
  const data = await res.json();
  setToken(data.token);
  return data.user;
}

export async function loginGuest() {
  const res = await fetch(`${API}/auth/guest`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error(txt || 'Guest failed');
  }
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
  // <-- corrige l'appel: passer un path relatif à fetchWithAuth
  const res = await fetchWithAuth('/auth/me');
  if (!res.ok) return null;
  return res.json();
}

// UI wiring (simple)
document.addEventListener('DOMContentLoaded', () => {
  const openLogin = document.getElementById('openLogin');
  const openRegister = document.getElementById('openRegister');
  const guestBtn = document.getElementById('guestLogin');
  const authModal = document.getElementById('authModal');
  const authForm = document.getElementById('authModalForm');
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
    authTitle.textContent = register ? "Inscription" : 'Connexion';
    authForm.classList.add('shown');
    authModal.classList.add('remove');
  }
  function hideModal() {
    authForm.classList.remove('shown');
    usernameInput.value = '';
    passwordInput.value = '';
  }

  openLogin.addEventListener('click', () => {
    showModal(false);
  });
  openRegister.addEventListener('click', () => {
    showModal(true);
  });
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
