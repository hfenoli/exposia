-- ════════════════════════════════════════════════════════════════════════════
-- PERFORMANCE MOBILE · Vignettes des photos et médias
-- ════════════════════════════════════════════════════════════════════════════
--
-- PROBLÈME CORRIGÉ
-- Un navigateur décode une image à sa résolution native, quelle que soit la
-- taille à laquelle elle est affichée. Une photo de 2000×1500 occupe donc
-- ~12 Mo en mémoire (2000 × 1500 × 4 octets) même dans une vignette de 60 px.
-- Les grilles de l'app (photos d'un joueur, médiathèque, fonds disponibles)
-- affichaient les originaux : avec 25 photos et 20 médias on dépassait
-- largement ce qu'iOS Safari tolère, et l'onglet était tué — c'est l'écran
-- blanc rapporté sur téléphone.
--
-- L'app génère désormais une vignette (320 px, WebP) à l'import et l'affiche
-- partout où l'image n'est pas montrée en grand. L'original reste utilisé pour
-- le rendu du visuel et l'export.
--
-- COMPATIBILITÉ
-- Les lignes créées avant cette migration n'ont pas de vignette : l'app
-- retombe alors sur l'original (comportement d'avant, aucune régression).
-- Le bloc optionnel en fin de fichier permet de repérer ces lignes ; il
-- suffit de réimporter les images concernées pour qu'elles gagnent leur
-- vignette. Sans cette migration, l'app fonctionne aussi : l'insertion
-- détecte la colonne absente et réessaie sans elle.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.player_photos add column if not exists thumb_url text;
alter table public.media        add column if not exists thumb_url text;

-- La colonne doit être écrite par les clubs au même titre que `url`.
-- N'exécutez ces deux lignes que si vous aviez déjà restreint les GRANT sur
-- ces tables ; par défaut Supabase accorde l'insertion sur toute la ligne.
-- grant insert (thumb_url), update (thumb_url) on public.player_photos to authenticated;
-- grant insert (thumb_url), update (thumb_url) on public.media         to authenticated;


-- ── Optionnel · combien de lignes n'ont pas encore de vignette ──────────────
--
--   select 'player_photos' as source, count(*) filter (where thumb_url is null) as sans_vignette,
--          count(*) as total from public.player_photos
--   union all
--   select 'media', count(*) filter (where thumb_url is null), count(*) from public.media;
--
-- Ces lignes continuent d'afficher l'original : l'écran reste correct, il
-- consomme juste autant de mémoire qu'avant. Réimporter l'image la dote d'une
-- vignette. Il n'est pas possible de générer les vignettes manquantes en SQL,
-- le redimensionnement se fait dans le navigateur.
