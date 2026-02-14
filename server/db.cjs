const fs = require('fs/promises');
const path = require('path');

const { Pool } = (() => {
  try { return require('pg'); } catch (e) { return { Pool: null }; }
})();

const connectionString = 'https://moodshare-7dd7.onrender.com';

let pool = null;
const usersFile = path.join(__dirname, 'users.json');

if (connectionString && Pool && Pool.prototype) {
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  (async () => {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ Postgres connecté');
    } catch (err) {
      console.error('❌ Postgres connection error:', err);
    }
  })();
} else {
  console.warn('⚠️  DATABASE_URL absent ou pg non installé — using file-based users fallback:', usersFile);
  // Ensure file exists
  (async () => {
    try {
      await fs.mkdir(path.dirname(usersFile), { recursive: true });
      try {
        await fs.access(usersFile);
      } catch {
        await fs.writeFile(usersFile, JSON.stringify([]));
        console.log('ℹ️ users.json créé pour fallback auth');
      }
    } catch (err) {
      console.error('❌ Error ensuring users file:', err);
    }
  })();
}

// Helpers for file-based users
async function readUsersFile() {
  try {
    const txt = await fs.readFile(usersFile, 'utf8');
    return JSON.parse(txt || '[]');
  } catch (err) {
    return [];
  }
}
async function writeUsersFile(users) {
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), 'utf8');
}

// Minimal emulation of the db.query interface used by auth.cjs
async function fileQuery(text, params = []) {
  // Normalize simple queries used in auth.cjs
  const q = (text || '').trim().toLowerCase();
  // SELECT id FROM users WHERE email=$1
  if (q.startsWith('select id from users where email')) {
    const email = String(params[0] || '').toLowerCase();
    const users = await readUsersFile();
    const found = users.filter(u => u.email && u.email.toLowerCase() === email).map(u => ({ id: u.id }));
    return { rows: found };
  }

  // SELECT * FROM users WHERE email=$1
  if (q.startsWith('select * from users where email')) {
    const email = String(params[0] || '').toLowerCase();
    const users = await readUsersFile();
    const found = users.filter(u => u.email && u.email.toLowerCase() === email);
    return { rows: found };
  }

  // SELECT * FROM users WHERE display_name=$1
  if (q.startsWith('select * from users where display_name')) {
    const name = String(params[0] || '');
    const users = await readUsersFile();
    const found = users.filter(u => (u.display_name || u.username || '').toString() === name);
    return { rows: found };
  }

  // SELECT * FROM users WHERE id=$1
  if (q.startsWith('select * from users where id')) {
    const id = params[0];
    const users = await readUsersFile();
    const found = users.filter(u => String(u.id) === String(id));
    return { rows: found };
  }

  // INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id, email, display_name
  if (q.startsWith('insert into users') && q.includes('returning')) {
    const [email, password_hash, display_name] = params;
    const users = await readUsersFile();
    const id = Date.now().toString();
    const newUser = {
      id,
      email: String(email).toLowerCase(),
      password_hash,
      display_name: display_name || '',
      refresh_token: null
    };
    users.push(newUser);
    await writeUsersFile(users);
    return { rows: [{ id: newUser.id, email: newUser.email, display_name: newUser.display_name }] };
  }

  // UPDATE users SET refresh_token=$1 WHERE id=$2
  if (q.startsWith('update users set refresh_token')) {
    const [refreshToken, id] = params;
    const users = await readUsersFile();
    const idx = users.findIndex(u => String(u.id) === String(id));
    if (idx !== -1) {
      users[idx].refresh_token = refreshToken;
      await writeUsersFile(users);
      return { rows: [users[idx]] };
    }
    return { rows: [] };
  }

  // UPDATE users SET refresh_token=NULL WHERE id=$1
  if (q.startsWith('update users set refresh_token=null')) {
    const [id] = params;
    const users = await readUsersFile();
    const idx = users.findIndex(u => String(u.id) === String(id));
    if (idx !== -1) {
      users[idx].refresh_token = null;
      await writeUsersFile(users);
      return { rows: [users[idx]] };
    }
    return { rows: [] };
  }

  // Default: throw to make error visible
  throw new Error('Unsupported fallback query: ' + text);
}

module.exports = {
  pool,
  query: async (text, params) => {
    if (pool) {
      return pool.query(text, params);
    }
    return fileQuery(text, params);
  }
};