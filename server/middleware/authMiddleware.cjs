// middleware/authMiddleware.js (assure-toi que c'est exactement ça)
const jwtService = require('../services/jwt.cjs');
const userModel = require('../models/user.cjs');

module.exports = async (req, res, next) => {
    // Accept token from Authorization header or cookie (access_token)
    const auth = req.headers.authorization;
    let token = null;
    if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);
    else if (req.cookies && req.cookies.access_token) token = req.cookies.access_token;
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const payload = jwtService.verify(token);
        const user = await userModel.getById(payload.id);
        if (!user) return res.status(401).json({ message: 'Invalid token' });
        req.user = { id: user.id, username: user.username || user.display_name || user.email };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};
