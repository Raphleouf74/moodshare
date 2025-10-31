import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import * as fs from 'fs/promises';  // Changement ici
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from './passport';
import authRoutes from './routes/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Stockage en mémoire
let posts = [
  // Exemple de post
  {
    id: "1",
    content: "Bienvenue sur MoodShare !",
    likes: 0,
    comments: [],
    createdAt: new Date().toISOString(),
    ephemeral: false
  }
];

// Charger les posts au démarrage
try {
  const data = await fs.readFile(path.join(__dirname, 'data', 'posts.json'), 'utf8');
  posts = JSON.parse(data);
  console.log('✅ Posts chargés depuis le fichier');
} catch (error) {
  console.log('⚠️ Aucun fichier de posts trouvé, démarrage avec un tableau vide');
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
    console.log(`📝 ${req.method} ${req.url} - Status: ${res.statusCode} - ${duration}ms`);
    if (req.method === 'POST') {
      console.log('📦 Contenu reçu:', req.body);
    }
  });
  next();
});

// Route posts avec logs
// Dans la route de création de post
app.post("/api/posts", async (req, res) => {
  console.log('🆕 Nouveau post reçu:', req.body);

  const newPost = {
    id: Date.now().toString(),
    ...req.body,
    likes: 0,
    comments: [],
    createdAt: new Date().toISOString()
  };

  posts.unshift(newPost);

  // Nettoyage des posts expirés
  posts = posts.filter(post => {
    if (!post.ephemeral || !post.expiresAt) return true;
    return new Date(post.expiresAt) > new Date();
  });

  // Si le post est éphémère, programmer sa suppression
  if (newPost.ephemeral && newPost.expiresAt) {
    const timeUntilExpiry = new Date(newPost.expiresAt) - new Date();
    setTimeout(async () => {  // Ajout du async ici
      posts = posts.filter(p => p.id !== newPost.id);
      // Sauvegarder après suppression
      try {
        await fs.writeFile(  // Utilisation de writeFile au lieu de writeFileSync
          path.join(__dirname, 'data', 'posts.json'),
          JSON.stringify(posts, null, 2)
        );
        console.log('🗑️ Post éphémère supprimé, ID:', newPost.id);
      } catch (error) {
        console.error('❌ Erreur sauvegarde après suppression:', error);
      }
    }, timeUntilExpiry);
  } if (newPost.ephemeral && newPost.expiresAt) {
    const timeUntilExpiry = new Date(newPost.expiresAt) - new Date();
    setTimeout(() => {
      posts = posts.filter(p => p.id !== newPost.id);
      // Sauvegarder après suppression
      try {
        fs.writeFileSync(
          path.join(__dirname, 'data', 'posts.json'),
          JSON.stringify(posts, null, 2)
        );
        console.log('🗑️ Post éphémère supprimé, ID:', newPost.id);
      } catch (error) {
        console.error('❌ Erreur sauvegarde après suppression:', error);
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
    console.log('💾 Post sauvegardé avec succès, ID:', newPost.id);
  } catch (error) {
    console.error('❌ Erreur sauvegarde:', error);
  }

  res.status(201).json(newPost);
});

// Route like
app.post("/api/posts/:id/like", (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ message: "Post non trouvé" });

  post.likes = (post.likes || 0) + 1;
  res.json(post);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ MoodShare API running on port ${PORT}`));



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