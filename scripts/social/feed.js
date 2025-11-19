// scripts/social/feed.js
document.addEventListener("DOMContentLoaded", async () => {

    const feedContainer = document.getElementById('moodWall');
    const storiesList = document.querySelector('.stories-list');

    // Charger les stories au démarrage
    try {
        const resStories = await fetch("https://moodshare-7dd7.onrender.com/api/stories");
        if (!resStories.ok) throw new Error(`HTTP ${resStories.status}`);
        const stories = await resStories.json();

        // Nettoyage et affichage
        const storiesList = document.querySelector('.stories-list');
        if (!storiesList) return console.warn("❌ stories-list introuvable");

        storiesList.querySelectorAll('.story:not(.add-story)').forEach(s => s.remove());
        stories.forEach(story => addStoryToList(story));
    } catch (err) {
        console.error("❌ Erreur chargement stories:", err);
    }
    function showFeedback(type, message) {
        const feedback = document.createElement("div");
        feedback.className = `upload-feedback feedback-${type}`;

        // Choix des icônes selon le type
        const icons = {
            success: "check_circle",
            error: "error",
            warning: "warning",
            info: "info",
            remark: "chat_bubble",
            welcome: "celebration",
        };

        // Icône par défaut
        const icon = icons[type];

        feedback.innerHTML = `
    <span class="material-symbols-rounded">${icon}</span>
    ${message}
  `;

        document.body.appendChild(feedback);


        // Supprimer après animation
        if (icon === "warning") {
            feedback.style.animation = "slideInOut 30s ease forwards";
            setTimeout(() => {
                feedback.style.display = "none";
            }, 30000);
        } if (icon === "chat_bubble") {
            feedback.style.animation = "slideInOut 30s ease forwards";
            setTimeout(() => {
                feedback.style.display = "none";
            }, 30000);
        } else {
            feedback.style.animation = "slideInOut 3s ease forwards";
            setTimeout(() => {
                feedback.style.display = "none";
            }, 3000);
        }
    }



    // === Affichage des stories ===
    function addStoryToList(story) {
        const storyDiv = document.createElement('div');
        storyDiv.className = 'story';
        storyDiv.innerHTML = `<span>${story.emoji || '📸'}</span>`;
        storiesList.appendChild(storyDiv);

        storyDiv.addEventListener('click', () => openStoryViewer(story));
    }

    function openStoryViewer(story) {
        const viewer = document.createElement('div');
        viewer.className = 'story-viewer';
        viewer.innerHTML = `
    <div class="story-content" style="background:${story.color}">
      <span style="font-size:3rem">${story.emoji}</span>
      <p>${story.text}</p>
    </div>
  `;
        document.body.appendChild(viewer);
        setTimeout(() => viewer.remove(), 4000); // auto-close après 4s
    }


    // === Gestion des likes ===
    // Empêcher plusieurs likes par session
    // LIKE / DISLIKE (toggle avec mémoire locale)
document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".likebtn");
    if (!btn) return;

    const post = btn.closest(".post");
    const postId = post.dataset.id;

    const likeCount = post.querySelector(".like-count");

    // Récupération des likes déjà faits
    let likedPosts = JSON.parse(localStorage.getItem("likedPosts") || "[]");

    const alreadyLiked = likedPosts.includes(postId);

    try {
        // --- DISLIKE ---
        if (alreadyLiked) {
            const res = await fetch(`https://moodshare-7dd7.onrender.com/api/posts/${postId}/unlike`, {
                method: "POST"
            });

            if (!res.ok) throw new Error("Erreur serveur");

            likeCount.textContent = parseInt(likeCount.textContent) - 1;
            btn.classList.remove("liked");

            // Retirer de localStorage
            likedPosts = likedPosts.filter(id => id !== postId);
            localStorage.setItem("likedPosts", JSON.stringify(likedPosts));

            showFeedback("info", "Like retiré !");
            return;
        }

        // --- LIKE ---
        const res = await fetch(`https://moodshare-7dd7.onrender.com/api/posts/${postId}/like`, {
            method: "POST"
        });

        if (!res.ok) throw new Error("Erreur serveur");

        likeCount.textContent = parseInt(likeCount.textContent) + 1;

        btn.classList.add("liked");
        btn.style.animation = "likePop 0.3s ease";

        // Sauvegarde locale
        likedPosts.push(postId);
        localStorage.setItem("likedPosts", JSON.stringify(likedPosts));

        showFeedback("success", "Tu aimes ce post ❤️");
    } catch (err) {
        showFeedback("error", "Impossible de mettre à jour le like.");
        console.error(err);
    }
});



    async function likePost(postId, likeBtn) {
        try {
            const response = await fetch(`https://moodshare-7dd7.onrender.com/api/posts/${postId}/like`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const updated = await response.json();
            const countSpan = likeBtn.querySelector('.like-count');
            if (countSpan) countSpan.textContent = updated.likes || 0;

            likeBtn.classList.add('liked');
        } catch (error) {
            console.error('❌ Erreur like:', error);
        }
    }
});