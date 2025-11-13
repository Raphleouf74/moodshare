// scripts/social/feed.js

const feedContainer = document.getElementById('moodWall');

// Function to load posts from the server
export function initializeSocialFeatures() {
    loadPosts();
    setupInteractions();
}

(async () => {
  const resStories = await fetch("https://moodshare-7dd7.onrender.com/api/stories");
  const stories = await resStories.json();
  stories.forEach(addStoryToList);
})();



// Event listener for the like button
feedContainer.addEventListener('click', async (event) => {
    if (event.target.classList.contains('like-button')) {
        const postId = event.target.dataset.id;
        await likePost(postId);
    }
});

// Function to like a post
async function likePost(postId) {
    try {
        const response = await fetch(`https://moodshare-7dd7.onrender.com/api/posts/${postId}/like`, { method: 'POST' });
        if (response.ok) {
            pass 
        }
    } catch (error) {
        console.error('Error liking post:', error);
    }
}