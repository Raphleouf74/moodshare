require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");

const authRoutes = require("./routes/auth.cjs");
const usersRoutes = require("./routes/users.cjs");
const db = require("./db/db.cjs");
const { requireAuth } = require("./middleware/authMiddleware.cjs");


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

// Répond explicitement aux préflight
app.options('*', cors());

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
    date: '01/01/2025',
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
  console.error("❌ Error loading posts");
}

// ---- Ajout : STORIES STORAGE (placer AVANT app.get("/api/stories")) ----
let stories = [];
const storiesFile = path.join(dataDir, "stories.json");

try {
  if (fs.existsSync(storiesFile)) {
    stories = JSON.parse(fs.readFileSync(storiesFile, "utf8"));
  }
} catch (err) {
  console.error("❌ Error loading stories:", err);
}

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
        console.error("❌ Error saving stories after purge:", err);
      });
    }

    res.json(active);
  } catch (err) {
    console.error("❌ Error getting stories:", err);
    res.status(500).json({ error: "Internal error" });
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
    throw new Error("Forbidden content detected");
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
      id: Date.now().toString(),
      ...req.body,
      likes: 0,
      comments: [],
      createdAt: new Date().toISOString()
    };

    posts.unshift(newPost);
    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));

    res.status(201).json(newPost);

  } catch (err) {
    return res.status(400).json({ error: "Invalid content" });
  }
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
      return res.status(400).json({ error: "Empty story" });
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

    // Répondre avec la story créée
    res.status(201).json(newStory);
  } catch (err) {
    console.error("❌ Error creating story:", err);
    res.status(400).json({ error: "Invalid content" });
  }
});

// LIKE / UNLIKE
app.post("/api/posts/:id/like", (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  post.likes++;
  res.json(post);
});

app.post("/api/posts/:id/unlike", (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });

  post.likes = Math.max(0, post.likes - 1);
  res.json(post);
});

/// AUTH & USER ROUTES
app.use("/api/auth", authRoutes);
app.use("/api", usersRoutes);

/// HEALTH
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
