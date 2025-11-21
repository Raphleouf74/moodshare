// middleware/authMiddleware.js (assure-toi que c'est exactement ça)
const jwt = require("jsonwebtoken");
const db = require("../db/db");

module.exports = {
    requireAuth: async (req, res, next) => {
        try {
            const token = req.cookies && req.cookies.access_token;
            if (!token) return res.status(401).json({ error: "Unauthorized" });

            const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            const userQ = await db.query("SELECT id, email, display_name FROM users WHERE id=$1", [payload.uid]);
            if (!userQ.rows.length) return res.status(401).json({ error: "Unauthorized" });

            req.user = userQ.rows[0];
            next();
        } catch (err) {
            return res.status(401).json({ error: "Unauthorized" });
        }
    }
};
