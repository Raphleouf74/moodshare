const wall = document.getElementById("moodWall");
const postBtn = document.getElementById("postMoodBtn");
const modal = document.getElementById("postModal");
const submitBtn = document.getElementById("submitMood");

postBtn.addEventListener("click", () => modal.classList.toggle("hidden"));

submitBtn.addEventListener("click", async () => {
    const text = document.getElementById("moodInput").value.trim();
    const color = document.getElementById("moodColor").value;
    const emoji = document.getElementById("moodEmoji").value;

    if (!text) return alert("Écris quelque chose !");

    const newMood = { text, color, emoji, date: Date.now() };

    // Affichage instantané
    displayMood(newMood);

    // Envoi au backend
    await fetch("https://ton-backend.onrender.com/api/moods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMood)
    });

    modal.classList.add("hidden");
    document.getElementById("moodInput").value = "";
});

function displayMood(mood) {
    const div = document.createElement("div");
    div.className = "mood-card";
    div.style.background = mood.color;
    div.innerHTML = `${mood.emoji} ${mood.text}`;
    wall.prepend(div);
}

// Chargement initial
(async () => {
    const res = await fetch("https://ton-backend.onrender.com/api/moods");
    const moods = await res.json();
    moods.reverse().forEach(displayMood);
})();
