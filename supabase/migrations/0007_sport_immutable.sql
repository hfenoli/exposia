-- ════════════════════════════════════════════════════════════════════════════
-- SPORT · Un sport par club, fixé une fois pour toutes
-- ════════════════════════════════════════════════════════════════════════════
--
-- POURQUOI
-- Le sport détermine les postes, les formations, le vocabulaire et les types
-- de visuels. En changer après coup laisse derrière lui un effectif dont les
-- postes n'existent plus dans la nouvelle discipline, et des visuels bâtis sur
-- des gabarits qui ne s'appliquent plus. Le choix est donc définitif.
--
-- CE QUI RESTE POSSIBLE
-- - Le renseigner quand il est encore vide (première connexion).
-- - Le corriger en tant qu'administrateur, pour rattraper une erreur de saisie
--   d'un club.
--
-- L'interface n'affiche plus de sélecteur après la création, mais un appel
-- direct à l'API la contournerait : la règle est donc appliquée ici.
-- ════════════════════════════════════════════════════════════════════════════


create or replace function public.clubs_sport_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Renseigner un sport encore vide reste autorisé : c'est le choix initial.
  if old.sport is null then
    return new;
  end if;

  -- Valeur inchangée : rien à contrôler. `is distinct from` couvre les NULL.
  if new.sport is not distinct from old.sport then
    return new;
  end if;

  -- Les administrateurs peuvent corriger une erreur de saisie.
  if public.is_app_admin() then
    return new;
  end if;

  raise exception 'Le sport du club ne peut plus être modifié (actuellement : %)', old.sport
    using errcode = '42501';
end;
$$;

drop trigger if exists clubs_sport_lock on public.clubs;
create trigger clubs_sport_lock
  before update of sport on public.clubs
  for each row execute function public.clubs_sport_immutable();


-- ── Contrôle ────────────────────────────────────────────────────────────────
-- Depuis un compte club (pas depuis le SQL Editor, qui est administrateur),
-- la requête suivante doit échouer :
--
--   update public.clubs set sport = 'rugby' where id = '<son club>';
--
-- Et depuis le SQL Editor, en tant qu'administrateur, la même requête doit
-- passer — c'est ainsi qu'on corrige le sport d'un club qui s'est trompé.
