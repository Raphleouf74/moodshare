// scripts/messages.js
import { fetchWithAuth, getCurrentUser } from './auth.js';

const API = 'https://moodshare-7dd7.onrender.com/api';

// Cache local (sessionStorage) pour performance
const MESSAGE_CACHE_KEY = 'moodshare_messages_cache';

function getCached() {
    try {
        const cached = sessionStorage.getItem(MESSAGE_CACHE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
}

function setCached(convId, messages) {
    try {
        const cache = getCached();
        cache[convId] = messages;
        sessionStorage.setItem(MESSAGE_CACHE_KEY, JSON.stringify(cache));
    } catch (e) { console.error('Cache error:', e); }
}

// Sync vers MongoDB (appelé avant fermeture page)
async function syncToMongo(convId, otherUserId) {
    const cache = getCached();
    const messages = cache[convId] || [];

    if (messages.length === 0) return;

    // Garder seulement les 20 derniers
    const toSync = messages.slice(-20);

    try {
        for (const msg of toSync) {
            await fetch(`${API}/conversations/${otherUserId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(msg)
            });
        }
        console.log('✅ Messages synced to MongoDB');
    } catch (err) {
        console.error('❌ Sync error:', err);
    }
}

// Sync automatique avant fermeture
window.addEventListener('beforeunload', async () => {
    const cache = getCached();
    for (const convId in cache) {
        const otherUserId = convId.split('_').find(id => id !== currentUserId);
        if (otherUserId) {
            await syncToMongo(convId, otherUserId);
        }
    }
});

// Sync toutes les 2 minutes (au cas où)
setInterval(async () => {
    const cache = getCached();
    for (const convId in cache) {
        const otherUserId = convId.split('_').find(id => id !== currentUserId);
        if (otherUserId) {
            await syncToMongo(convId, otherUserId);
        }
    }
}, 120000);

let currentUserId = null;
let currentConversation = null;

// unread counter for nav badge
let unreadMessages = 0;

function updateBadge() {
    const badge = document.getElementById('messagesBadge');
    if (!badge) return;
    badge.textContent = unreadMessages > 0 ? unreadMessages : '';
    badge.style.display = unreadMessages > 0 ? 'inline-block' : 'none';
}

function clearBadge() {
    unreadMessages = 0;
    updateBadge();
}

// Attendre que l'auth soit complètement chargée
async function initMessages() {
    const user = await getCurrentUser();
    if (!user) {
        console.log('⚠️ Messages require login');
        return;
    }

    currentUserId = user.id;
    console.log('✅ Messages init for user:', currentUserId);

    // **real-time updates via SSE**
    try {
        const streamUrl = `${API}/stream`;
        const es = new EventSource(streamUrl, { withCredentials: true });

        es.addEventListener('new_message', (e) => {
            try {
                const data = JSON.parse(e.data);
                const { conversationId, message, participants } = data;

                // only care about messages involving the current user
                if (!participants || !participants.includes(currentUserId)) return;

                // ignore our own messages (already rendered locally)
                if (message.senderId === currentUserId) return;

                // update cache
                const cache = getCached();
                const msgs = cache[conversationId] || [];
                msgs.push(message);
                setCached(conversationId, msgs);

                // if this conversation is currently open, re-render
                const openConvId = currentConversation
                    ? [currentUserId, currentConversation.otherUserId].sort().join('_')
                    : null;
                const isActive = openConvId === conversationId;

                if (isActive) {
                    renderMessages(msgs);
                } else {
                    // not currently visible → increment badge + feedback
                    unreadMessages++;
                    updateBadge();
                    if (typeof showFeedback === 'function') {
                        // show a short toast; translation key can be generic
                        showFeedback('info', `Nouveau message de ${message.senderName}`);
                    }
                }

                // refresh conversation list preview so the last message updates
                loadConversations();
            } catch (err) {
                console.warn('Invalid new_message event', err);
            }
        });

        es.addEventListener('connected', (_) => {
            /* already connected */
        });
    } catch (err) {
        console.warn('SSE for messages not supported or failed', err);
    }

    // Injecter UI
    injectMessagingUI();
}

// Init après chargement DOM + petit délai pour auth
document.addEventListener('DOMContentLoaded', () => {
    // Attendre 1s que auth.js finisse son init
    setTimeout(initMessages, 1000);
});

function injectMessagingUI() {
    // Chercher le container messages (peut être profileTab ou messagesdiv)
    let container = document.getElementById('messagesdiv');
    
    if (!container) {
        // Fallback: chercher profileTab
        container = document.getElementById('profileTab');
    }
    
    if (!container) {
        console.error('❌ Messages container not found');
        return;
    }

    // Vérifier si déjà injecté
    if (document.getElementById('messages-section')) {
        console.log('⚠️ Messages UI already injected');
        return;
    }

    // Créer section messages
    const messagesSection = document.createElement('div');
    messagesSection.id = 'messages-section';
    messagesSection.className = 'messages-container';
    messagesSection.innerHTML = `
    <div class="messages-sidebar">
      <div class="messages-sidebar-header">
        <h2>Messages</h2>
        <button id="new-conversation-btn" class="btn-icon" title="Nouvelle conversation">+</button>
      </div>
      <div id="conversations-list"></div>
    </div>
    <div class="messages-main">
      <div id="messages-empty">
        <p>Sélectionne une conversation</p>
      </div>
      <div id="messages-thread" style="display:none;">
        <div class="messages-header">
          <button id="back-to-list">←</button>
          <h3 id="current-chat-name"></h3>
        </div>
        <div id="messages-body"></div>
        <div class="messages-input-wrap">
          <input type="text" id="message-input" placeholder="Écris un message..." />
          <button id="send-message-btn">Envoyer</button>
        </div>
      </div>
    </div>
  `;

    container.appendChild(messagesSection);
    console.log('✅ Messages UI injected');

    // nav badge for unread messages (in-case nav exists already)
    const navLink = document.getElementById('messagesTab');
    if (navLink && !document.getElementById('messagesBadge')) {
        const badge = document.createElement('span');
        badge.id = 'messagesBadge';
        badge.className = 'nav-badge';
        badge.style.display = 'none';
        navLink.appendChild(badge);

        // clear unread when user clicks the tab
        navLink.addEventListener('click', () => {
            clearBadge();
        });
    }

    // Créer modal recherche utilisateurs
    createUserSearchModal();

    // Load conversations
    loadConversations();

    // Event listeners
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    document.getElementById('back-to-list').addEventListener('click', closeThread);
    document.getElementById('new-conversation-btn').addEventListener('click', openUserSearch);
}

function createUserSearchModal() {
    const modal = document.createElement('div');
    modal.id = 'user-search-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
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
    </div>
  `;

    document.body.appendChild(modal);

    // Events
    document.getElementById('close-user-search').addEventListener('click', closeUserSearch);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeUserSearch();
    });

    // Search avec debounce
    let searchTimeout;
    document.getElementById('user-search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchUsers(e.target.value), 300);
    });
}

function openUserSearch() {
    const modal = document.getElementById('user-search-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('user-search-input').focus();
    }
}

function closeUserSearch() {
    const modal = document.getElementById('user-search-modal');
    if (modal) {
        modal.style.display = 'none';
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

        if (users.length === 0) {
            results.innerHTML = '<div class="search-empty">Aucun utilisateur trouvé</div>';
            return;
        }

        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-search-item';
            div.innerHTML = `
        <div class="user-avatar">${user.displayName[0].toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">${user.displayName}</div>
          <div class="user-email">${user.email}</div>
        </div>
        <button class="btn-start-chat">Message</button>
      `;

            div.querySelector('.btn-start-chat').addEventListener('click', () => {
                closeUserSearch();
                openConversation(user._id, user.displayName);
            });

            results.appendChild(div);
        });
    } catch (err) {
        console.error('❌ Search users error:', err);
    }
}

async function loadConversations() {
    try {
        const res = await fetchWithAuth('conversations');
        if (!res.ok) return;

        const conversations = await res.json();
        const list = document.getElementById('conversations-list');
        list.innerHTML = '';

        if (conversations.length === 0) {
            list.innerHTML = '<p class="empty">Aucune conversation</p>';
            return;
        }

        conversations.forEach(conv => {
            const otherUserId = conv.participants.find(id => id !== currentUserId);
            const otherName = conv.participantNames?.[otherUserId] || 'Utilisateur';
            const lastMsg = conv.messages[conv.messages.length - 1];

            const div = document.createElement('div');
            div.className = 'conversation-item';
            div.innerHTML = `
        <div class="conv-avatar">${otherName[0].toUpperCase()}</div>
        <div class="conv-info">
          <div class="conv-name">${otherName}</div>
          <div class="conv-preview">${lastMsg?.content || 'Post partagé'}</div>
        </div>
      `;

            div.addEventListener('click', () => openConversation(otherUserId, otherName));
            list.appendChild(div);
        });
    } catch (err) {
        console.error('❌ Load conversations error:', err);
    }
}

async function openConversation(otherUserId, otherName) {
    currentConversation = { otherUserId, otherName };

    const messagesMain = document.querySelector('.messages-main');
    const messagesSidebar = document.querySelector('.messages-sidebar');
    
    document.getElementById('messages-empty').style.display = 'none';
    document.getElementById('messages-thread').style.display = 'flex';
    document.getElementById('current-chat-name').textContent = otherName;
    
    // Mobile: show main, hide sidebar
    if (messagesMain) messagesMain.classList.add('active');
    if (messagesSidebar) messagesSidebar.classList.add('hidden');
    
    // ✅ AJOUTER CETTE LIGNE:
    document.body.classList.add('messages-open');
    
    // Load messages depuis cache pour affichage rapide, puis toujours récupérer
    // depuis l'API pour s'assurer d'avoir les derniers messages entrants.
    const convId = [currentUserId, otherUserId].sort().join('_');
    const cache = getCached();

    if (cache[convId]) {
        renderMessages(cache[convId]);
    }

    try {
        const res = await fetchWithAuth(`conversations/${otherUserId}`);
        if (!res.ok) return;

        const conv = await res.json();
        setCached(convId, conv.messages || []);
        renderMessages(conv.messages || []);
    } catch (err) {
        console.error('❌ Load conversation error:', err);
    }
}

function renderMessages(messages) {
    const body = document.getElementById('messages-body');
    body.innerHTML = '';

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = msg.senderId === currentUserId ? 'message message-sent' : 'message message-received';

        if (msg.sharedPostId) {
            div.innerHTML = `
        <div class="shared-post" data-post-id="${msg.sharedPostId}">
          <p>📌 Post partagé</p>
        </div>
      `;
        } else {
            div.innerHTML = `<p>${msg.content}</p>`;
        }

        body.appendChild(div);
    });

    body.scrollTop = body.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content || !currentConversation) return;

    const { otherUserId } = currentConversation;
    const convId = [currentUserId, otherUserId].sort().join('_');

    // Ajouter au cache
    const cache = getCached();
    const messages = cache[convId] || [];
    const newMsg = {
        senderId: currentUserId,
        senderName: 'Moi',
        content,
        timestamp: new Date().toISOString()
    };

    messages.push(newMsg);
    setCached(convId, messages);
    renderMessages(messages);

    input.value = '';

    // Sync vers MongoDB (async, non bloquant)
    fetch(`${API}/conversations/${otherUserId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content })
    }).catch(err => console.error('Send error:', err));
}

function closeThread() {
    const messagesMain = document.querySelector('.messages-main');
    const messagesSidebar = document.querySelector('.messages-sidebar');
    
    document.getElementById('messages-thread').style.display = 'none';
    document.getElementById('messages-empty').style.display = 'flex';
    currentConversation = null;
    
    // Mobile: hide main, show sidebar
    if (messagesMain) messagesMain.classList.remove('active');
    if (messagesSidebar) messagesSidebar.classList.remove('hidden');
    
    // ✅ AJOUTER CETTE LIGNE:
    document.body.classList.remove('messages-open');
}

// Fonction pour partager un post dans une conversation
window.sharePostInMessage = async function (postId, otherUserId) {
    if (!currentUserId) {
        alert('Connexion requise');
        return;
    }

    try {
        const res = await fetch(`${API}/conversations/${otherUserId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sharedPostId: postId })
        });

        if (res.ok) {
            alert('Post partagé !');
        }
    } catch (err) {
        console.error('Share error:', err);
    }
};