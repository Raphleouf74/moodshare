import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import * as fs from 'fs/promises';  // Changement ici
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from './passport.js';  // Ajouter .js
import authRoutes from './routes/auth.js';  // Ajouter .js
process.on("uncaughtException", err => console.error("❌ Uncaught Exception:", err));
process.on("unhandledRejection", err => console.error("❌ Unhandled Rejection:", err));


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Stockage en mÃ©moire
let posts = [
  // Exemple de post
  {
    text: 'Bienvenue dans Moodshare ! Partagez dès maintenant votre mood depuis la section "Créer" !',
    color: '#00cfeb',
    date: '01/01/2025',
    emoji: '👋',
    ephemeral: false,
    expiresAt: null,
    id: 1
  }
];

// Charger les posts au dÃ©marrage
try {
  const data = await fs.readFile(path.join(__dirname, 'data', 'posts.json'), 'utf8');
  posts = JSON.parse(data);
  console.log('Posts chargés depuis le fichier');
} catch (error) {
  console.log(' Aucun fichier de posts trouvé, démarrage avec un tableau vide');
}

// Routes
app.get("/api/posts", (req, res) => {
  console.log('GET /api/posts');
  res.json(posts);
});

// Middleware de logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(` ${req.method} ${req.url} - Status: ${res.statusCode} - ${duration}ms`);
    if (req.method === 'POST') {
      console.log('Contenu recu:', req.body);
    }
  });
  next();
});

// Route posts avec logs
// Dans la route de crÃ©ation de post
app.post("/api/posts", async (req, res) => {
  console.log('Nouveau post reçu:', req.body);

  const newPost = {
    id: Date.now().toString(),
    ...req.body,
    likes: 0,
    comments: [],
    createdAt: new Date().toISOString()
  };

  posts.unshift(newPost);

  // Nettoyage des posts expirÃ©s
  posts = posts.filter(post => {
    if (!post.ephemeral || !post.expiresAt) return true;
    return new Date(post.expiresAt) > new Date();
  });

  // Si le post est Ã©phÃ©mÃ¨re, programmer sa suppression
  if (newPost.ephemeral && newPost.expiresAt) {
    const timeUntilExpiry = new Date(newPost.expiresAt) - new Date();
    setTimeout(async () => {  // Ajout du async ici
      posts = posts.filter(p => p.id !== newPost.id);
      // Sauvegarder aprÃ¨s suppression
      try {
        await fs.writeFile(  // Utilisation de writeFile au lieu de writeFileSync
          path.join(__dirname, 'data', 'posts.json'),
          JSON.stringify(posts, null, 2)
        );
        console.log('=Post éphémère supprimé, ID:', newPost.id);
      } catch (error) {
        console.error('Erreur sauvegarde après suppression:', error);
      }
    }, timeUntilExpiry);
  }

  // Sauvegarder dans le fichier
  try {
    await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    await fs.writeFile(
      path.join(__dirname, 'data', 'posts.json'),
      JSON.stringify(posts, null, 2)
    );
    console.log('Post sauvegardé avec succès, ID:', newPost.id);
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
  }

  res.status(201).json(newPost);
});

// Route like
app.post("/api/posts/:id/like", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ message: "Post non trouvÃ©" });

  post.likes = (post.likes || 0) + 1;
  res.json(post);
});

// === STORIES API ===
import fsSync from "fs";
const storiesDir = path.join(__dirname, "data");
const storiesFile = path.join(storiesDir, "stories.json");

// 🔧 Assure-toi que le dossier "data" existe
if (!fsSync.existsSync(storiesDir)) {
  fsSync.mkdirSync(storiesDir, { recursive: true });
  console.log("📁 Dossier 'data' créé.");
}

// Charger les stories existantes
function loadStories() {
  try {
    if (!fsSync.existsSync(storiesFile)) return [];
    const raw = fsSync.readFileSync(storiesFile, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("❌ Erreur lecture stories:", err);
    return [];
  }
}

// Sauvegarder les stories
function saveStories(stories) {
  try {
    fsSync.writeFileSync(storiesFile, JSON.stringify(stories, null, 2), "utf8");
  } catch (err) {
    console.error("❌ Erreur sauvegarde stories:", err);
  }
}

// GET toutes les stories valides (<24h)
app.get("/api/stories", (req, res) => {
  try {
    const now = new Date();
    const stories = loadStories().filter(s => new Date(s.expiresAt) > now);
    res.json(stories);
  } catch (err) {
    console.error("❌ Erreur /api/stories:", err);
    res.status(500).json({ error: "Erreur serveur stories" });
  }
});

// POST une nouvelle story
app.post("/api/stories", express.json(), (req, res) => {
  try {
    const { text, color, emoji } = req.body;
    if (!text) return res.status(400).json({ error: "Texte requis" });

    const stories = loadStories();

    // 🔧 Éviter les doublons exacts dans la même minute
    const nowIso = new Date().toISOString().slice(0, 16); // jusqu'à la minute
    const isDuplicate = stories.some(
      s => s.text === text && s.createdAt.slice(0, 16) === nowIso
    );

    if (isDuplicate) {
      console.log("⚠️ Story ignorée (doublon détecté).");
      return res.status(409).json({ error: "Story déjà reçue récemment" });
    }

    // ✅ Si pas de doublon, on crée la nouvelle story
    const story = {
      id: Date.now().toString(),
      text,
      color,
      emoji,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
    };

    stories.push(story);
    saveStories(stories);

    console.log("📸 Nouvelle story enregistrée:", story.id);
    res.status(201).json(story);

  } catch (err) {
    console.error("❌ Erreur POST /api/stories:", err);
    res.status(500).json({ error: "Impossible d’enregistrer la story" });
  }
});

// UNLIKE - Retire un like au post
app.post("/api/posts/:id/unlike", (req, res) => {
  const postId = req.params.id;

  // Trouver le post dans la base
  const post = posts.find(p => String(p.id) === String(postId));

  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  // Sécuriser : on empêche les likes négatifs
  if (!post.likes) {
    post.likes = 0;
  }

  if (post.likes > 0) {
    post.likes--;
  }

  // Retourner le post mis à jour
  return res.json({
    message: "Like removed",
    post
  });
});


// Nettoyage automatique toutes les heures
setInterval(() => {
  const now = new Date();
  const stories = loadStories().filter(s => new Date(s.expiresAt) > now);
  saveStories(stories);
}, 60 * 60 * 1000);


app.listen(PORT, () => console.log(` MoodShare API running on port ${PORT}`));

// server.js (CommonJS — remplace le contenu existant)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

// routes
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users"); // créé ci-dessous
const { requireAuth } = require("./middleware/authMiddleware");


// CORS config — adapte FRONTEND_URL à ton Netlify (ex: https://moodsharing.netlify.app)
const FRONTEND_URL = process.env.FRONTEND_URL || "https://moodsharing.netlify.app";
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Rate limit global (tweak)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", requireAuth, usersRoutes); // /api/users/me

// Option: serve static front from /public if you want
app.use(express.static(path.join(__dirname, "public")));

// default health
app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server ready on port", PORT));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);

