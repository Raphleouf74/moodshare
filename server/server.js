import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let moods = []; // Pour commencer, juste en mémoire

app.get("/api/moods", (req, res) => res.json(moods));

app.post("/api/moods", (req, res) => {
    const { text, color, emoji } = req.body;
    const mood = { id: Date.now(), text, color, emoji };
    moods.push(mood);
    res.status(201).json(mood);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MoodShare API running on ${PORT}`));
