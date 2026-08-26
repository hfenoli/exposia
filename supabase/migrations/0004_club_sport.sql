-- ════════════════════════════════════════════════════════════════════════════
-- SPORT DU CLUB
-- ════════════════════════════════════════════════════════════════════════════
-- Un club = un sport, choisi à la première connexion. Le sport détermine dans
-- l'application le vocabulaire (joueur / nageur / athlète), les postes, les
-- formations, le tracé de l'aire de jeu et les types de visuels proposés —
-- natation et triathlon n'ayant ni « but » ni « composition », mais un chrono
-- et un podium.
--
-- La colonne est volontairement NULLABLE et sans valeur par défaut : `null`
-- signifie « pas encore choisi », ce qui déclenche l'écran de sélection. Les
-- clubs déjà inscrits le verront une fois, et choisiront Football en deux
-- secondes si c'est leur cas.
--
-- Sans cette migration l'application reste utilisable : le choix est alors
-- mémorisé dans le navigateur et le club retombe sur Football sur un autre
-- appareil (voir chooseSport() dans src/App.jsx).

alter table public.clubs add column if not exists sport text;

alter table public.clubs drop constraint if exists clubs_sport_check;
alter table public.clubs add constraint clubs_sport_check
  check (sport is null or sport in
    ('football','rugby','hockey','basketball','handball','natation','triathlon'));

-- Le club doit pouvoir écrire cette colonne : la migration 0002 a restreint
-- l'UPDATE aux colonnes légitimes, il faut donc y ajouter `sport`.
grant update (sport) on public.clubs to authenticated;

-- Optionnel — si vos clubs actuels sont tous des clubs de football et que vous
-- préférez leur épargner l'écran de choix, décommentez :
-- update public.clubs set sport = 'football' where sport is null;
