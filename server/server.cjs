require("dotenv").config();
const path = require("path");

// --- CHANGEMENT : garantir un chemin users.json utilisable en local ---
// si une variable USERS_FILE n'est pas fournie (ex: en dev), pointe par défaut
// vers le fichier server/users.json du repo.
process.env.USERS_FILE = process.env.USERS_FILE || path.join(__dirname, "users.json");

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const fsPromises = require("fs/promises");

const authRoutes = require("./routes/auth.cjs");
const usersRoutes = require("./routes/users.cjs");
const db = require("./db.cjs");
const requireAuth = require("./middleware/authMiddleware.cjs");


process.on("uncaughtException", err => console.error("❌ Exception non attrapée:", err));
process.on("unhandledRejection", err => console.error("❌ Rejection non faite:", err));

const app = express();

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

// CORS
// CORS — liste des origines autorisées
const allowedOrigins = [
  "https://moodsharing.netlify.app",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://127.0.0.1:5502",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://localhost:5502",
  "http://localhost:3000"
];

app.use(cors({
  origin: function (origin, callback) {
    // Autorise les requêtes server-side (no origin)
    if (!origin) return callback(null, true);

    // Origines de production précises
    const allowedHosts = [
      "https://moodsharing.netlify.app",
      "https://moodshare-7dd7.onrender.com"
    ];

    // Autorise localhost / 127.0.0.1 / ::1 sur n'importe quel port (dev)
    const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\d+)?$/;

    if (localhostRegex.test(origin) || allowedHosts.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ Bloqué par le CORS:", origin);
    return callback(new Error("Non accepté par le CORS"));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With']
}));

// DEBUG DEV ONLY: autorise toutes origines et credentials (ne pas laisser en prod)
app.use(require('cors')({
  origin: true,
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With']
}));
app.options('*', require('cors')());

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());

// Rate Limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
}));

/// POSTS STORAGE
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

const dataDir = path.join(__dirname, "data");
const postsFile = path.join(dataDir, "posts.json");

// Ensure dir exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

try {
  if (fs.existsSync(postsFile)) {
    posts = JSON.parse(fs.readFileSync(postsFile, "utf8"));
  }
} catch (err) {
  console.error("❌ Erreur lors du chargement des posts");
}

// ---- Ajout : STORIES STORAGE (placer AVANT app.get("/api/stories")) ----
let stories = [];
const storiesFile = path.join(dataDir, "stories.json");

try {
  if (fs.existsSync(storiesFile)) {
    stories = JSON.parse(fs.readFileSync(storiesFile, "utf8"));
  }
} catch (err) {
  console.error("❌ Erreur lors du chargement des stories:", err);
}

// === REPORTS STORAGE ===
let reports = [];
const reportsFile = path.join(dataDir, "reports.json");
try {
  if (fs.existsSync(reportsFile)) {
    reports = JSON.parse(fs.readFileSync(reportsFile, "utf8"));
  }
} catch (err) {
  console.error("❌ Erreur lors du chargement des signalements:", err);
}

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
      ...req.body,
      likes: 0,
      comments: [],
      createdAt: new Date().toISOString()
    };

    posts.unshift(newPost);
    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));
    try { sendSSE('new_post', newPost); } catch (e) { console.error('❌ Erreur SSE:', e); }

    res.status(201).json(newPost);

  } catch (err) {
    return res.status(400).json({ error: "Contenu invalide" });
  }
});

// --- COMMENTS ---
app.post("/api/posts/:id/comments", requireAuth, async (req, res) => {
  try {
    const post = posts.find(p => p.id == req.params.id);
    if (!post) return res.status(404).json({ error: "Post non trouvé" });

    const rawText = String(req.body.text || "").trim();
    if (!rawText) return res.status(400).json({ error: "Commentaire vide" });

    const cleanText = sanitizeText(rawText);

    const comment = {
      id: Date.now().toString(),
      text: cleanText,
      author: { id: req.user.id, username: req.user.username || req.user.name || 'user' },
      likes: 0,
      createdAt: new Date().toISOString()
    };

    post.comments = post.comments || [];
    post.comments.push(comment);

    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));
    try { sendSSE('post_update', post); } catch (e) { console.error('❌ Erreur SSE:', e); }

    res.status(201).json(comment);
  } catch (err) {
    console.error('❌ Erreur lors de la création du commentaire:', err);
    res.status(400).json({ error: 'Contenu invalide' });
  }
});

// Like a comment
app.post('/api/posts/:postId/comments/:commentId/like', requireAuth, async (req, res) => {
  try {
    const post = posts.find(p => p.id == req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post non trouvé' });
    post.comments = post.comments || [];
    const cm = post.comments.find(c => c.id == req.params.commentId);
    if (!cm) return res.status(404).json({ error: 'Commentaire non trouvé' });

    cm.likes = (cm.likes || 0) + 1;
    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));
    try { sendSSE('post_update', post); } catch (e) { console.error('❌ Erreur SSE:', e); }
    res.json(cm);
  } catch (err) { console.error('❌ Erreur de like du commentaire:', err); res.status(500).json({ error: 'Interne' }); }
});

app.post('/api/posts/:postId/comments/:commentId/unlike', requireAuth, async (req, res) => {
  try {
    const post = posts.find(p => p.id == req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post non trouvé' });
    post.comments = post.comments || [];
    const cm = post.comments.find(c => c.id == req.params.commentId);
    if (!cm) return res.status(404).json({ error: 'Commentaire non trouvé' });

    cm.likes = Math.max(0, (cm.likes || 0) - 1);
    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));
    try { sendSSE('post_update', post); } catch (e) { console.error('❌ Erreur SSE:', e); }
    res.json(cm);
  } catch (err) { console.error('❌ Erreur de suppression du like du commentaire:', err); res.status(500).json({ error: 'Interne' }); }
});

// Report a post or comment
app.post('/api/posts/:id/report', requireAuth, async (req, res) => {
  try {
    const targetPost = posts.find(p => p.id == req.params.id);
    if (!targetPost) return res.status(404).json({ error: 'Post non trouvé' });

    const { reason = '', commentId = null } = req.body;
    const report = {
      id: Date.now().toString(),
      reporter: { id: req.user.id, username: req.user.username || req.user.name || 'user' },
      postId: req.params.id,
      commentId,
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
app.post('/api/posts/:id/repost', requireAuth, async (req, res) => {
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
      comments: [],
      repostedFrom: orig.id,
      repostedBy: { id: req.user.id, username: req.user.username || req.user.name || 'user' },
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
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
// LIKE / UNLIKE
app.post("/api/posts/:id/like", async (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: "Post non trouvé" });

  post.likes++;
  // Persist posts
  try {
    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));
  } catch (err) {
    console.error('❌ Erreur de la sauvegarde des posts après le like:', err);
  }

  // Notify clients
  try { sendSSE('post_update', post); } catch (e) { console.error('❌ Erreur SSE:', e); }

  res.json(post);
});

app.post("/api/posts/:id/unlike", async (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: "Post non trouvé" });

  post.likes = Math.max(0, post.likes - 1);
  // Persist posts
  try {
    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));
  } catch (err) {
    console.error('❌ Erreur de la sauvegarde des posts après le unlike:', err);
  }

  // Notify clients
  try { sendSSE('post_update', post); } catch (e) { console.error('❌ Erreur SSE:', e); }

  res.json(post);
});

// ============================================================
// ADMIN MIDDLEWARE
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
// DELETE /api/admin/posts/:id — Suppression forcée d'un post
// ============================================================
app.delete('/api/admin/posts/:id', requireAdmin, async (req, res) => {
  try {
    const idx = posts.findIndex(p => p.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Post non trouvé' });

    const [deleted] = posts.splice(idx, 1);
    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));

    // Notifie les clients SSE
    try { sendSSE('post_deleted', { id: deleted.id }); } catch (e) { console.error('❌ Erreur SSE:', e); }

    console.log(`🗑️  [ADMIN] Post ${deleted.id} supprimé`);
    res.json({ ok: true, deleted: deleted.id });
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
    const post = posts.find(p => p.id == req.params.id);
    if (!post) return res.status(404).json({ error: 'Post non trouvé' });

    const { text, emoji, color, textColor } = req.body;

    // Sanitize les champs textuels
    if (text      !== undefined) post.text      = sanitizeText(String(text));
    if (emoji     !== undefined) post.emoji     = sanitizeText(String(emoji));
    if (color     !== undefined) post.color     = String(color).slice(0, 20);
    if (textColor !== undefined) post.textColor = String(textColor).slice(0, 20);
    post.editedAt = new Date().toISOString();

    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));
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

/// AUTH & USER ROUTES
app.use("/api/auth", (req, res, next) => {
  try {
    console.log("🔐 [Auth debug] %s %s Origine=%s Type de contenu=%s", req.method, req.originalUrl, req.headers.origin || 'none', req.headers['content-type']);
    // body est disponible grâce à express.json() plus haut
    // console.log("🔐 [AUTH DEBUG] body:", JSON.stringify(req.body));
  } catch (err) {
    console.error("🔐 [Auth Debug] Erreur pour afficher le body:", err);
  }
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api", usersRoutes);

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