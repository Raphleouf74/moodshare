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


process.on("uncaughtException", err => console.error("❌ Uncaught Exception:", err));
process.on("unhandledRejection", err => console.error("❌ Unhandled Rejection:", err));

const app = express();

// CORS
const FRONTEND_URL = process.env.FRONTEND_URL || "https://moodsharing.netlify.app";

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

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
    id: 1
  }
];

const dataDir = path.join(__dirname, "data");
const postsFile = path.join(dataDir, "posts.json");

// Ensure dir exists
if (!fs.existsSync(dataDir)){
  fs.mkdirSync(dataDir, { recursive: true });
}

try {
  if (fs.existsSync(postsFile)) {
    posts = JSON.parse(fs.readFileSync(postsFile, "utf8"));
  }
} catch (err) {
  console.error("❌ Error loading posts");
}

// GET POSTS
app.get("/api/posts", (req, res) => {
  res.json(posts);
});

// CREATE POST
app.post("/api/posts", async (req, res) => {
  const newPost = {
    id: Date.now().toString(),
    ...req.body,
    likes: 0,
    comments: [],
    createdAt: new Date().toISOString()
  };

  posts.unshift(newPost);

  try {
    await fsPromises.writeFile(postsFile, JSON.stringify(posts, null, 2));
  } catch (err) {
    console.log("❌ Error save posts:", err);
  }

  res.status(201).json(newPost);
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
app.use("/api/users", requireAuth, usersRoutes);

/// HEALTH
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
