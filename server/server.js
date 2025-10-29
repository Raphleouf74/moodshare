import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import postsRoutes from "./routes/posts.js";
// import usersRoutes from "./routes/users.js";
import interactionsRoutes from "./routes/interactions.js";

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/api/posts", postsRoutes);
// app.use("/api/users", usersRoutes);
app.use("/api/interactions", interactionsRoutes);

// Exemple de base de données temporaire (en mémoire)
let posts = [
  { id: 1, username: "Raph", content: "Bienvenue sur MoodShare 💙", emoji: "😊", likes: 5, date: new Date() },
  { id: 2, username: "Alex", content: "J'adore ce projet !", emoji: "🔥", likes: 3, date: new Date() }
];

// 🟢 Route : récupérer tous les posts
app.get("/api/posts", (req, res) => {
  res.json(posts);
});

// ❤️ Route : liker un post
app.post("/api/posts/:id/like", (req, res) => {
  const post = posts.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).json({ message: "Post not found" });
  post.likes++;
  res.json(post);
});

// ➕ Route : créer un nouveau post
app.post("/api/posts", (req, res) => {
  const { username, content, emoji } = req.body;
  const newPost = { id: posts.length + 1, username, content, emoji, likes: 0, date: new Date() };
  posts.push(newPost);
  res.status(201).json(newPost);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ MoodShare API running on port ${PORT}`));