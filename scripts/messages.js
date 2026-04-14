// scripts/messages.js
import { fetchWithAuth, getCurrentUser } from './auth.js';
import {
    ensureKeyPair,
    registerPublicKey,
    fetchPublicKey,
    getSharedKey,
    encryptMessage,
    decryptMessage,
    invalidatePubKeyCache
} from './crypto-e2e.js';

const API = 'https://moodshare-7dd7.onrender.com/api';
const MESSAGE_CACHE_KEY = 'moodshare_messages_cache';

// ─── Cache local ─────────────────────────────────────────────
function getCached() {
    try { return JSON.parse(sessionStorage.getItem(MESSAGE_CACHE_KEY) || '{}'); } catch { return {}; }
}
function setCached(convId, messages) {
    try {
        const c = getCached(); c[convId] = messages;
        sessionStorage.setItem(MESSAGE_CACHE_KEY, JSON.stringify(c));
    } catch (e) { console.error('Cache error:', e); }
}

let currentUserId = null;
let currentConversation = null;
let _myPrivateKey = null;
let _myPublicKeyB64 = null;
let unreadMessages = 0;
let _e2eReady = false; // true si les clés sont enregistrées sur le serveur

function updateBadge() {
    const badge = document.getElementById('messagesBadge');
    if (!badge) return;
    badge.textContent = unreadMessages > 0 ? unreadMessages : '';
    badge.style.display = unreadMessages > 0 ? 'inline-block' : 'none';
}
function clearBadge() { unreadMessages = 0; updateBadge(); }

// ─── Init E2E avec retry ──────────────────────────────────────
async function _initE2E(userId) {
    try {
        const { privateKey, publicKeyB64 } = await ensureKeyPair(userId);
        _myPrivateKey = privateKey;
        _myPublicKeyB64 = publicKeyB64;

        // Vérifier si notre clé est déjà sur le serveur
        const existing = await fetchPublicKey(userId);
        if (existing) {
            console.log('🔐 Clés E2E prêtes (clé déjà enregistrée)');
            _e2eReady = true;
            return;
        }

        // Pas encore enregistrée → tenter l'enregistrement
        console.log('🔐 Enregistrement de la clé E2E…');
        const ok = await registerPublicKey(publicKeyB64, 5);
        _e2eReady = ok;

        if (ok) {
            // Invalider le cache pour forcer re-fetch au prochain accès
            invalidatePubKeyCache(userId);
            console.log('🔐 Clés E2E prêtes (nouvelle clé enregistrée)');
        } else {
            console.warn('⚠️  E2E: clé non enregistrée — messages en clair');
            // Réessayer en arrière-plan dans 30s
            setTimeout(() => _retryE2ERegistration(userId, publicKeyB64), 30_000);
        }
    } catch (err) {
        console.error('❌ E2E init error:', err);
    }
}

async function _retryE2ERegistration(userId, publicKeyB64) {
    if (_e2eReady) return;
    console.log('🔁 E2E retry registration…');
    const ok = await registerPublicKey(publicKeyB64, 3);
    if (ok) {
        _e2eReady = true;
        invalidatePubKeyCache(userId);
        console.log('✅ E2E clé enregistrée après retry');
        // Mettre à jour le badge dans la conv ouverte
        if (currentConversation) _showE2EBadge(currentConversation.otherUserId);
    } else {
        setTimeout(() => _retryE2ERegistration(userId, publicKeyB64), 60_000);
    }
}

// ─── Init messages ────────────────────────────────────────────
async function initMessages() {
    const user = await getCurrentUser();
    if (!user) { console.log('⚠️ Messages require login'); return; }

    currentUserId = user.id;
    if (window._messagesInitialized) return;
    window._messagesInitialized = true;

    // Init E2E (non bloquant)
    _initE2E(currentUserId);

    // SSE pour messages temps réel
    try {
        const es = new EventSource(`${API}/stream`, { withCredentials: true });
        es.addEventListener('new_message', async (e) => {
            try {
                const data = JSON.parse(e.data);
                const { conversationId, message, participants } = data;
                if (!participants?.includes(currentUserId)) return;
                if (message.senderId === currentUserId) return;

                const decrypted = await _tryDecrypt(message, conversationId);
                const displayMsg = { ...message, content: decrypted ?? message.content, _wasEncrypted: !!decrypted };

                const cache = getCached();
                const msgs = cache[conversationId] || [];
                msgs.push(displayMsg);
                setCached(conversationId, msgs);

                const openConvId = currentConversation
                    ? [currentUserId, currentConversation.otherUserId].sort().join('_')
                    : null;

                if (openConvId === conversationId) {
                    renderMessages(msgs);
                } else {
                    unreadMessages++;
                    updateBadge();
                    if (typeof showFeedback === 'function') {
                        showFeedback('info', `Nouveau message de ${message.senderName}`);
                    }
                }
                loadConversations();
            } catch (err) { console.warn('Invalid new_message event', err); }
        });
    } catch (err) { console.warn('SSE for messages failed', err); }

    injectMessagingUI();
}

document.addEventListener('userLoggedIn', initMessages);
document.addEventListener('DOMContentLoaded', () => setTimeout(initMessages, 500));

// ─── UI injection ─────────────────────────────────────────────
function injectMessagingUI() {
    const container = document.getElementById('messagesdiv') || document.getElementById('profileTab');
    const messagesSection = document.getElementById('messages-section');
    if (container && messagesSection) container.appendChild(messagesSection);

    const navLink = document.getElementById('messagesTab');
    if (navLink && !document.getElementById('messagesBadge')) {
        const badge = document.createElement('span');
        badge.id = 'messagesBadge'; badge.className = 'nav-badge'; badge.style.display = 'none';
        navLink.appendChild(badge);
        navLink.addEventListener('click', clearBadge);
    }

    createUserSearchModal();
    loadConversations();

    document.getElementById('send-message-btn')?.addEventListener('click', sendMessage);
    document.getElementById('message-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    document.getElementById('back-to-list')?.addEventListener('click', closeThread);
    document.getElementById('new-conversation-btn')?.addEventListener('click', openUserSearch);
}

// ─── User search ──────────────────────────────────────────────
function createUserSearchModal() {
    if (document.getElementById('user-search-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'user-search-modal'; modal.className = 'modal-overlay'; modal.style.display = 'none';
    modal.innerHTML = `
    <div class="modal-panel user-search-panel">
      <div class="modal-header">
        <h3>Nouvelle conversation</h3>
        <button class="modal-close" id="close-user-search">×</button>
      </div>
      <div class="search-input-wrap">
        <input type="text" id="user-search-input" placeholder="Rechercher un utilisateur..." autofocus />
      </div>
      <div id="user-search-results"></div>
    </div>`;
    document.body.appendChild(modal);

    document.getElementById('close-user-search').addEventListener('click', closeUserSearch);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeUserSearch(); });

    let st;
    document.getElementById('user-search-input').addEventListener('input', (e) => {
        clearTimeout(st);
        st = setTimeout(() => searchUsers(e.target.value), 300);
    });
}

function openUserSearch() {
    const m = document.getElementById('user-search-modal');
    if (m) { m.style.display = 'flex'; document.getElementById('user-search-input').focus(); }
}
function closeUserSearch() {
    const m = document.getElementById('user-search-modal');
    if (m) {
        m.style.display = 'none';
        document.getElementById('user-search-input').value = '';
        document.getElementById('user-search-results').innerHTML = '';
    }
}

async function searchUsers(query) {
    if (!query || query.length < 2) {
        document.getElementById('user-search-results').innerHTML = '';
        return;
    }
    try {
        const res = await fetchWithAuth(`users/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const users = await res.json();
        const results = document.getElementById('user-search-results');
        results.innerHTML = '';
        if (!users.length) { results.innerHTML = '<div class="search-empty">Aucun utilisateur trouvé</div>'; return; }
        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-search-item';
            div.innerHTML = `
                <div class="user-avatar">${user.displayName[0].toUpperCase()}</div>
                <div class="user-info"><div class="user-name">${user.displayName}</div></div>
                <button class="btn-start-chat">Message</button>`;
            div.querySelector('.btn-start-chat').addEventListener('click', () => {
                closeUserSearch();
                openConversation(user._id, user.displayName);
            });
            results.appendChild(div);
        });
    } catch (err) { console.error('❌ Search users error:', err); }
}

// ─── Conversations ────────────────────────────────────────────
async function loadConversations() {
    try {
        const res = await fetchWithAuth('conversations');
        if (!res.ok) return;
        const conversations = await res.json();
        const list = document.getElementById('conversations-list');
        if (!list) return;
        list.innerHTML = '';

        if (!conversations.length) {
            list.innerHTML = '<p class="empty">Aucune conversation</p>';
            return;
        }

        for (const conv of conversations) {
            const otherUserId = conv.participants.find(id => id !== currentUserId);
            const otherName = conv.participantNames?.[otherUserId] || 'Utilisateur';
            const lastMsg = conv.messages?.[conv.messages.length - 1];

            let preview = 'Post partagé';
            if (lastMsg?.content) {
                if (lastMsg.encrypted) {
                    // Tenter déchiffrement pour la preview
                    const convId = [currentUserId, otherUserId].sort().join('_');
                    const plain = await _tryDecrypt(lastMsg, convId);
                    preview = plain ? plain.substring(0, 60) : '🔒 Message chiffré';
                } else {
                    preview = lastMsg.content.substring(0, 60);
                }
            }

            const div = document.createElement('div');
            div.className = 'conversation-item';
            div.innerHTML = `
                <div class="conv-avatar">${otherName[0].toUpperCase()}</div>
                <div class="conv-info">
                    <div class="conv-name">${otherName}</div>
                    <div class="conv-preview">${preview}</div>
                </div>`;
            div.addEventListener('click', () => openConversation(otherUserId, otherName));
            list.appendChild(div);
        }
    } catch (err) { console.error('❌ Load conversations error:', err); }
}

// Afficher "non connecté" si pas de userId
if (!currentUserId) {
    const el = document.getElementById('conversations-list');
    if (el) el.innerHTML = '<p class="empty">Vous n\'êtes pas connecté(e), connectez vous afin de discuter !</p>';
}

async function openConversation(otherUserId, otherName) {
    currentConversation = { otherUserId, otherName };

    const messagesMain = document.querySelector('.messages-main');
    const messagesSidebar = document.querySelector('.messages-sidebar');

    document.getElementById('messages-empty').style.display = 'none';
    document.getElementById('messages-thread').style.display = 'flex';
    document.getElementById('current-chat-name').textContent = otherName;

    if (messagesMain) messagesMain.classList.add('active');
    if (messagesSidebar) messagesSidebar.classList.add('hidden');
    document.body.classList.add('messages-open');

    // Badge E2E (async, non bloquant)
    _showE2EBadge(otherUserId);

    const convId = [currentUserId, otherUserId].sort().join('_');
    const cache = getCached();
    if (cache[convId]) renderMessages(cache[convId]);

    try {
        const res = await fetchWithAuth(`conversations/${otherUserId}`);
        if (!res.ok) return;
        const conv = await res.json();
        const msgs = conv.messages || [];

        // Déchiffrer en parallèle
        const decryptedMsgs = await Promise.all(msgs.map(async (msg) => {
            if (!msg.content || msg.sharedPostId || !msg.encrypted) return msg;
            const plain = await _tryDecrypt(msg, convId);
            return { ...msg, content: plain ?? msg.content, _wasEncrypted: plain !== null };
        }));

        setCached(convId, decryptedMsgs);
        renderMessages(decryptedMsgs);
    } catch (err) { console.error('❌ Load conversation error:', err); }
}

// ─── Rendu des messages ───────────────────────────────────────
function renderMessages(messages) {
    const body = document.getElementById('messages-body');
    if (!body) return;
    body.innerHTML = '';

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = msg.senderId === currentUserId ? 'message message-sent' : 'message message-received';

        if (msg.sharedPostId) {
            div.innerHTML = `<div class="shared-post" data-post-id="${msg.sharedPostId}"><p>📌 Post partagé</p></div>`;
        } else {
            const p = document.createElement('p');
            p.textContent = msg.content || '';
            // Petit indicateur discret si message chiffré
            if (msg._wasEncrypted) {
                const lock = document.createElement('span');
                lock.textContent = ' 🔒';
                lock.style.cssText = 'font-size:0.65em;opacity:0.5;';
                p.appendChild(lock);
            }
            div.appendChild(p);
        }

        body.appendChild(div);
    });

    body.scrollTop = body.scrollHeight;
}

// ─── Envoi d'un message ───────────────────────────────────────
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content || !currentConversation) return;

    const { otherUserId } = currentConversation;
    const convId = [currentUserId, otherUserId].sort().join('_');

    // Tenter chiffrement
    let toSend = content;
    let isEncrypted = false;

    if (_myPrivateKey && _e2eReady) {
        try {
            const theirKey = await fetchPublicKey(otherUserId);
            if (theirKey) {
                const aesKey = await getSharedKey(_myPrivateKey, theirKey, convId);
                toSend = await encryptMessage(content, aesKey);
                isEncrypted = true;
            }
        } catch (err) {
            console.warn('⚠️  Chiffrement échoué, envoi en clair:', err.message);
        }
    }

    // Affichage optimiste (clair)
    const cache = getCached();
    const messages = cache[convId] || [];
    const newMsg = {
        senderId: currentUserId,
        senderName: 'Moi',
        content,
        _wasEncrypted: isEncrypted,
        timestamp: new Date().toISOString()
    };
    messages.push(newMsg);
    setCached(convId, messages);
    renderMessages(messages);
    input.value = '';

    // Envoi au serveur (payload chiffré)
    fetch(`${API}/conversations/${otherUserId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: toSend, encrypted: isEncrypted })
    }).catch(err => console.error('Send error:', err));
}

function closeThread() {
    const messagesMain = document.querySelector('.messages-main');
    const messagesSidebar = document.querySelector('.messages-sidebar');
    document.getElementById('messages-thread').style.display = 'none';
    document.getElementById('messages-empty').style.display = 'flex';
    currentConversation = null;
    if (messagesMain) messagesMain.classList.remove('active');
    if (messagesSidebar) messagesSidebar.classList.remove('hidden');
    document.body.classList.remove('messages-open');
    document.getElementById('e2e-badge')?.remove();
}

// ─── Badge E2E ────────────────────────────────────────────────
async function _showE2EBadge(otherUserId) {
    document.getElementById('e2e-badge')?.remove();
    const header = document.getElementById('current-chat-name');
    if (!header) return;

    const badge = document.createElement('span');
    badge.id = 'e2e-badge';
    badge.style.cssText = `
        display:inline-flex;align-items:center;gap:4px;
        font-size:0.68rem;font-weight:700;letter-spacing:0.06em;
        padding:2px 8px;border-radius:12px;margin-left:10px;
        vertical-align:middle;cursor:default;`;

    const theirKey = _myPrivateKey && _e2eReady ? await fetchPublicKey(otherUserId) : null;

    if (_myPrivateKey && _e2eReady && theirKey) {
        badge.textContent = '🔒 Chiffré E2E';
        badge.style.background = 'rgba(16,185,129,0.15)';
        badge.style.color = '#10b981';
        badge.style.border = '1px solid rgba(16,185,129,0.3)';
        badge.title = 'Messages chiffrés de bout en bout. Le serveur ne peut pas les lire.';
    } else {
        badge.textContent = _e2eReady ? '⚠️ Non chiffré' : '🔓 E2E en attente';
        badge.style.background = 'rgba(245,158,11,0.12)';
        badge.style.color = '#f59e0b';
        badge.style.border = '1px solid rgba(245,158,11,0.3)';
        badge.title = !_e2eReady
            ? 'Vos clés E2E sont en cours d\'enregistrement.'
            : 'Votre interlocuteur n\'a pas encore de clé E2E.';
    }

    header.insertAdjacentElement('afterend', badge);
}

// ─── Déchiffrement gracieux ───────────────────────────────────
async function _tryDecrypt(msg, convId) {
    if (!msg.content || !msg.encrypted || !_myPrivateKey) return null;
    try {
        const theirKey = await fetchPublicKey(msg.senderId);
        if (!theirKey) return null;
        const aesKey = await getSharedKey(_myPrivateKey, theirKey, convId);
        return await decryptMessage(msg.content, aesKey);
    } catch {
        return null;
    }
}

// ─── Partage de post ──────────────────────────────────────────
window.sharePostInMessage = async function (postId, otherUserId) {
    if (!currentUserId) { alert('Connexion requise'); return; }
    try {
        const res = await fetch(`${API}/conversations/${otherUserId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sharedPostId: postId })
        });
        if (res.ok) alert('Post partagé !');
    } catch (err) { console.error('Share error:', err); }
};