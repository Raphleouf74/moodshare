// scripts/social/posts.js

const posts = [];

// Fonction pour créer un nouveau post
function createPost(content, mood, emoji) {
    const post = {
        id: Date.now(),
        content: content,
        mood: mood,
        emoji: emoji,
        createdAt: new Date(),
    };
    posts.push(post);
    savePostsToLocalStorage();
    return post;
}

// Fonction pour supprimer un post
function deletePost(postId) {
    const index = posts.findIndex(post => post.id === postId);
    if (index !== -1) {
        posts.splice(index, 1);
        savePostsToLocalStorage();
    }
}

// Fonction pour récupérer les posts depuis le stockage local
function loadPostsFromLocalStorage() {
    const storedPosts = localStorage.getItem('posts');
    if (storedPosts) {
        return JSON.parse(storedPosts);
    }
    return [];
}

// Fonction pour sauvegarder les posts dans le stockage local
function savePostsToLocalStorage() {
    localStorage.setItem('posts', JSON.stringify(posts));
}

// Initialiser les posts depuis le stockage local
function initPosts() {
    const loadedPosts = loadPostsFromLocalStorage();
    loadedPosts.forEach(post => posts.push(post));
}

// Appeler initPosts lors du chargement du script
initPosts();