 # Recherche de Limites Communales par Code Postal
 
 Cet outil web permet de rechercher et de visualiser les contours géographiques (limites administratives) des communes françaises à partir d'un ou plusieurs codes postaux. Il croise deux bases de données pour établir la correspondance et afficher les résultats sur une carte interactive.
 
 ## Fonctionnalités
 
 *   **Recherche par Code Postal :** Entrez un ou plusieurs codes postaux (séparés par des virgules) pour trouver les communes correspondantes.
 *   **Visualisation sur Carte :** Les limites des communes trouvées sont affichées et mises en surbrillance sur une carte interactive (basée sur Leaflet.js).
 *   **Liste des Résultats :** Affiche la liste des communes trouvées avec leur nom et leur code INSEE.
 *   **Gestion de Groupes :** Permet de cumuler les résultats de plusieurs recherches dans un "groupe" pour créer des sélections personnalisées.
 *   **Exportation GeoJSON :** Téléchargez les limites géographiques des communes issues d'une recherche ou d'un groupe au format GeoJSON.
 *   **Affichage des Coordonnées :** Visualisez et copiez directement le GeoJSON des communes sélectionnées.
 
 ## Comment ça marche ?
 
 L'application utilise une logique en deux temps pour répondre à une recherche :
 
 1.  **Correspondance Code Postal → Code INSEE :** L'application utilise le fichier `datanova.csv` comme une table de correspondance. Pour un code postal donné, elle extrait tous les codes INSEE des communes associées.
 2.  **Correspondance Code INSEE → Géométrie :** Une fois les codes INSEE obtenus, l'application parcourt le fichier `nacom.geojson` pour trouver les polygones (les limites communales) dont la propriété correspond à ces codes INSEE.
 3.  **Affichage :** Les géométries correspondantes sont ensuite affichées sur la carte.
 
 ## Installation et Lancement
 
 Pour des raisons de sécurité des navigateurs web (politique CORS), ce fichier `Index.html` ne peut pas charger les fichiers de données (`.geojson`, `.csv`) directement depuis votre système de fichiers. Il doit être servi par un serveur web local.
 
 Voici la méthode la plus simple si vous avez Python installé :
 
 1.  **Prérequis :** Assurez-vous que les fichiers suivants se trouvent dans le même répertoire :
     *   `Index.html`
     *   `nacom.geojson`
     *   `datanova.csv`
 
 2.  **Lancer le serveur :**
     *   Ouvrez un terminal (ou une invite de commande) dans le répertoire du projet.
     *   Exécutez la commande suivante :
         ```sh
         python -m http.server
         ```
     *   Si vous utilisez Python 2, la commande est `python -m SimpleHTTPServer`.
 
 3.  **Accéder à l'application :**
     *   Ouvrez votre navigateur web et rendez-vous à l'adresse : `http://localhost:8000`.
 
 L'application devrait maintenant être fonctionnelle.
 
 ## Utilisation
 
 1.  **Sélectionner la propriété INSEE :** Dans le panneau de droite, assurez-vous que le menu déroulant "Propriété du code INSEE" est bien réglé sur le champ qui contient le code INSEE dans votre fichier `nacom.geojson` (par exemple, `insee`, `code_insee`...).
 2.  **Rechercher :** Entrez un ou plusieurs codes postaux dans le champ de recherche, séparés par des virgules (ex: `75001, 92100`).
 3.  **Consulter les résultats :** Les communes correspondantes s'affichent sur la carte et dans la liste à droite.
 4.  **Grouper :** Utilisez les boutons "Ajouter au groupe" pour cumuler les résultats de différentes recherches.
 5.  **Exporter :** Le bouton "Télécharger résultats" permet de sauvegarder le GeoJSON de la dernière recherche. Le contenu de la zone de texte peut être copié pour sauvegarder le GeoJSON du groupe.
 
 ## Fichiers du Projet
 
 *   `Index.html` : Fichier principal contenant la structure de la page, le style CSS et le code JavaScript de l'application.
 *   `nacom.geojson` : Base de données géographique contenant les limites administratives des communes.
 *   `datanova.csv` : Base de données servant de table de correspondance entre les codes postaux, les noms de communes et les codes INSEE.
 
 ## Dépendances
 
 *   **Leaflet.js** : Une bibliothèque JavaScript open-source pour les cartes interactives. Elle est chargée directement depuis un CDN.