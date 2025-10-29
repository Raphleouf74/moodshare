// Ce fichier gère les commentaires sur les posts, y compris l'ajout et la suppression de commentaires.

const commentsSection = document.getElementById('commentsSection');
const commentInput = document.getElementById('commentInput');
const submitCommentButton = document.getElementById('submitCommentButton');

// Fonction pour afficher les commentaires
function displayComments(comments) {
    commentsSection.innerHTML = '';
    comments.forEach(comment => {
        const commentElement = document.createElement('div');
        commentElement.classList.add('comment');
        commentElement.innerText = comment.text;
        commentsSection.appendChild(commentElement);
    });
}

// Fonction pour ajouter un commentaire
function addComment() {
    const commentText = commentInput.value.trim();
    if (commentText) {
        const newComment = { text: commentText };
        // Ici, vous pouvez ajouter la logique pour envoyer le commentaire au serveur
        // Par exemple : sendCommentToServer(newComment);
        
        // Pour l'instant, ajoutons le commentaire à l'affichage localement
        displayComments([...getCommentsFromLocalStorage(), newComment]);
        commentInput.value = '';
    }
}

// Fonction pour récupérer les commentaires du stockage local
function getCommentsFromLocalStorage() {
    const comments = JSON.parse(localStorage.getItem('comments')) || [];
    return comments;
}

// Fonction pour initialiser les commentaires
function initComments() {
    const comments = getCommentsFromLocalStorage();
    displayComments(comments);
}

// Événement pour le bouton d'ajout de commentaire
submitCommentButton.addEventListener('click', addComment);

// Initialisation des commentaires lors du chargement de la page
document.addEventListener('DOMContentLoaded', initComments);
// ...existing code...
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#comments-form'); // adapter le sélecteur
  if (!form) return; // protège contre "Cannot read properties of null"
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // ...existing code...
  });
});
// ...existing code...