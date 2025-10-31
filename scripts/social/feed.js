// scripts/social/feed.js

const feedContainer = document.getElementById('moodWall');

// Function to load posts from the server
export function initializeSocialFeatures() {
    loadPosts();
    setupInteractions();
}

async function loadPosts() {
    try {
        const API_URL = 'https://moodshare-7dd7.onrender.com/api/posts';
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const posts = await response.json();
        displayPosts(posts);
    } catch (error) {
        console.error('Erreur chargement posts:', error);
    }
}

function displayPosts(posts) {
    const wall = document.getElementById('moodWall');
    if (!wall) return;
    
    posts.forEach(post => {
        // Affichage de chaque post
        const postElement = createPostElement(post);
        wall.appendChild(postElement);
    });
}


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
            loadPosts(); // Reload posts to update likes
        }
    } catch (error) {
        console.error('Error liking post:', error);
    }
}

// Initial load of posts
loadPosts();