// ============================================================
// crypto-e2e.js — Chiffrement de bout en bout (E2EE)
// Algorithme : ECDH P-256 + HKDF + AES-GCM 256-bit
// Les clés privées ne quittent JAMAIS l'appareil (IndexedDB).
// Le serveur ne stocke que les clés publiques et du ciphertext.
// ============================================================

const API = 'https://moodshare-7dd7.onrender.com/api';
const DB_NAME = 'moodshare_e2e';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

// ─── IndexedDB ──────────────────────────────────────────────

function _openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function _dbGet(key) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = (e) => resolve(e.target.result?.value ?? null);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function _dbSet(key, value) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ id: key, value });
        tx.oncomplete = resolve;
        tx.onerror = (e) => reject(e.target.error);
    });
}

// ─── Génération de la paire de clés ─────────────────────────

/**
 * Génère une paire ECDH P-256 et la persiste localement.
 * Ne regénère pas si une paire existe déjà.
 * Retourne la clé publique en base64 (à envoyer au serveur).
 */
export async function ensureKeyPair(userId) {
    const stored = await _dbGet(`keypair_${userId}`);
    if (stored) {
        // Importer depuis le stockage
        const { publicKeyJwk, privateKeyJwk } = stored;
        const publicKey = await crypto.subtle.importKey('jwk', publicKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
        const privateKey = await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
        const pubB64 = _jwkToB64(publicKeyJwk);
        return { publicKey, privateKey, publicKeyB64: pubB64 };
    }

    // Générer une nouvelle paire
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true, // exportable
        ['deriveKey', 'deriveBits']
    );

    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    await _dbSet(`keypair_${userId}`, { publicKeyJwk, privateKeyJwk });

    const pubB64 = _jwkToB64(publicKeyJwk);
    return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey, publicKeyB64: pubB64 };
}

// ─── Enregistrement de la clé publique sur le serveur ───────

/**
 * Dépose la clé publique de l'utilisateur sur le serveur.
 * Appelé une seule fois au login / si pas encore enregistrée.
 */
export async function registerPublicKey(publicKeyB64) {
    const token = localStorage.getItem('moodshare_token');
    if (!token) return false;
    try {
        const res = await fetch(`${API}/users/public-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include',
            body: JSON.stringify({ publicKey: publicKeyB64 })
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ─── Récupération de la clé publique d'un autre user ────────

/**
 * Récupère la clé publique d'un utilisateur depuis le serveur.
 * Retourne un CryptoKey prêt à l'emploi.
 */
export async function fetchPublicKey(userId) {
    const res = await fetch(`${API}/users/${userId}/public-key`, {
        credentials: 'include'
    });
    if (!res.ok) return null;
    const { publicKey: b64 } = await res.json();
    if (!b64) return null;
    return _importPublicKeyB64(b64);
}

// ─── Dérivation de la clé partagée (ECDH + HKDF) ────────────

/**
 * Dérive une clé AES-GCM 256 bits à partir de la clé privée locale
 * et de la clé publique du destinataire. Résultat mis en cache mémoire.
 */
const _sharedKeyCache = new Map();

export async function getSharedKey(myPrivateKey, theirPublicKey, convId) {
    if (_sharedKeyCache.has(convId)) return _sharedKeyCache.get(convId);

    // 1. ECDH : dériver les bits communs
    const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: theirPublicKey },
        myPrivateKey,
        256
    );

    // 2. HKDF : dériver une clé AES-GCM depuis les bits partagés
    const hkdfKey = await crypto.subtle.importKey(
        'raw', sharedBits,
        { name: 'HKDF' },
        false,
        ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new TextEncoder().encode('moodshare-e2e-v1'),
            info: new TextEncoder().encode(convId)
        },
        hkdfKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );

    _sharedKeyCache.set(convId, aesKey);
    return aesKey;
}

// ─── Chiffrement / Déchiffrement ────────────────────────────

/**
 * Chiffre un message texte.
 * Retourne une chaîne base64 : "<iv_b64>.<ciphertext_b64>"
 */
export async function encryptMessage(plaintext, aesKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits pour AES-GCM
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encoded
    );

    const ivB64 = _ab2b64(iv.buffer);
    const ctB64 = _ab2b64(ciphertext);
    return `${ivB64}.${ctB64}`;
}

/**
 * Déchiffre un message chiffré.
 * Accepte le format "<iv_b64>.<ciphertext_b64>".
 * Retourne le texte clair, ou null si déchiffrement impossible.
 */
export async function decryptMessage(encryptedPayload, aesKey) {
    try {
        const [ivB64, ctB64] = encryptedPayload.split('.');
        if (!ivB64 || !ctB64) return null;

        const iv = _b642ab(ivB64);
        const ciphertext = _b642ab(ctB64);

        const plainBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            aesKey,
            ciphertext
        );

        return new TextDecoder().decode(plainBuffer);
    } catch {
        // Peut arriver pour les messages anciens non-chiffrés
        return null;
    }
}

// ─── Utilitaires ─────────────────────────────────────────────

function _ab2b64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function _b642ab(b64) {
    const binary = atob(b64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    return buffer;
}

function _jwkToB64(jwk) {
    return btoa(JSON.stringify(jwk));
}

async function _importPublicKeyB64(b64) {
    try {
        const jwk = JSON.parse(atob(b64));
        return await crypto.subtle.importKey(
            'jwk', jwk,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            []
        );
    } catch {
        return null;
    }
}