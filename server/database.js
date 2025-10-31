import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chemin vers le fichier JSON
const DB_PATH = join(__dirname, 'data', 'database.json');

// Structure initiale de la base
const initialDB = {
  users: [],
  posts: [],
  comments: []
};

// Ensure data directory and DB file exist
async function initDatabase() {
  try {
    await fs.mkdir(join(__dirname, 'data'), { recursive: true });
    try {
      await fs.access(DB_PATH);
    } catch {
      await fs.writeFile(DB_PATH, JSON.stringify(initialDB, null, 2));
    }
    console.log('✅ Base de données initialisée');
  } catch (err) {
    console.error('❌ Erreur initialisation DB:', err);
  }
}

// CRUD Operations
async function readDB() {
  const data = await fs.readFile(DB_PATH, 'utf8');
  return JSON.parse(data);
}

async function writeDB(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

// Users
export async function findUserById(id) {
  const db = await readDB();
  return db.users.find(u => u.id === id);
}

export async function findUserByEmail(email) {
  const db = await readDB();
  return db.users.find(u => u.email === email);
}

export async function createUser(userData) {
  const db = await readDB();
  const newUser = {
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    ...userData
  };
  db.users.push(newUser);
  await writeDB(db);
  return newUser;
}

// Posts
export async function getPosts(limit = 20) {
  const db = await readDB();
  return db.posts
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map(post => {
      const user = db.users.find(u => u.id === post.user_id);
      return {
        ...post,
        username: user?.username,
        avatar_url: user?.avatar_url
      };
    });
}

export async function createPost(postData) {
  const db = await readDB();
  const newPost = {
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    likes: 0,
    comments: [],
    ...postData
  };
  db.posts.push(newPost);
  await writeDB(db);
  return newPost;
}

// Comments
export async function addComment(postId, userId, content) {
  const db = await readDB();
  const comment = {
    id: Date.now().toString(),
    post_id: postId,
    user_id: userId,
    content,
    created_at: new Date().toISOString()
  };
  db.comments.push(comment);
  await writeDB(db);
  return comment;
}

// OAuth helpers
export async function findOrCreateOAuthUser(profile) {
  const db = await readDB();
  let user = db.users.find(u => 
    u.provider === profile.provider && u.provider_id === profile.id
  );

  if (!user) {
    user = await createUser({
      username: profile.displayName || profile.username,
      email: profile.email,
      avatar_url: profile.photo,
      provider: profile.provider,
      provider_id: profile.id,
      display_name: profile.displayName
    });
  }

  return user;
}

// Initialize DB on module load
initDatabase();

export default {
  findUserById,
  findUserByEmail,
  createUser,
  getPosts,
  createPost,
  addComment,
  findOrCreateOAuthUser
};