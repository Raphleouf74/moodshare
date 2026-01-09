# MoodShare

MoodShare est une application web qui permet aux utilisateurs d'exprimer leurs émotions et de partager leurs humeurs avec d'autres. L'application offre des fonctionnalités sociales, un mode hors ligne, un support multilingue et des options d'accessibilité.

## Fonctionnalités

- **Partage d'humeur** : Les utilisateurs peuvent créer des posts pour partager comment ils se sentent.
- **Interactions sociales** : Les utilisateurs peuvent aimer, commenter et interagir avec les posts des autres.
- **Mode hors ligne** : L'application fonctionne même sans connexion Internet grâce à un service worker qui gère la mise en cache des ressources.
- **Multilingue** : L'application prend en charge plusieurs langues, avec des traductions disponibles en anglais et en français.
- **Accessibilité** : Des fonctionnalités d'accessibilité sont intégrées pour garantir que l'application est utilisable par tous.

## Installation

1. Clonez le dépôt :
   ```
   git clone <URL_DU_DEPOT>
   ```
2. Accédez au répertoire du projet :
   ```
   cd MoodShare
   ```
3. Installez les dépendances du serveur :
   ```
   cd server
   npm install
   ```

## Utilisation

1. Démarrez le serveur :
   ```
   node server.cjs
   ```
2. Ouvrez `index.html` dans votre navigateur pour accéder à l'application.

## Structure du projet

- `index.html` : Page principale de l'application.
- `README.md` : Documentation du projet.
- `version.json` : Informations sur la version de l'application.
- `push.ps1` : Script PowerShell pour automatiser certaines tâches.
- `manifest.json` : Métadonnées de l'application web.
- `service-worker.js` : Service worker principal pour les fonctionnalités hors ligne.
- `scripts/` : Contient le code JavaScript de l'application, y compris les fonctionnalités sociales, hors ligne, de localisation et d'accessibilité.
- `server/` : Contient le code du serveur, y compris les routes et la gestion de la base de données.
- `styles/` : Contient les fichiers CSS pour le style de l'application.
- `assets/` : Contient les icônes et les images utilisées dans l'application.
- `tests/` : Contient les tests unitaires et de bout en bout pour l'application.

## Contribuer

Les contributions sont les bienvenues ! Veuillez soumettre une demande de tirage pour toute amélioration ou correction de bogue.

## License

Ce projet est sous licence MIT.