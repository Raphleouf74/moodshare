const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jwtService = require('../services/jwt.cjs');
const validator = require("validator");
const db = require("../db.cjs");
const router = express.Router();
const userModel = require('../models/user.cjs');


const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/"
};

function createAccessToken(uid) {
  return jwtService.sign({ id: uid }, '15m');
}
function createRefreshToken(uid) {
  return jwtService.sign({ id: uid }, '30d');
}

// REGISTER
router.post("/register", express.json(), async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !validator.isEmail(email) || !validator.isLength(password, { min: 8 })) {
      return res.status(400).json({ error: "Email invalide ou mot de passe trop court (min 8)" });
    }

    const existing = await db.query("SELECT id FROM users WHERE email=$1", [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: "Email déjà utilisé" });

    const password_hash = await bcrypt.hash(password, 12);
    const insert = await db.query(
      "INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id, email, display_name",
      [email.toLowerCase(), password_hash, displayName || ""]
    );
    res.status(201).json({ success: true, user: insert.rows[0] });
  } catch (err) {
    console.error('🔐 auth register error:', err);
    // si erreur de connexion pg
    if (err.code === 'ECONNREFUSED' || (err.message && err.message.includes('No database pool'))) {
      return res.status(503).json({ error: 'Database unreachable' });
    }
    return res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

// LOGIN
router.post("/login", express.json(), async (req, res) => {
  try {
    const { email, password, displayName, username } = req.body;
    // require password and at least one identifier (email or displayName/username)
    if (!password || (!email && !displayName && !username)) return res.status(400).json({ error: "Champs manquants" });

    let userQ;
    if (email) {
      userQ = await db.query("SELECT * FROM users WHERE email=$1", [email.toLowerCase()]);
    } else {
      const name = (displayName || username).toString();
      userQ = await db.query("SELECT * FROM users WHERE display_name=$1", [name]);
    }
    if (!userQ.rows.length) return res.status(401).json({ error: "Identifiants invalides" });

    const user = userQ.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Identifiants invalides" });

    const accessToken = createAccessToken(user.id);
    const refreshToken = createRefreshToken(user.id);

    // Save refresh token (rotate later)
    await db.query("UPDATE users SET refresh_token=$1 WHERE id=$2", [refreshToken, user.id]);

    res.cookie("access_token", accessToken, { ...COOKIE_OPTIONS, maxAge: 1000 * 60 * 15 });
    res.cookie("refresh_token", refreshToken, { ...COOKIE_OPTIONS, maxAge: 1000 * 60 * 60 * 24 * 30 });

    res.json({
      success: true,
      token: accessToken,
      user: { id: user.id, email: user.email, displayName: user.display_name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// REFRESH
router.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies && req.cookies.refresh_token;
    if (!token) return res.status(401).json({ error: "No token" });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const userQ = await db.query("SELECT * FROM users WHERE id=$1", [payload.uid]);
    if (!userQ.rows.length) return res.status(401).json({ error: "Utilisateur inexistant" });

    const user = userQ.rows[0];
    if (user.refresh_token !== token) return res.status(401).json({ error: "Token invalide" });

    // rotate
    const newRefresh = createRefreshToken(user.id);
    await db.query("UPDATE users SET refresh_token=$1 WHERE id=$2", [newRefresh, user.id]);

    const newAccess = createAccessToken(user.id);

    res.cookie("access_token", newAccess, { ...COOKIE_OPTIONS, maxAge: 1000 * 60 * 15 });
    res.cookie("refresh_token", newRefresh, { ...COOKIE_OPTIONS, maxAge: 1000 * 60 * 60 * 24 * 30 });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Refresh invalide" });
  }
});

// LOGOUT
router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies && req.cookies.refresh_token;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        await db.query("UPDATE users SET refresh_token=NULL WHERE id=$1", [payload.uid]);
      } catch (e) { }
    }
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- Ajout / guest (déjà présent si tu l'as ajouté) ---
router.post('/guest', async (req, res) => {
  try {
    const guest = await userModel.createGuestUser();
    const token = `guest_${guest.id}`;
    res.json({ user: guest, token });
  } catch (err) {
    console.error('❌ Error creating guest user:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});
  

module.exports = router;