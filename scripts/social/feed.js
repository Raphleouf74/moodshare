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
    feedContainer.addEventListener('click', async (event) => {
        const likeBtn = event.target.closest('.likebtn');
        if (!likeBtn) return;

        const postCard = likeBtn.closest('.post');
        if (!postCard) return;

        const postId = postCard.dataset.id;
        if (!postId) return;

        await likePost(postId, likeBtn);
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