require("dotenv").config();
const path = require("path");
const mongoose = require("mongoose");

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const fsPromises = require("fs/promises");

// Routes externes (users)
const usersRoutes = require("./routes/users.cjs");
const jwtService = require('./services/jwt.cjs');

// ============================================================
// MONGODB — persistance inter-redémarrages
// Ajouter MONGO_URI dans Environment > Render pour activer.
// Format : mongodb+srv://<user>:<pass>@cluster.mongodb.net/moodshare
// ============================================================
const MONGO_URI = 'mongodb+srv://MoodShareAdminRaph:Jem4ppelleraphael!@cluster0.7lnr6qq.mongodb.net/?appName=Cluster0';

const postSchema = new mongoose.Schema({
  _id: { type: String, default: () => Date.now().toString() },
  text: String,
  emoji: String,
  color: String,
  textColor: String,
  likes: { type: Number, default: 0 },
  ephemeral: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },
  repostedFrom: String,
  createdAt: { type: Date, default: Date.now },
  editedAt: Date,
  pinned: { type: Boolean, default: false },
  pinnedLabel: { type: String, default: '' }
}, { _id: false });

const PostModel = mongoose.models.Post || mongoose.model('Post', postSchema);

// ============================================================
// USER SCHEMA pour MongoDB — avec features sociales
// ============================================================
const userSchema = new mongoose.Schema({
  _id: { type: String, default: () => Date.now().toString() },
  displayName: { type: String, required: true },
  password: { type: String, required: true },
  email: { type: String, sparse: true },
  isGuest: { type: Boolean, default: false },

  // Profil
  bio: { type: String, default: '', maxLength: 200 },
  avatar: { type: String, default: '👤' },

  // Réseau social
  followers: [{ type: String }], // Users qui me suivent
  following: [{ type: String }], // Users que je suis
  favorites: [{ type: String }], // Posts favoris

  // Notifications
  pushTokens: [{ type: String }], // Tokens FCM pour notifications

  // Stats (denormalisées pour perf)
  postsCount: { type: Number, default: 0 },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
}, { _id: false });

// Index pour recherche rapide
userSchema.index({ displayName: 'text' });

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

// ============================================================
// NOTIFICATION SCHEMA
// ============================================================
const notificationSchema = new mongoose.Schema({
  _id: { type: String, default: () => Date.now().toString() },
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true }, // 'message', 'like', 'comment', 'follow'
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: { type: Object, default: {} }, // Metadata (postId, senderId, etc)
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const NotificationModel = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

// ============================================================
// MESSAGE & CONVERSATION SCHEMA
// ============================================================
const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  content: { type: String, default: '' },
  sharedPostId: { type: String, default: null }, // Si on partage un post
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Format: "userId1_userId2" (alphabétique)
  participants: [{ type: String, required: true }], // [userId1, userId2]
  participantNames: { type: Map, of: String }, // { userId: displayName }
  messages: { type: [messageSchema], default: [] }, // Max 20 messages
  lastMessageAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const ConversationModel = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

// POSTS STORAGE
let posts = [
  {
    text: 'Bienvenue dans Moodshare !',
    color: '#00cfeb',
    date: '01/01/2026',
    emoji: '👋',
    ephemeral: false,
    expiresAt: null,
    id: 0
  }
];

let mongoReady = false;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 6000 })
    .then(async () => {
      mongoReady = true;
      console.log('✅ MongoDB connecté');
      await loadPostsFromMongo();
    })
    .catch(err => {
      console.error('❌ MongoDB connexion échouée — fallback JSON:', err.message);
    });
} else {
  console.warn('⚠️  MONGO_URI absent — persistance JSON seule (éphémère sur Render Free)');
}

async function loadPostsFromMongo() {
  try {
    const docs = await PostModel.find({}).sort({ pinned: -1, createdAt: -1 }).lean();
    if (docs.length > 0) {
      posts = docs.map(d => ({ ...d, id: d._id }));
      console.log(`📦 \${posts.length} posts chargés depuis MongoDB`);
    }
  } catch (err) {
    console.error('❌ loadPostsFromMongo:', err.message);
  }
}

async function saveToDB(post) {
  if (!mongoReady) return;
  try {
    const doc = { ...post, _id: String(post.id) };
    delete doc.id;
    await PostModel.findOneAndUpdate({ _id: doc._id }, doc, { upsert: true, new: true });
  } catch (err) {
    console.error('❌ saveToDB:', err.message);
  }
}

async function deleteFromDB(id) {
  if (!mongoReady) return;
  try {
    await PostModel.deleteOne({ _id: String(id) });
  } catch (err) {
    console.error('❌ deleteFromDB:', err.message);
  }
}

async function savePostsToFile() {
  try {
    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));
  } catch (err) {
    console.error('❌ savePostsToFile:', err.message);
  }
}

// Persiste partout (JSON + MongoDB)
async function persistPost(post) {
  await savePostsToFile();
  await saveToDB(post);
}

// Supprime de la mémoire + partout
async function unpersistPost(id) {
  posts = posts.filter(p => String(p.id) !== String(id));
  await savePostsToFile();
  await deleteFromDB(id);
}


process.on("uncaughtException", err => console.error("❌ Exception non attrapée:", err));
process.on("unhandledRejection", err => console.error("❌ Rejection non faite:", err));

const app = express();

// ============================================================
// TRUST PROXY — CRITIQUE pour Render/Heroku/proxies
// ============================================================
app.set('trust proxy', 1);

// Debug: log simple des requêtes et des origins pour aider le debug CORS
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.originalUrl} Origin=${req.headers.origin || 'none'}`);
  next();
});

// Ping simple pour tester rapidement depuis le navigateur
app.get('/ping', (req, res) => {
  res.set('x-server', 'moodshare-server');
  res.json({ ok: true, time: Date.now() });
});

// CORS — config unique, propre, avec support du header X-Admin-Secret
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedHosts = [
      "https://moodsharing.netlify.app",
      "https://moodshare-7dd7.onrender.com"
    ];
    // Mettre 127.0.0.1 et 192.168.1.21 en localhost safe
    const localhostsRegex = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.1\.21)(:\d+)?$/;

    if (localhostsRegex.test(origin) || allowedHosts.includes(origin)) {
      return callback(null, true);
    }
    console.log("❌ Bloqué par le CORS:", origin);
    return callback(new Error("Non accepté par le CORS"));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // X-Admin-Secret ajouté pour les routes /api/admin/*
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Admin-Secret']
};

app.use(cors(corsOptions));
// Preflight explicite — indispensable pour les custom headers comme X-Admin-Secret
app.options('*', cors(corsOptions));

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());

// Middleware pour vérifier le Bearer token et définir req.user
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwtService.verify(token);
      req.user = { id: decoded.id || decoded.userId };
    } catch (err) {
      // invalid token, ignore
    }
  }
  next();
});

// ============================================================
// SESSION — Configuration avec MongoDB store
// ============================================================
const { MongoStore } = require('connect-mongo');

app.use(session({
  secret: process.env.SESSION_SECRET || 'moodshare-secret-change-me-in-production',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    touchAfter: 24 * 3600,
    ttl: 7 * 24 * 60 * 60
  }),
  proxy: true, // CRITIQUE avec trust proxy
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Debug session middleware
app.use((req, res, next) => {
  console.log(`[SESSION] ${req.method} ${req.path} - Session ID: ${req.sessionID} - User: ${req.session?.user?.id || 'none'}`);
  next();
});

// Rate Limit — exempter les routes admin et SSE
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  skip: (req, res) => {
    // Exempter les routes admin (protégées par le secret)
    if (req.path.startsWith('/api/admin')) return true;
    // Exempter le SSE (connexion persistante)
    if (req.path === '/api/stream') return true;
    // Exempter les routes auth
    if (req.path.startsWith('/api/auth')) return true;
    return false;
  }
});

app.use(generalLimiter);

const dataDir = path.join(__dirname, "data");
const postsFile = path.join(dataDir, "posts.json");

// Ensure dir exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function safeLoadJSON(filePath, fallback, label) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      // Vérifie que c'est bien un tableau
      if (!Array.isArray(parsed)) throw new Error("Not an array");
      console.log(`✅ ${label}: ${parsed.length} entrées chargées`);
      return parsed;
    }
  } catch (err) {
    console.error(`❌ ${label} corrompu (${err.message}) — réinitialisation`);
    // Écrase le fichier corrompu avec un tableau vide propre
    try { fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2)); } catch (_) { }
  }
  return fallback;
}

posts = safeLoadJSON(postsFile, posts, "posts.json");

// ---- STORIES STORAGE ----
let stories = [];
const storiesFile = path.join(dataDir, "stories.json");
stories = safeLoadJSON(storiesFile, stories, "stories.json");

// === REPORTS STORAGE ===
let reports = [];
const reportsFile = path.join(dataDir, "reports.json");
reports = safeLoadJSON(reportsFile, reports, "reports.json");

// === SSE (Server-Sent Events) clients ===
let sseClients = [];

function sendSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => {
    try { c.res.write(payload); } catch (err) { console.error('❌ Erreur envoi SSE:', err); }
  });
}

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  const clientId = `${Date.now()}_${Math.random()}`;
  sseClients.push({ id: clientId, res });

  // initial snapshot
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  res.write(`event: initial_posts\ndata: ${JSON.stringify(posts)}\n\n`);
  res.write(`event: initial_stories\ndata: ${JSON.stringify(stories)}\n\n`);

  req.on('close', () => { sseClients = sseClients.filter(c => c.id !== clientId); });
});

app.get("/api/stories", (req, res) => {
  try {
    // Filtrer les stories expirées
    const now = Date.now();
    const active = stories.filter(s => !s.expiresAt || new Date(s.expiresAt).getTime() > now);

    // Purger les expirées du stockage si nécessaire
    const expiredExists = stories.length !== active.length;
    if (expiredExists) {
      stories = active;
      fsPromises.writeFile(storiesFile, JSON.stringify(stories, null, 2)).catch(err => {
        console.error("❌ Erreur lors de la sauvegarde des stories après la purge:", err);
      });
      // broadcast updated stories list
      try { sendSSE('stories_update', stories); } catch (e) { console.error('❌ Erreur SSE:', e); }
    }

    res.json(active);
  } catch (err) {
    console.error("❌ Erreur lors de la récupération des stories:", err);
    res.status(500).json({ error: "Erreur interne" });
  }
});
// GET POSTS
app.get("/api/posts", (req, res) => {
  res.json(posts);
});
function sanitizeText(text) {
  if (!text) return "";

  // Détection stricte → refuse la requête
  const forbiddenPattern = /(script|javascript:|onerror=|onclick=|onload=|<iframe|<img|<svg|document\.|window\.)/i;

  if (forbiddenPattern.test(text)) {
    throw new Error("Contenu interdit detecté");
  }

  // Sanitize quand même :
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
// CREATE POST
app.post("/api/posts", async (req, res) => {
  try {
    const cleanText = sanitizeText(req.body.text);
    const cleanEmoji = sanitizeText(req.body.emoji);

    const newPost = {
      text: cleanText,
      emoji: cleanEmoji,
      color: req.body.color,
      textColor: req.body.textColor,
      id: Date.now().toString(),
      userId: req.session?.user?.id || null, // Track qui a créé le post
      userName: req.session?.user?.displayName || 'Anonyme',
      ...req.body,
      likes: 0,
      pinned: false,
      createdAt: new Date().toISOString()
    };

    posts.unshift(newPost);
    await persistPost(newPost);
    try { sendSSE('new_post', newPost); } catch (e) { console.error('❌ Erreur SSE:', e); }

    res.status(201).json(newPost);
  } catch (err) {
    return res.status(400).json({ error: "Contenu invalide" });
  }
});





// Report a post or comment
app.post('/api/posts/:id/report', async (req, res) => {
  try {
    const targetPost = posts.find(p => p.id == req.params.id);
    if (!targetPost) return res.status(404).json({ error: 'Post non trouvé' });

    const { reason = '' } = req.body;
    const report = {
      id: Date.now().toString(),
      postId: req.params.id,
      reason: String(reason).slice(0, 1000),
      createdAt: new Date().toISOString()
    };

    reports.unshift(report);
    await fsPromises.writeFile(reportsFile, JSON.stringify(reports, null, 2));

    // Notify admins / clients via SSE
    try { sendSSE('report', report); } catch (e) { console.error('❌ Erreur SSE:', e); }

    res.json({ ok: true });
  } catch (err) { console.error('❌ Erreur de signalement:', err); res.status(500).json({ error: 'Interne' }); }
});

// Repost (create a new post duplicating an existing one)
app.post('/api/posts/:id/repost', async (req, res) => {
  try {
    const orig = posts.find(p => p.id == req.params.id);
    if (!orig) return res.status(404).json({ error: 'Post non trouvé' });

    const newPost = {
      text: orig.text,
      emoji: orig.emoji,
      color: orig.color,
      textColor: orig.textColor,
      id: Date.now().toString(),
      likes: 0,
      repostedFrom: orig.id,
      createdAt: new Date().toISOString()
    };

    posts.unshift(newPost);
    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));
    try { sendSSE('new_post', newPost); } catch (e) { console.error('❌ Erreur SSE:', e); }

    res.status(201).json(newPost);
  } catch (err) { console.error('❌ Erreur de republication:', err); res.status(500).json({ error: 'Interne' }); }
});



app.post("/api/stories", async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    const emoji = String(req.body.emoji || "").trim();
    const color = req.body.color || "#ffffff";
    // Nouvelle prise en charge de textColor
    const textColor = req.body.textColor || null;
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt).toISOString() : null;

    // Validation basique
    if (!text && !emoji) {
      return res.status(400).json({ error: "Story vide" });
    }

    // Sanitization stricte (réutilise sanitizeText)
    const cleanText = sanitizeText(text);
    const cleanEmoji = sanitizeText(emoji);

    const newStory = {
      id: Date.now().toString(),
      text: cleanText,
      emoji: cleanEmoji,
      color,
      // stocker textColor si fourni
      ...(textColor ? { textColor } : {}),
      createdAt: new Date().toISOString(),
      expiresAt
    };

    // Prévenir accumulation : garder récence en tête
    stories.unshift(newStory);

    // Enregistrer
    await fsPromises.writeFile(storiesFile, JSON.stringify(stories, null, 2));

    // notify clients
    try { sendSSE('new_story', newStory); } catch (e) { console.error('❌ Erreur SSE:', e); }

    // Répondre avec la story créée
    res.status(201).json(newStory);
  } catch (err) {
    console.error("❌ Erreur lors de la création de la story:", err);
    res.status(400).json({ error: "Contenu Invalide" });
  }
});
app.get("/api/auth/me", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  // Pour les invités, retourner directement
  if (req.user.id.startsWith('guest_')) {
    return res.json({ user: { id: req.user.id, displayName: 'Invité' } });
  }

  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ user: { id: user._id, displayName: user.displayName } });
  } catch (err) {
    console.error('Error getting current user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
// LIKE / UNLIKE
app.post("/api/posts/:id/like", async (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: "Post non trouvé" });

  post.likes++;
  await persistPost(post);
  // Pas de sendSSE ici — le client met à jour son compteur
  // depuis la réponse HTTP pour éviter le double-comptage
  res.json(post);
});

app.post("/api/posts/:id/unlike", async (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: "Post non trouvé" });

  post.likes = Math.max(0, post.likes - 1);
  await persistPost(post);
  // Pas de sendSSE ici — même raison
  res.json(post);
});

// SHARE — Créer un nouveau post qui partage un post existant
app.post("/api/posts/:id/share", async (req, res) => {
  try {
    const originalPost = posts.find(p => p.id == req.params.id);
    if (!originalPost) return res.status(404).json({ error: "Post non trouvé" });

    if (!req.session?.user) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    // Créer un nouveau post avec référence au post original
    const sharedPost = {
      id: Date.now(),
      text: req.body.text || `📤 Partagé par ${req.session.user.displayName}`,
      color: originalPost.color,
      emoji: originalPost.emoji,
      date: new Date().toLocaleDateString('fr-FR'),
      userId: req.session.user.id,
      userName: req.session.user.displayName,
      likes: 0,
      ephemeral: false,
      sharedFrom: {
        id: originalPost.id,
        userName: originalPost.userName || 'Anonyme',
        text: originalPost.text,
        emoji: originalPost.emoji,
        color: originalPost.color
      }
    };

    posts.unshift(sharedPost);
    await savePostsToFile();
    await persistPost(sharedPost);
    sendSSE('new_post', sharedPost);

    res.json(sharedPost);
  } catch (err) {
    console.error('❌ Erreur share:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================================
// ROUTES SOCIALES — Follow, Favorites, Suggestions
// ============================================================

// Middleware auth pour routes sociales
function requireAuth(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
}

// GET /api/social/profile/:userId — Profil public d'un user
app.get('/api/social/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.session?.user?.id;

    const user = await UserModel.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Posts de cet user (depuis MongoDB)
    const userPosts = await PostModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Check si l'user actuel suit ce profil
    const isFollowing = currentUserId ? user.followers.includes(currentUserId) : false;
    const isOwnProfile = currentUserId === userId;

    res.json({
      user: {
        id: user._id,
        displayName: user.displayName,
        bio: user.bio || '',
        avatar: user.avatar || '👤',
        followersCount: user.followersCount || 0,
        followingCount: user.followingCount || 0,
        postsCount: userPosts.length,
        isFollowing,
        isOwnProfile
      },
      posts: userPosts
    });
  } catch (err) {
    console.error('❌ Erreur profile:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/social/follow/:userId — Suivre un user
app.post('/api/social/follow/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.session.user.id;

    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Impossible de se suivre soi-même' });
    }

    const [currentUser, targetUser] = await Promise.all([
      UserModel.findById(currentUserId),
      UserModel.findById(userId)
    ]);

    if (!targetUser) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Vérifier si déjà suivi
    if (currentUser.following.includes(userId)) {
      return res.status(400).json({ error: 'Déjà suivi' });
    }

    // Ajouter aux listes
    currentUser.following.push(userId);
    currentUser.followingCount = currentUser.following.length;

    targetUser.followers.push(currentUserId);
    targetUser.followersCount = targetUser.followers.length;

    await Promise.all([currentUser.save(), targetUser.save()]);

    console.log(`✅ ${currentUser.displayName} suit maintenant ${targetUser.displayName}`);

    res.json({
      success: true,
      followersCount: targetUser.followersCount,
      followingCount: currentUser.followingCount
    });
  } catch (err) {
    console.error('❌ Erreur follow:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/social/unfollow/:userId — Ne plus suivre
app.post('/api/social/unfollow/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.session.user.id;

    const [currentUser, targetUser] = await Promise.all([
      UserModel.findById(currentUserId),
      UserModel.findById(userId)
    ]);

    if (!targetUser) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Retirer des listes
    currentUser.following = currentUser.following.filter(id => id !== userId);
    currentUser.followingCount = currentUser.following.length;

    targetUser.followers = targetUser.followers.filter(id => id !== currentUserId);
    targetUser.followersCount = targetUser.followers.length;

    await Promise.all([currentUser.save(), targetUser.save()]);

    console.log(`✅ ${currentUser.displayName} ne suit plus ${targetUser.displayName}`);

    res.json({
      success: true,
      followersCount: targetUser.followersCount,
      followingCount: currentUser.followingCount
    });
  } catch (err) {
    console.error('❌ Erreur unfollow:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/social/favorite/:postId — Ajouter aux favoris
app.post('/api/social/favorite/:postId', requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.session.user.id;

    const user = await UserModel.findById(currentUserId);
    if (!user.favorites.includes(postId)) {
      user.favorites.push(postId);
      await user.save();
    }

    res.json({ success: true, favoritesCount: user.favorites.length });
  } catch (err) {
    console.error('❌ Erreur favorite:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/social/unfavorite/:postId — Retirer des favoris
app.post('/api/social/unfavorite/:postId', requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.session.user.id;

    const user = await UserModel.findById(currentUserId);
    user.favorites = user.favorites.filter(id => id !== postId);
    await user.save();

    res.json({ success: true, favoritesCount: user.favorites.length });
  } catch (err) {
    console.error('❌ Erreur unfavorite:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/social/favorites — Mes posts favoris
app.get('/api/social/favorites', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const user = await UserModel.findById(currentUserId);

    const favPosts = await PostModel.find({
      _id: { $in: user.favorites }
    }).sort({ createdAt: -1 }).lean();

    res.json({ posts: favPosts });
  } catch (err) {
    console.error('❌ Erreur get favorites:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/social/suggestions — Suggestions d'utilisateurs à suivre
app.get('/api/social/suggestions', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const currentUser = await UserModel.findById(currentUserId);

    // Trouver users avec le plus de followers, qu'on ne suit pas déjà
    const suggestions = await UserModel.find({
      _id: {
        $ne: currentUserId,
        $nin: currentUser.following || []
      },
      isGuest: false
    })
      .select('_id displayName bio avatar followersCount')
      .sort({ followersCount: -1, createdAt: -1 })
      .limit(5)
      .lean();

    res.json({ suggestions });
  } catch (err) {
    console.error('❌ Erreur suggestions:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/social/followers/:userId — Liste des followers
app.get('/api/social/followers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const followers = await UserModel.find({
      _id: { $in: user.followers || [] }
    }).select('_id displayName avatar').lean();

    res.json({ followers });
  } catch (err) {
    console.error('❌ Erreur followers:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/social/following/:userId — Liste des abonnements
app.get('/api/social/following/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const following = await UserModel.find({
      _id: { $in: user.following || [] }
    }).select('_id displayName avatar').lean();

    res.json({ following });
  } catch (err) {
    console.error('❌ Erreur following:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/social/feed — Feed intelligent (posts des amis en priorité)
app.get('/api/social/feed', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const currentUser = await UserModel.findById(currentUserId);

    // Posts des users suivis + mes posts
    const friendsIds = [...(currentUser.following || []), currentUserId];

    const friendsPosts = await PostModel.find({
      userId: { $in: friendsIds }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Posts des autres (pour suggestions)
    const otherPosts = await PostModel.find({
      userId: { $nin: friendsIds }
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Marquer les posts favoris
    const favorites = currentUser.favorites || [];
    const allPosts = [...friendsPosts, ...otherPosts].map(p => ({
      ...p,
      isFavorite: favorites.includes(p._id),
      isFromFriend: friendsIds.includes(p.userId)
    }));

    res.json({ posts: allPosts });
  } catch (err) {
    console.error('❌ Erreur feed:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/social/profile — Modifier son profil
app.put('/api/social/profile', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const { bio, avatar } = req.body;

    const user = await UserModel.findById(currentUserId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    if (bio !== undefined) user.bio = bio.substring(0, 200);
    if (avatar !== undefined) user.avatar = avatar.substring(0, 10);

    await user.save();

    res.json({
      success: true,
      user: {
        bio: user.bio,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('❌ Erreur update profile:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================================
// Vérifie que la requête vient bien du panneau admin.
// Le panel envoie l'header X-Admin-Secret dont la valeur doit
// correspondre à la variable d'env ADMIN_SECRET (à définir sur
// Render dans Environment > Add Environment Variable).
// Si ADMIN_SECRET n'est pas défini, la route est bloquée.
// ============================================================
function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.warn('⚠️  ADMIN_SECRET non défini — routes admin désactivées');
    return res.status(503).json({ error: 'Admin non configuré côté serveur' });
  }
  const provided = req.headers['x-admin-secret'];
  if (!provided || provided !== secret) {
    console.warn('🚫 Tentative d\'accès admin refusée — mauvais secret');
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
}


// ============================================================
// POST /api/admin/posts/pinned — Créer un post épinglé (annonce)
// DOIT être déclaré AVANT /api/admin/posts/:id pour éviter le conflit
// ============================================================
app.post('/api/admin/posts/pinned', requireAdmin, async (req, res) => {
  try {
    const { text, emoji, color, textColor, pinnedLabel } = req.body;
    if (!text && !emoji) return res.status(400).json({ error: 'Post vide' });

    const cleanText = sanitizeText(String(text || ''));
    const cleanEmoji = sanitizeText(String(emoji || ''));

    const pinnedPost = {
      id: 'pinned_' + Date.now().toString(),
      text: cleanText,
      emoji: cleanEmoji,
      color: String(color || '#f59e0b').slice(0, 20),
      textColor: String(textColor || '#000000').slice(0, 20),
      pinnedLabel: String(pinnedLabel || 'Annonce').slice(0, 60),
      pinned: true,
      likes: 0,
      ephemeral: false,
      expiresAt: null,
      createdAt: new Date().toISOString()
    };

    posts.unshift(pinnedPost);
    await persistPost(pinnedPost);
    try { sendSSE('new_post', pinnedPost); } catch (e) { console.error('❌ Erreur SSE:', e); }

    console.log(`📌 [ADMIN] Post épinglé créé: ${pinnedPost.id}`);
    res.status(201).json(pinnedPost);
  } catch (err) {
    console.error('❌ Erreur création post épinglé:', err);
    res.status(400).json({ error: err.message || 'Erreur interne' });
  }
});

// ============================================================
// GET /api/admin/posts/pinned — Liste les posts épinglés
// ============================================================
app.get('/api/admin/posts/pinned', requireAdmin, (req, res) => {
  res.json(posts.filter(p => p.pinned));
});

// ============================================================
// DELETE /api/admin/posts/pinned/:id — Supprimer un post épinglé
// ============================================================
app.delete('/api/admin/posts/pinned/:id', requireAdmin, async (req, res) => {
  try {
    const post = posts.find(p => String(p.id) === String(req.params.id) && p.pinned);
    if (!post) return res.status(404).json({ error: 'Post épinglé non trouvé' });

    await unpersistPost(post.id);
    try { sendSSE('post_deleted', { id: post.id }); } catch (e) { console.error('❌ Erreur SSE:', e); }

    console.log(`🗑️  [ADMIN] Post épinglé ${post.id} supprimé`);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erreur suppression post épinglé:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ============================================================
// DELETE /api/admin/posts/:id — Suppression forcée d'un post
// ============================================================
app.delete('/api/admin/posts/:id', requireAdmin, async (req, res) => {
  try {
    const post = posts.find(p => String(p.id) === String(req.params.id));
    if (!post) return res.status(404).json({ error: 'Post non trouvé' });

    await unpersistPost(post.id);
    try { sendSSE('post_deleted', { id: post.id }); } catch (e) { console.error('❌ Erreur SSE:', e); }

    console.log(`🗑️  [ADMIN] Post ${post.id} supprimé`);
    res.json({ ok: true, deleted: post.id });
  } catch (err) {
    console.error('❌ Erreur suppression admin:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ============================================================
// PUT /api/admin/posts/:id — Modification forcée d'un post
// ============================================================
app.put('/api/admin/posts/:id', requireAdmin, async (req, res) => {
  try {
    const post = posts.find(p => String(p.id) === String(req.params.id));
    if (!post) return res.status(404).json({ error: 'Post non trouvé' });

    const { text, emoji, color, textColor } = req.body;
    if (text !== undefined) post.text = sanitizeText(String(text));
    if (emoji !== undefined) post.emoji = sanitizeText(String(emoji));
    if (color !== undefined) post.color = String(color).slice(0, 20);
    if (textColor !== undefined) post.textColor = String(textColor).slice(0, 20);
    post.editedAt = new Date().toISOString();

    await persistPost(post);
    try { sendSSE('post_update', post); } catch (e) { console.error('❌ Erreur SSE:', e); }

    console.log(`✏️  [ADMIN] Post ${post.id} modifié`);
    res.json(post);
  } catch (err) {
    console.error('❌ Erreur modification admin:', err);
    res.status(400).json({ error: err.message || 'Erreur interne' });
  }
});

// ============================================================
// GET /api/admin/reports — Liste complète des signalements
// ============================================================
app.get('/api/admin/reports', requireAdmin, (req, res) => {
  try {
    res.json(reports);
  } catch (err) {
    console.error('❌ Erreur récupération reports admin:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ============================================================
// DELETE /api/admin/reports/:id — Supprimer un signalement
// ============================================================
app.delete('/api/admin/reports/:id', requireAdmin, async (req, res) => {
  try {
    const idx = reports.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Signalement non trouvé' });

    reports.splice(idx, 1);
    await fsPromises.writeFile(reportsFile, JSON.stringify(reports, null, 2));

    console.log(`✅ [ADMIN] Signalement ${req.params.id} supprimé`);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erreur suppression report admin:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ============================================================
// GET /api/admin/status — Statut du serveur et MongoDB
// ============================================================
app.get('/api/admin/status', requireAdmin, (req, res) => {
  const serverStartTime = process.uptime() * 1000;
  const uptime = Math.floor(process.uptime());
  const environment = process.env.RENDER ? 'Render' : 'Local';

  res.json({
    ok: true,
    environment,
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    uptimeSeconds: uptime,
    mongodb: {
      connected: mongoReady,
      uri: MONGO_URI ? '✅ Configuré' : '❌ Non configuré',
      status: mongoReady ? '✅ Connecté' : '❌ Déconnecté'
    },
    database: {
      posts: posts.length,
      stories: stories.length,
      reports: reports.length,
      pinned: posts.filter(p => p.pinned).length
    },
    node: {
      version: process.version,
      platform: process.platform,
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`
      }
    },
    api: {
      corsEnabled: true,
      adminSecretConfigured: !!process.env.ADMIN_SECRET,
      rateLimit: '200 req/15min'
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// POST /api/admin/emergency-restart — Action d'urgence
// Redémarre les connexions (MongoDB, SSE, etc.)
// ============================================================
app.post('/api/admin/emergency-restart', requireAdmin, async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  console.log(`🚨 [EMERGENCY] Requête POST reçue - Secret fourni: ${secret ? '✅' : '❌'}`);
  console.log('🚨 [EMERGENCY] Redémarrage d\'urgence initié par admin');

  try {
    // Fermer tous les clients SSE
    const closedCount = sseClients.length;
    sseClients.forEach(c => {
      try { c.res.end(); } catch (_) { }
    });
    sseClients = [];
    console.log(`✅ [EMERGENCY] ${closedCount} clients SSE fermés`);

    // Tenter reconnexion MongoDB
    if (MONGO_URI && mongoReady) {
      try {
        // Vérifier la connexion
        const test = await mongoose.connection.db.admin().ping();
        console.log('✅ [EMERGENCY] MongoDB ping OK');
      } catch (err) {
        console.warn('⚠️ [EMERGENCY] MongoDB ping échoué:', err.message);
      }
    }

    res.json({
      ok: true,
      message: 'Redémarrage d\'urgence effectué',
      actions: {
        sseClientsReset: closedCount,
        mongoChecked: !!MONGO_URI,
        timestamp: new Date().toISOString()
      }
    });

    console.log('✅ [EMERGENCY] Redémarrage d\'urgence complété');
  } catch (err) {
    console.error('❌ [EMERGENCY] Erreur:', err.message);
    res.status(500).json({
      error: 'Erreur lors du redémarrage d\'urgence',
      details: err.message
    });
  }
});

// Rejeter les GET sur emergency-restart (seul POST est autorisé)
app.get('/api/admin/emergency-restart', (req, res) => {
  console.warn('🚫 [EMERGENCY] Tentative GET sur emergency-restart (méthode non autorisée)');
  res.status(405).json({ error: 'Méthode non autorisée - utilisez POST' });
});

/// AUTH ROUTES — MongoDB implementation
const crypto = require('crypto');

// Helper: hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

app.use("/api/auth", (req, res, next) => {
  console.log("🔐 [Auth] %s %s", req.method, req.path);
  next();
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { displayName, password } = req.body;

    if (!displayName || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    // Check if MongoDB is ready
    if (!mongoReady) {
      return res.status(503).json({ error: 'Base de données non disponible' });
    }

    // Create user
    const newUser = new UserModel({
      _id: Date.now().toString(),
      displayName,
      password: hashPassword(password),
      createdAt: new Date(),
      lastLogin: new Date()
    });

    await newUser.save();

    // Auto-login après inscription
    req.session.user = {
      id: newUser._id,
      displayName: newUser.displayName,
    };

    // CRITIQUE: Sauvegarder la session
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ User registered:', 'Session ID:', req.sessionID);
    res.json({
      user: {
        id: newUser._id,
        displayName: newUser.displayName,
      }
    });
  } catch (err) {
    console.error('❌ Register error:', err);
    res.status(500).json({ error: 'Erreur inscription' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { displayName, password } = req.body;
    const identifier = displayName;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Pseudo et mot de passe requis' });
    }

    if (!mongoReady) {
      return res.status(503).json({ error: 'Base de données non disponible' });
    }

    // Find user by displayName (case insensitive)
    const user = await UserModel.findOne({
      $or: [
        { displayName: { $regex: new RegExp(`^${identifier}$`, 'i') } }
      ]
    });

    if (!user || user.password !== hashPassword(password)) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Set session
    req.session.user = {
      id: user._id,
      displayName: user.displayName,
    };

    // CRITIQUE: Sauvegarder la session explicitement
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ User logged in:', 'Session ID:', req.sessionID);
    res.json({
      user: {
        id: user._id,
        displayName: user.displayName,
      },
      token: jwtService.sign({ id: user._id }, '15m')
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Erreur connexion' });
  }
});

// POST /api/auth/guest
app.post('/api/auth/guest', async (req, res) => {
  try {
    const guestId = 'guest_' + Date.now();

    // Optionnel: créer aussi les invités dans MongoDB pour tracking
    if (mongoReady) {
      const guestUser = new UserModel({
        _id: guestId,
        displayName: 'Invité',
        password: hashPassword(Math.random().toString()),
        isGuest: true,
        createdAt: new Date(),
        lastLogin: new Date()
      });
      await guestUser.save().catch(() => { }); // Ignore errors pour guest
    }

    req.session.user = { id: guestId, displayName: 'Invité', isGuest: true };

    // CRITIQUE: Sauvegarder la session
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ Guest login:', guestId, 'Session ID:', req.sessionID);
    res.json({
      user: { id: guestId, displayName: 'Invité' },
      token: jwtService.sign({ id: guestId }, '15m')
    });
  } catch (err) {
    console.error('❌ Guest error:', err);
    res.status(500).json({ error: 'Erreur connexion invité' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  res.json({ user: req.session.user });
});

// ============================================================
// MESSAGING ROUTES
// ============================================================

// Middleware: require auth
function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Connexion requise' });
  }
  next();
}

// Helper: generate conversation ID (alphabetical)
function getConversationId(userId1, userId2) {
  return [userId1, userId2].sort().join('_');
}

// GET /api/conversations — Liste toutes les conversations de l'utilisateur
app.get('/api/conversations', requireAuth, async (req, res) => {
  try {
    if (!mongoReady) {
      return res.status(503).json({ error: 'DB non disponible' });
    }

    const userId = req.session.user.id;

    // Trouver toutes les conversations où l'utilisateur est participant
    const conversations = await ConversationModel.find({
      participants: userId
    }).sort({ lastMessageAt: -1 }).lean();

    res.json(conversations);
  } catch (err) {
    console.error('❌ Get conversations error:', err);
    res.status(500).json({ error: 'Erreur récupération conversations' });
  }
});

// GET /api/conversations/:otherUserId — Récupère une conversation avec quelqu'un
app.get('/api/conversations/:otherUserId', requireAuth, async (req, res) => {
  try {
    if (!mongoReady) {
      return res.status(503).json({ error: 'DB non disponible' });
    }

    const userId = req.session.user.id;
    const otherUserId = req.params.otherUserId;
    const convId = getConversationId(userId, otherUserId);

    let conversation = await ConversationModel.findById(convId).lean();

    if (!conversation) {
      // Créer conversation vide
      const otherUser = await UserModel.findById(otherUserId);
      if (!otherUser) {
        return res.status(404).json({ error: 'Utilisateur introuvable' });
      }

      conversation = {
        _id: convId,
        participants: [userId, otherUserId],
        participantNames: {
          [userId]: req.session.user.displayName,
          [otherUserId]: otherUser.displayName
        },
        messages: [],
        lastMessageAt: new Date(),
        updatedAt: new Date()
      };
    }

    res.json(conversation);
  } catch (err) {
    console.error('❌ Get conversation error:', err);
    res.status(500).json({ error: 'Erreur récupération conversation' });
  }
});

// POST /api/conversations/:otherUserId/messages — Envoyer un message
app.post('/api/conversations/:otherUserId/messages', requireAuth, async (req, res) => {
  try {
    if (!mongoReady) {
      return res.status(503).json({ error: 'DB non disponible' });
    }

    const userId = req.session.user.id;
    const otherUserId = req.params.otherUserId;
    const { content, sharedPostId } = req.body;

    if (!content && !sharedPostId) {
      return res.status(400).json({ error: 'Message ou post requis' });
    }

    const convId = getConversationId(userId, otherUserId);

    // Trouver ou créer conversation
    let conversation = await ConversationModel.findById(convId);

    if (!conversation) {
      const otherUser = await UserModel.findById(otherUserId);
      if (!otherUser) {
        return res.status(404).json({ error: 'Utilisateur introuvable' });
      }

      conversation = new ConversationModel({
        _id: convId,
        participants: [userId, otherUserId],
        participantNames: new Map([
          [userId, req.session.user.displayName],
          [otherUserId, otherUser.displayName]
        ]),
        messages: []
      });
    }

    // Nouveau message
    const newMessage = {
      senderId: userId,
      senderName: req.session.user.displayName,
      content: content || '',
      sharedPostId: sharedPostId || null,
      timestamp: new Date()
    };

    // Ajouter message et garder max 20
    conversation.messages.push(newMessage);
    if (conversation.messages.length > 20) {
      conversation.messages = conversation.messages.slice(-20);
    }

    conversation.lastMessageAt = new Date();
    conversation.updatedAt = new Date();

    await conversation.save();

    // Créer notification pour le destinataire
    await createNotification(otherUserId, 'message',
      `${req.session.user.displayName}`,
      sharedPostId ? 'a partagé un post' : content,
      { senderId: userId, conversationId: convId }
    );

    // SSE broadcast so clients can update in real time
    try {
      sendSSE('new_message', {
        conversationId: convId,
        message: newMessage,
        participants: conversation.participants
      });
    } catch (e) {
      console.error('❌ SSE broadcast failed:', e);
    }

    res.json({ message: newMessage, conversation });
  } catch (err) {
    console.error('❌ Send message error:', err);
    res.status(500).json({ error: 'Erreur envoi message' });
  }
});

// ============================================================
// NOTIFICATIONS ROUTES
// ============================================================

// Helper: créer notification
async function createNotification(userId, type, title, body, data = {}) {
  if (!mongoReady) return;
  try {
    const notification = new NotificationModel({
      _id: Date.now().toString(),
      userId,
      type,
      title,
      body,
      data,
      read: false,
      createdAt: new Date()
    });
    await notification.save();

    const user = await UserModel.findById(userId);
    if (user && user.pushTokens && user.pushTokens.length > 0) {
      await sendPushNotification(user.pushTokens, title, body, data);
    }
  } catch (err) {
    console.error('❌ Create notification error:', err);
  }
}

// GET /api/notifications — Liste notifications de l'user
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    if (!mongoReady) {
      return res.status(503).json({ error: 'DB non disponible' });
    }

    const userId = req.session.user.id;
    const notifications = await NotificationModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(notifications);
  } catch (err) {
    console.error('❌ Get notifications error:', err);
    res.status(500).json({ error: 'Erreur récupération notifications' });
  }
});

// POST /api/notifications/:id/read — Marquer comme lu
app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    if (!mongoReady) {
      return res.status(503).json({ error: 'DB non disponible' });
    }

    const notifId = req.params.id;
    await NotificationModel.findByIdAndUpdate(notifId, { read: true });

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Mark read error:', err);
    res.status(500).json({ error: 'Erreur marquage notification' });
  }
});

// POST /api/users/push-token — Enregistrer token FCM
app.post('/api/users/push-token', requireAuth, async (req, res) => {
  try {
    if (!mongoReady) {
      return res.status(503).json({ error: 'DB non disponible' });
    }

    const userId = req.session.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requis' });
    }

    // Ajouter token si pas déjà présent
    await UserModel.findByIdAndUpdate(userId, {
      $addToSet: { pushTokens: token }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Save push token error:', err);
    res.status(500).json({ error: 'Erreur enregistrement token' });
  }
});

// GET /api/users/search — Rechercher utilisateurs
app.get('/api/users/search', requireAuth, async (req, res) => {
  try {
    if (!mongoReady) {
      return res.status(503).json({ error: 'DB non disponible' });
    }

    const query = req.query.q || '';
    if (query.length < 2) {
      return res.json([]);
    }

    // Recherche case-insensitive sur displayName
    const users = await UserModel.find({
      displayName: { $regex: query, $options: 'i' },
      _id: { $ne: req.session.user.id } // Exclure soi-même
    })
      .select('_id displayName')
      .limit(20)
      .lean();

    res.json(users);
  } catch (err) {
    console.error('❌ Search users error:', err);
    res.status(500).json({ error: 'Erreur recherche utilisateurs' });
  }
});

// GET /api/users/:userId/posts — Posts d'un utilisateur spécifique
app.get('/api/users/:userId/posts', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Filtrer posts par userId (ajouter userId aux posts lors de la création)
    // Pour l'instant retourner posts vides si userId pas encore trackés
    const userPosts = posts.filter(p => p.userId === userId);

    res.json(userPosts);
  } catch (err) {
    console.error('❌ Get user posts error:', err);
    res.status(500).json({ error: 'Erreur récupération posts' });
  }
});

// ============================================================
// ROUTES SOCIALES — Follow, Favorites, Suggestions
// ============================================================

// GET /api/social/profile/:userId — Profil public d'un user
app.get('/api/social/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.session?.user?.id;

    const user = await UserModel.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Récupérer posts de cet user depuis MongoDB
    const userPosts = await PostModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Check si l'user actuel suit ce profil
    const isFollowing = currentUserId ? user.followers.includes(currentUserId) : false;
    const isOwnProfile = currentUserId === userId;
    const isFavorited = currentUserId && user.favorites ? user.favorites.some(f => typeof f === 'string' ? f === currentUserId : f.userId === currentUserId) : false;

    res.json({
      user: {
        id: user._id,
        displayName: user.displayName,
        bio: user.bio || '',
        avatar: user.avatar || '👤',
        followersCount: user.followersCount || user.followers?.length || 0,
        followingCount: user.followingCount || user.following?.length || 0,
        postsCount: user.postsCount || userPosts.length,
        isFollowing,
        isOwnProfile,
        isFavorited
      },
      posts: userPosts
    });
  } catch (err) {
    console.error('❌ Erreur profile:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/social/follow/:userId — Suivre un user
app.post('/api/social/follow/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.session.user.id;

    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Impossible de se suivre soi-même' });
    }

    const [currentUser, targetUser] = await Promise.all([
      UserModel.findById(currentUserId),
      UserModel.findById(userId)
    ]);

    if (!targetUser) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Vérifier si déjà suivi
    if (currentUser.following && currentUser.following.includes(userId)) {
      return res.status(400).json({ error: 'Déjà suivi' });
    }

    // Ajouter aux listes
    if (!currentUser.following) currentUser.following = [];
    if (!targetUser.followers) targetUser.followers = [];

    currentUser.following.push(userId);
    currentUser.followingCount = currentUser.following.length;

    targetUser.followers.push(currentUserId);
    targetUser.followersCount = targetUser.followers.length;

    await Promise.all([currentUser.save(), targetUser.save()]);

    // Créer notification
    await createNotification({
      userId: targetUser._id,
      type: 'follow',
      title: 'Nouveau follower',
      body: `${currentUser.displayName} a commencé à vous suivre`,
      data: { followerId: currentUserId }
    });

    res.json({
      success: true,
      followersCount: targetUser.followersCount,
      followingCount: currentUser.followingCount
    });
  } catch (err) {
    console.error('❌ Erreur follow:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/social/unfollow/:userId — Ne plus suivre
app.post('/api/social/unfollow/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.session.user.id;

    const [currentUser, targetUser] = await Promise.all([
      UserModel.findById(currentUserId),
      UserModel.findById(userId)
    ]);

    if (!targetUser) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Retirer des listes
    if (currentUser.following) {
      currentUser.following = currentUser.following.filter(id => id !== userId);
      currentUser.followingCount = currentUser.following.length;
    }

    if (targetUser.followers) {
      targetUser.followers = targetUser.followers.filter(id => id !== currentUserId);
      targetUser.followersCount = targetUser.followers.length;
    }

    await Promise.all([currentUser.save(), targetUser.save()]);

    res.json({
      success: true,
      followersCount: targetUser.followersCount || 0,
      followingCount: currentUser.followingCount || 0
    });
  } catch (err) {
    console.error('❌ Erreur unfollow:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/social/favorite/:postId — Ajouter aux favoris
app.post('/api/social/favorite/:postId', requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.session.user.id;

    const user = await UserModel.findById(currentUserId);
    if (!user.favorites) user.favorites = [];

    if (!user.favorites.includes(postId)) {
      user.favorites.push(postId);
      await user.save();
    }

    res.json({ success: true, favoritesCount: user.favorites.length });
  } catch (err) {
    console.error('❌ Erreur favorite:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/social/unfavorite/:postId — Retirer des favoris
app.post('/api/social/unfavorite/:postId', requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.session.user.id;

    const user = await UserModel.findById(currentUserId);
    if (user.favorites) {
      user.favorites = user.favorites.filter(id => id !== postId);
      await user.save();
    }

    res.json({ success: true, favoritesCount: user.favorites?.length || 0 });
  } catch (err) {
    console.error('❌ Erreur unfavorite:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/social/favorites — Mes posts favoris
app.get('/api/social/favorites', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const user = await UserModel.findById(currentUserId);

    if (!user.favorites || user.favorites.length === 0) {
      return res.json({ posts: [] });
    }

    const favPosts = await PostModel.find({
      _id: { $in: user.favorites }
    }).sort({ createdAt: -1 }).lean();

    res.json({ posts: favPosts });
  } catch (err) {
    console.error('❌ Erreur get favorites:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/social/suggestions — Suggestions d'utilisateurs
app.get('/api/social/suggestions', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const currentUser = await UserModel.findById(currentUserId);

    // Trouver users avec le plus de followers, qu'on ne suit pas déjà
    const suggestions = await UserModel.find({
      _id: {
        $ne: currentUserId, // Pas soi-même
        $nin: currentUser.following || [] // Pas déjà suivis
      },
      isGuest: false // Pas les invités
    })
      .select('_id displayName bio avatar followersCount postsCount')
      .sort({ followersCount: -1, postsCount: -1, createdAt: -1 })
      .limit(5)
      .lean();

    res.json({ suggestions });
  } catch (err) {
    console.error('❌ Erreur suggestions:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/social/followers/:userId — Liste des followers
app.get('/api/social/followers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const followers = await UserModel.find({
      _id: { $in: user.followers || [] }
    }).select('_id displayName avatar bio followersCount').lean();

    res.json({ followers });
  } catch (err) {
    console.error('❌ Erreur followers:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/social/following/:userId — Liste des abonnements
app.get('/api/social/following/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const following = await UserModel.find({
      _id: { $in: user.following || [] }
    }).select('_id displayName avatar bio followersCount').lean();

    res.json({ following });
  } catch (err) {
    console.error('❌ Erreur following:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/social/feed — Feed intelligent (posts amis + suggestions)
app.get('/api/social/feed', async (req, res) => {
  try {
    const currentUserId = req.session?.user?.id;

    if (!currentUserId) {
      // User non connecté = tous les posts
      const allPosts = await PostModel.find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return res.json({ posts: allPosts, hasSuggestions: false });
    }

    const currentUser = await UserModel.findById(currentUserId);

    // Posts des amis (users suivis)
    const friendsPosts = await PostModel.find({
      userId: { $in: currentUser.following || [] }
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // Posts populaires (pour remplir)
    const popularPosts = await PostModel.find({
      userId: { $nin: [...(currentUser.following || []), currentUserId] }
    })
      .sort({ likes: -1, createdAt: -1 })
      .limit(20)
      .lean();

    // Mélanger intelligemment (amis en priorité)
    const allPosts = [...friendsPosts, ...popularPosts].slice(0, 50);

    res.json({
      posts: allPosts,
      hasSuggestions: friendsPosts.length > 5 // Afficher bannière si assez de posts amis
    });
  } catch (err) {
    console.error('❌ Erreur feed:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/social/profile — Mettre à jour son profil
app.put('/api/social/profile', requireAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    const { bio, avatar, displayName } = req.body;

    const user = await UserModel.findById(currentUserId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    if (bio !== undefined) user.bio = bio.substring(0, 200); // Max 200 chars
    if (avatar !== undefined) user.avatar = avatar.substring(0, 10); // Emoji uniquement
    if (displayName !== undefined) user.displayName = displayName.substring(0, 50);

    await user.save();

    // Mettre à jour session
    req.session.user.displayName = user.displayName;
    await new Promise((resolve, reject) => {
      req.session.save(err => err ? reject(err) : resolve());
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        displayName: user.displayName,
        bio: user.bio,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('❌ Erreur update profile:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Remove old routes mounting
// app.use("/api/auth", authRoutes);
app.use("/api", usersRoutes);
// Removed: app.use("/api/social", socialRoutes); — routes now inline above
// Debug : lister les routes enregistrées (utile pour vérifier les chemins)
function listRoutes() {
  const routes = [];
  app._router.stack.forEach(m => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).join(',');
      routes.push(`${methods.toUpperCase()} ${m.route.path}`);
    } else if (m.name === 'router' && m.handle && m.handle.stack) {
      m.handle.stack.forEach(r => {
        if (r.route && r.route.path) {
          const methods = Object.keys(r.route.methods).join(',');
          routes.push(`${methods.toUpperCase()} ${r.route.path}`);
        }
      });
    }
  });
  console.log('Paths enregistrées:\n' + routes.join('\n'));
}
listRoutes();

/// HEALTH
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Le serveur tourne sur le port ${PORT}`));

module.exports = app;
app.use('/api', (req, res, next) => {
  // Autoriser report sans login
  if (req.path.includes('/report')) return next();

  if (!req.session?.user) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
});