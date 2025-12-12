const fs = require('fs').promises;
const path = require('path');
const usersPath = path.join(__dirname, '..', '..', 'users.json');

function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function readUsers() {
    const raw = await fs.readFile(usersPath, 'utf8');
    return JSON.parse(raw || '[]');
}

async function writeUsers(users) {
    await fs.writeFile(usersPath, JSON.stringify(users, null, 2), 'utf8');
}

exports.getAll = async () => readUsers();
exports.getById = async (id) => (await readUsers()).find(u => u.id === id) || null;
exports.getByUsername = async (username) => (await readUsers()).find(u => u.username === username) || null;

exports.create = async (data) => {
    const users = await readUsers();
    const user = {
        id: makeId(),
        username: data.username,
        passwordHash: data.passwordHash || null,
        avatar: data.avatar || null,
        bio: data.bio || '',
        recommendedScore: data.recommendedScore || 0,
        isGuest: data.isGuest || false,
        createdAt: new Date().toISOString(),
        settings: data.settings || {}
    };
    users.push(user);
    await writeUsers(users);
    return user;
};

exports.update = async (id, patch) => {
    const users = await readUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...patch };
    await writeUsers(users);
    return users[idx];
};

exports.recommended = async (limit = 6) => {
    const users = await readUsers();
    // sort by recommendedScore desc, exclude guest marker
    return users
        .filter(u => !u.isGuest)
        .sort((a, b) => (b.recommendedScore || 0) - (a.recommendedScore || 0))
        .slice(0, limit);
};