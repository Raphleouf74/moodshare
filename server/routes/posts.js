import express from "express";
const router = express.Router();
const { getPosts, createPost, updatePost, deletePost } = require('../controllers/postsController');

// Route pour obtenir tous les posts
router.get('/', async (req, res) => {
    try {
        const posts = await getPosts();
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération des posts' });
    }
});

// Route pour créer un nouveau post
router.post('/', async (req, res) => {
    const { mood, color, emoji } = req.body;
    try {
        const newPost = await createPost(mood, color, emoji);
        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la création du post' });
    }
});

// Route pour mettre à jour un post existant
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { mood, color, emoji } = req.body;
    try {
        const updatedPost = await updatePost(id, mood, color, emoji);
        res.status(200).json(updatedPost);
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la mise à jour du post' });
    }
});

// Route pour supprimer un post
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await deletePost(id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la suppression du post' });
    }
});

module.exports = router;

// server/routes/posts.js


let posts = [
  { id: 1, username: "Raph", content: "Bienvenue sur MoodShare 💙", emoji: "😊", likes: 5, date: new Date() },
  { id: 2, username: "Alex", content: "J'adore ce projet !", emoji: "🔥", likes: 3, date: new Date() }
];

router.get("/", (req, res) => res.json(posts));

router.post("/", (req, res) => {
  const { username, content, emoji } = req.body;
  const newPost = { id: posts.length + 1, username, content, emoji, likes: 0, date: new Date() };
  posts.push(newPost);
  res.status(201).json(newPost);
});

router.post("/:id/like", (req, res) => {
  const post = posts.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).json({ message: "Post not found" });
  post.likes++;
  res.json(post);
});

export default router;
