const fs = require('fs').promises;
const path = require('path');

// Utiliser la variable d'env USERS_FILE si présente, sinon fallback sur server/users.json
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

module.exports = {
  readUsers,
  writeUsers,
  usersFile
};