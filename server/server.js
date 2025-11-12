import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import * as fs from 'fs/promises';  // Changement ici
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from './passport.js';  // Ajouter .js
import authRoutes from './routes/auth.js';  // Ajouter .js

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
    text: 'Bienvenue dans Moodshare ! Partagez dÃ¨s maintenant votre mood depuis la section "CrÃ©er" !',
    color: '#00cfeb',
    emoji: 'ðŸ‘‹',
    ephemeral: false,
    expiresAt: null,
    id: 1
  }
];

// Charger les posts au dÃ©marrage
try {
  const data = await fs.readFile(path.join(__dirname, 'data', 'posts.json'), 'utf8');
  posts = JSON.parse(data);
  console.log('âœ… Posts chargÃ©s depuis le fichier');
} catch (error) {
  console.log('âš ï¸ Aucun fichier de posts trouvÃ©, dÃ©marrage avec un tableau vide');
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
    console.log(`ðŸ“ ${req.method} ${req.url} - Status: ${res.statusCode} - ${duration}ms`);
    if (req.method === 'POST') {
      console.log('ðŸ“¦ Contenu reÃ§u:', req.body);
    }
  });
  next();
});

// Route posts avec logs
// Dans la route de crÃ©ation de post
app.post("/api/posts", async (req, res) => {
  console.log('ðŸ†• Nouveau post reÃ§u:', req.body);

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
        console.log('ðŸ—‘ï¸ Post Ã©phÃ©mÃ¨re supprimÃ©, ID:', newPost.id);
      } catch (error) {
        console.error('âŒ Erreur sauvegarde aprÃ¨s suppression:', error);
      }
    }, timeUntilExpiry);
  } if (newPost.ephemeral && newPost.expiresAt) {
    const timeUntilExpiry = new Date(newPost.expiresAt) - new Date();
    setTimeout(() => {
      posts = posts.filter(p => p.id !== newPost.id);
      // Sauvegarder aprÃ¨s suppression
      try {
        fs.writeFileSync(
          path.join(__dirname, 'data', 'posts.json'),
          JSON.stringify(posts, null, 2)
        );
        console.log('ðŸ—‘ï¸ Post Ã©phÃ©mÃ¨re supprimÃ©, ID:', newPost.id);
      } catch (error) {
        console.error('âŒ Erreur sauvegarde aprÃ¨s suppression:', error);
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
    console.log('ðŸ’¾ Post sauvegardÃ© avec succÃ¨s, ID:', newPost.id);
  } catch (error) {
    console.error('âŒ Erreur sauvegarde:', error);
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
const storiesFile = path.join(__dirname, "data/stories.json");

// Charger les stories existantes
function loadStories() {
  if (!fs.existsSync(storiesFile)) return [];
  return JSON.parse(fs.readFileSync(storiesFile, "utf8"));
}

// Sauvegarder les stories
function saveStories(stories) {
  fs.writeFileSync(storiesFile, JSON.stringify(stories, null, 2), "utf8");
}

// GET toutes les stories valides (<24h)
app.get("/api/stories", (req, res) => {
  const now = new Date();
  const stories = loadStories().filter(s => new Date(s.expiresAt) > now);
  res.json(stories);
});

// POST une nouvelle story
app.post("/api/stories", express.json(), (req, res) => {
  const { text, color, emoji } = req.body;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const story = {
    id: Date.now().toString(),
    text,
    color,
    emoji,
    createdAt: new Date().toISOString(),
    expiresAt
  };

  const stories = loadStories();
  stories.push(story);
  saveStories(stories);

  res.json(story);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` MoodShare API running on port ${PORT}`));



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