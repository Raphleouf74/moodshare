const express = require("express");
const router = express.Router();


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

module.exports = router;
