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

// Function to create a post element
function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.innerHTML = `
        <div class="post-header">
            <span class="post-username">${post.username}</span>
            <span class="post-date">${new Date(post.date).toLocaleString()}</span>
        </div>
        <div class="post-content">
            <p>${post.content}</p>
            <span class="post-emoji">${post.emoji}</span>
        </div>
        <div class="post-actions">
            <button class="like-button" data-id="${post.id}">❤️ ${post.likes}</button>
            <button class="comment-button" data-id="${post.id}">💬 Commenter</button>
        </div>
    `;
    return postDiv;
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