// middleware/authMiddleware.js (assure-toi que c'est exactement ça)
const jwt = require("jsonwebtoken");
const db = require("../db/db.cjs");

module.exports.requireAuth = (req, res, next) => {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No token" });

    try {
        const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = { id: payload.uid };
        next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
};
