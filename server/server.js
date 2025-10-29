const express = require('express');
const bodyParser = require('body-parser');
const postsRoutes = require('./routes/posts');
const usersRoutes = require('./routes/users');
const interactionsRoutes = require('./routes/interactions');



// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/interactions', interactionsRoutes);



import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Base temporaire de posts (en mémoire)
let posts = [
  { id: 1, username: "Raph", content: "Hello MoodShare 💙", emoji: "😊", likes: 3, date: new Date() },
  { id: 2, username: "TestUser", content: "Trop bien ce site !", emoji: "🔥", likes: 5, date: new Date() }
];

// ➕ ROUTE : récupérer tous les posts
app.get("/api/posts", (req, res) => {
  res.json(posts);
});

// ❤️ ROUTE : liker un post
app.post("/api/posts/:id/like", (req, res) => {
  const post = posts.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).json({ message: "Post not found" });
  post.likes++;
  res.json(post);
});

// ➕ ROUTE : créer un post
app.post("/api/posts", (req, res) => {
  const { username, content, emoji } = req.body;
  const newPost = {
    id: posts.length + 1,
    username,
    content,
    emoji,
    likes: 0,
    date: new Date()
  };
  posts.push(newPost);
  res.status(201).json(newPost);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MoodShare API running on ${PORT}`));
