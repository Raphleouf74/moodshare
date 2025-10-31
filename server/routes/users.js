const express = require('express');
const router = express.Router();

// retourne l'utilisateur connecté (session)
router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(req.user);
});

// met à jour préférences / affichage du profil (stub : persister en DB en prod)
router.put('/me', express.json(), (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const updates = req.body || {};
  const user = Object.assign({}, req.user, updates);
  // Met à jour la session afin que fetch /api/users/me retourne les nouveaux champs
  req.login && req.login(user, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to update session' });
    return res.json(user);
  }) || res.json(user);
});

module.exports = router;
