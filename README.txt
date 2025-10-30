
Projet: carte-simple (Leaflet) - Test Malaga
Contenu:
- index.html : page principale
- style.css  : styles
- app.js     : script principal (Leaflet + filtres)
- data/points.json : 20 points d'exemple
- fiches/*.html : 20 fiches descriptives correspondantes

Tester en local:
1. Télécharger et dézipper le fichier 'carte-simple.zip'.
2. Ouvrir un terminal dans le dossier 'carte-simple'.
3. Lancer un serveur local (nécessaire pour fetch() de points.json) :
   - Python 3: python -m http.server 8000
   - Node (si installé): npx http-server -p 8000
4. Ouvrir http://localhost:8000 dans ton navigateur.

Déployer:
- GitHub Pages / Netlify / Vercel : déposer le dossier et publier (pas de serveur nécessaire).

Personnalisation:
- Modifier data/points.json pour ajouter/éditer des points (max 100).
- Modifier fiches/*.html pour détailler chaque fiche.
- Changer style.css pour adapter le branding.
