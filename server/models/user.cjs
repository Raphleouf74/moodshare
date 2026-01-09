const fs = require('fs').promises;
const path = require('path');

const usersFile = process.env.USERS_FILE || path.join(__dirname, '..', 'users.json');

async function ensureUsersFile() {
  try {
    await fs.access(usersFile);
  } catch (err) {
    await fs.mkdir(path.dirname(usersFile), { recursive: true });
    await fs.writeFile(usersFile, '[]', 'utf8');
  }
}

async function readUsers() {
  await ensureUsersFile();
  const txt = await fs.readFile(usersFile, 'utf8').catch(() => '[]');
  try {
    return JSON.parse(txt || '[]');
  } catch (err) {
    console.error('❌ users.json invalide, reset :', err);
    await fs.writeFile(usersFile, '[]', 'utf8');
    return [];
  }
}

async function writeUsers(users) {
  await ensureUsersFile();
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), 'utf8');
}

/**
 * Retourne une liste d'utilisateurs recommandés.
 * Tri par recommendedScore descendant puis par date de création.
 * limit par défaut 5.
 */
async function recommended(limit = 5) {
  const users = await readUsers();
  return users
    .filter(u => !u.isGuest) // optionnel : éviter guests
    .sort((a, b) => (b.recommendedScore || 0) - (a.recommendedScore || 0))
    .slice(0, limit);
}

/* Helpers usuels (utilisés potentiellement ailleurs) */
async function findByUsername(username) {
  const users = await readUsers();
  return users.find(u => u.username === username) || null;
}

async function getById(id) {
  const users = await readUsers();
  return users.find(u => String(u.id) === String(id)) || null;
}

async function getByEmail(email) {
  if (!email) return null;
  const users = await readUsers();
  return users.find(u => u.email && u.email.toLowerCase() === String(email).toLowerCase()) || null;
}

async function createGuestUser() {
  const users = await readUsers();
  const id = (Date.now()).toString();
  const guest = {
    id,
    username: `guest_${id}`,
    verified: false,
    passwordHash: null,
    avatar: '/assets/logo/logo_dark.jpg',
    bio: '',
    recommendedScore: 0,
    isGuest: true,
    createdAt: new Date().toISOString(),
    settings: {}
  };
  users.push(guest);
  await writeUsers(users);
  return guest;
}

module.exports = {
  readUsers,
  writeUsers,
  recommended,
  findByUsername,
  getById,
  getByEmail,
  createGuestUser,
  usersFile
};