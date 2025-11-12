import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:8888', 'https://votre-site.netlify.app'],
  credentials: true
}));
app.use(bodyParser.json());

// Stockage en mémoire
let posts = [];

// Charger les posts au démarrage
try {
  const data = await fs.readFile(path.join(__dirname, 'data', 'posts.json'), 'utf8');
  posts = JSON.parse(data);
  console.log('✅ Posts chargés depuis le fichier');
} catch (error) {
  console.log('⚠️ Aucun fichier de posts trouvé');
}

// Middleware de logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📝 ${req.method} ${req.url} - Status: ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Routes posts (protégées)
app.get("/api/posts", async (req, res) => {
  try {
    // Nettoyer les posts expirés
    const now = new Date();
    posts = posts.filter(post => {
      if (!post.ephemeral || !post.expiresAt) return true;
      return new Date(post.expiresAt) > now;
    });

    // Sauvegarder après nettoyage
    await fs.writeFile(
      path.join(__dirname, 'data', 'posts.json'),
      JSON.stringify(posts, null, 2)
    );

    res.json(posts);
  } catch (error) {
    console.error('Erreur récupération posts:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.post("/api/posts", async (req, res) => {
  try {
    console.log('🆕 Nouveau post reçu:', req.body);

    const newPost = {
      id: Date.now().toString(),
      userId: req.userId,
      ...req.body,
      likes: 0,
      comments: [],
      createdAt: new Date().toISOString()
    };

    posts.unshift(newPost);

    // Si le post est éphémère, programmer sa suppression
    if (newPost.ephemeral && newPost.expiresAt) {
      const timeUntilExpiry = new Date(newPost.expiresAt) - new Date();
      if (timeUntilExpiry > 0) {
        setTimeout(async () => {
          posts = posts.filter(p => p.id !== newPost.id);
          try {
            await fs.writeFile(
              path.join(__dirname, 'data', 'posts.json'),
              JSON.stringify(posts, null, 2)
            );
            console.log('🗑️ Post éphémère supprimé, ID:', newPost.id);
          } catch (error) {
            console.error('❌ Erreur sauvegarde après suppression:', error);
          }
        }, timeUntilExpiry);
      }
    }

    // Sauvegarder
    await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    await fs.writeFile(
      path.join(__dirname, 'data', 'posts.json'),
      JSON.stringify(posts, null, 2)
    );

    console.log('💾 Post sauvegardé avec succès, ID:', newPost.id);
    res.status(201).json(newPost);
  } catch (error) {
    console.error('❌ Erreur création post:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route like
app.post("/api/posts/:id/like", async (req, res) => {
  try {
    const post = posts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ message: "Post non trouvé" });

    post.likes = (post.likes || 0) + 1;

    await fs.writeFile(
      path.join(__dirname, 'data', 'posts.json'),
      JSON.stringify(posts, null, 2)
    );

    res.json(post);
  } catch (error) {
    console.error('Erreur like:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour récupérer les posts d'un utilisateur
app.get("/api/users/:userId/posts", async (req, res) => {
  try {
    const userPosts = posts.filter(p => p.userId === req.params.userId);
    res.json(userPosts);
  } catch (error) {
    console.error('Erreur récupération posts utilisateur:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route santé
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
app.listen(PORT, () => {
  console.log(`✅ MoodShare API running on port ${PORT}`);
  console.log(`🔐 Authentication enabled`);
});