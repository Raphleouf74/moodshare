// middleware/authMiddleware.js (assure-toi que c'est exactement ça)
const jwtService = require('../services/jwt.cjs');
const userModel = require('../models/user.cjs');

module.exports = async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });
    const token = auth.slice(7);
    try {
        const payload = jwtService.verify(token);
        const user = await userModel.getById(payload.id);
        if (!user) return res.status(401).json({ message: 'Invalid token' });
        req.user = { id: user.id, username: user.username };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};
