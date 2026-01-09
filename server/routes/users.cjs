const express = require("express");
const router = express.Router();
const userModel = require('../models/user.cjs');
const authMiddleware = require('../middleware/authMiddleware.cjs');


// GET /api/users/me
router.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  res.json(req.user);
});

// PUT /api/users/me  -> mise à jour du profil (persister en DB)
router.put("/me", express.json(), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const updates = req.body || {};

  try {
    // exemple: autoriser update display_name uniquement pour l'instant
    const allowed = {};
    if (typeof updates.display_name === "string") allowed.display_name = updates.display_name;

    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ error: "Aucune mise à jour valide fournie" });
    }

    const q = await db.query(
      "UPDATE users SET display_name = $1 WHERE id = $2 RETURNING id, email, display_name",
      [allowed.display_name, req.user.id]
    );

    return res.json(q.rows[0]);
  } catch (err) {
    console.error("Error update /api/users/me", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get('/users/recommended', async (req, res) => {
  const list = await userModel.recommended(6);
  res.json(list.map(u => ({ id: u.id, username: u.username, avatar: u.avatar, bio: u.bio })));
});

router.get('/users/:id', async (req, res) => {
  const u = await userModel.getById(req.params.id);
  if (!u) return res.status(404).json({ message: 'Not found' });
  res.json({ id: u.id, username: u.username, avatar: u.avatar, bio: u.bio });
});

router.patch('/users/:id', authMiddleware, express.json(), async (req, res) => {
  const { id } = req.params;
  if (!req.user || req.user.id !== id) return res.status(403).json({ message: 'Forbidden' });
  const patch = {};
  if (req.body.avatar !== undefined) patch.avatar = req.body.avatar;
  if (req.body.bio !== undefined) patch.bio = req.body.bio;
  if (req.body.settings !== undefined) patch.settings = req.body.settings;
  const updated = await userModel.update(id, patch);
  res.json({ id: updated.id, username: updated.username, avatar: updated.avatar, bio: updated.bio });
});

module.exports = router;
