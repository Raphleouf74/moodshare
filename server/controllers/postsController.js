export async function getPosts() {
    // Exemple : récupérer depuis une DB ou fichier
    return []; // remplacer par la logique réelle
}

export async function createPost(mood, color, emoji) {
    // créer et retourner le post créé
    return { id: Date.now().toString(), mood, color, emoji };
}

export async function updatePost(id, mood, color, emoji) {
    // mettre à jour et retourner le post mis à jour
    return { id, mood, color, emoji };
}

export async function deletePost(id) {
    // supprimer le post (ne rien retourner ou true)
    return;
}