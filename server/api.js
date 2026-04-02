<<<<<<< HEAD

=======
>>>>>>> b9647a007683f23089e1a45c47a4fdac9815b1af
import express from 'express';
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        // Récupérer les moods depuis la base de données
        const moods = []; // Remplacer par la vraie logique
        res.json(moods);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;