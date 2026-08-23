# Viziona — Studio visuel

## Migrations à appliquer sur Supabase

Deux migrations, à exécuter dans l'ordre depuis le SQL Editor Supabase.

### `0001_visuals_format.sql` — fonctionnel

Ajoute la colonne `visuals.format` pour le choix Story 9:16 / Post 4:5 /
Carré 1:1. Tant qu'elle n'est pas passée, l'app reste utilisable : la
sauvegarde détecte la colonne manquante et réécrit sans elle (le format
retombe sur Story au rechargement). Voir `writeVisual()` dans `src/App.jsx`.

### `0002_admin_and_club_privileges.sql` — sécurité, à appliquer en priorité

Ferme une élévation de privilèges : le droit d'UPDATE sur `clubs` portait sur
toute la ligne, donc n'importe quel compte connecté pouvait s'auto-approuver,
se passer en PREMIUM et lever son quota depuis la console du navigateur. La
migration restreint l'écriture aux colonnes légitimes (GRANT au niveau
colonne), déplace la liste des admins en base et fait passer les actions
d'administration par des fonctions `SECURITY DEFINER`.

Elle se termine par une section de vérification manuelle des politiques RLS
existantes : à lire, elle n'est pas automatisable.

Le code s'adapte si la migration n'est pas encore appliquée (repli sur
l'ancien chemin pour l'écran admin), mais l'application reste vulnérable tant
qu'elle ne l'est pas.

### `0003_image_thumbnails.sql` — performance mobile

Ajoute `thumb_url` sur `player_photos` et `media`. Les grilles affichaient les
images en pleine résolution : un navigateur les décode à leur taille native
quelle que soit la taille d'affichage, soit ~290 Mo de mémoire pour un club de
25 photos et 20 médias — largement de quoi faire tuer l'onglet par iOS Safari
(l'écran blanc sur téléphone). Avec les vignettes on tombe à ~13 Mo.

Les images importées avant la migration n'ont pas de vignette et retombent sur
l'original : pas de régression, mais pas de gain non plus tant qu'elles ne sont
pas réimportées. Sans la migration, l'insertion détecte la colonne absente et
réessaie sans elle.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
