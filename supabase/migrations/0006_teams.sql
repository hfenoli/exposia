-- ════════════════════════════════════════════════════════════════════════════
-- ÉQUIPES · Un club peut gérer plusieurs équipes (juniors, seniors, féminines…)
-- ════════════════════════════════════════════════════════════════════════════
--
-- CE QUI CHANGE
-- Jusqu'ici tout était rattaché au club : un compte = un effectif. Cette
-- migration introduit une table `teams` et rattache l'effectif et les visuels
-- à une équipe.
--
-- CE QUI NE CHANGE PAS
-- La médiathèque, le logo, les couleurs, le thème et le sport restent au
-- niveau du club : toutes les équipes partagent l'identité visuelle, et le
-- sport reste unique par club.
--
-- COMPATIBILITÉ
-- Chaque club existant reçoit une équipe par défaut, à laquelle tous ses
-- joueurs et tous ses visuels sont rattachés. Un club qui n'utilise qu'une
-- équipe retrouve exactement le comportement d'avant.
--
-- ⚠️ À exécuter APRÈS le déploiement du code. Tant qu'elle n'est pas passée,
--    l'application fonctionne sans équipes (repli intégré).
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Table des équipes ────────────────────────────────────────────────────
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists teams_club_id_idx on public.teams(club_id);

alter table public.teams enable row level security;

-- Même règle que les autres tables rattachées à un club : on ne voit que les
-- équipes des clubs qu'on possède, et seulement si le club est approuvé.
drop policy if exists teams_own on public.teams;
create policy teams_own on public.teams
  for all to authenticated
  using      (exists (select 1 from public.clubs c
                      where c.id = teams.club_id
                        and c.user_id = auth.uid()
                        and c.approved = true))
  with check (exists (select 1 from public.clubs c
                      where c.id = teams.club_id
                        and c.user_id = auth.uid()
                        and c.approved = true));

-- L'écran d'administration doit pouvoir compter les équipes de chaque club.
drop policy if exists teams_admin_select_all on public.teams;
create policy teams_admin_select_all on public.teams
  for select to authenticated
  using (public.is_app_admin());


-- ── 2. Rattachement de l'effectif et des visuels ────────────────────────────
-- on delete set null : supprimer une équipe ne détruit ni les joueurs ni les
-- visuels. Ils se retrouvent sans équipe et sont récupérés par l'équipe par
-- défaut au chargement suivant, plutôt que de disparaître sans prévenir.
alter table public.players add column if not exists team_id uuid
  references public.teams(id) on delete set null;
alter table public.visuals add column if not exists team_id uuid
  references public.teams(id) on delete set null;

create index if not exists players_team_id_idx on public.players(team_id);
create index if not exists visuals_team_id_idx on public.visuals(team_id);

-- Pas de GRANT au niveau colonne ici : contrairement à `clubs`, les tables
-- players et visuals n'ont jamais été restreintes colonne par colonne par la
-- migration 0002. Elles conservent leurs droits au niveau table.


-- ── 3. Une équipe par défaut pour chaque club existant ──────────────────────
insert into public.teams (club_id, name)
select c.id, 'Équipe première'
from public.clubs c
where not exists (select 1 from public.teams t where t.club_id = c.id);

update public.players p
   set team_id = (select t.id from public.teams t
                  where t.club_id = p.club_id
                  order by t.created_at limit 1)
 where p.team_id is null;

update public.visuals v
   set team_id = (select t.id from public.teams t
                  where t.club_id = v.club_id
                  order by t.created_at limit 1)
 where v.team_id is null;


-- ── 4. Le quota d'équipes suit l'offre ──────────────────────────────────────
-- plan_limits passe de deux à trois colonnes. Postgres refuse un
-- `create or replace` qui change le type de retour (« cannot change return
-- type of existing function ») : il faut supprimer d'abord. Les fonctions qui
-- l'appellent sont en plpgsql, dont le corps n'est pas analysé à la création :
-- aucune dépendance ne bloque la suppression, et elles sont recréées juste
-- après pour lire la troisième colonne.
drop function if exists public.plan_limits(text);

-- ⚠️ Ce barème doit rester identique à la constante PRICING de
-- src/Landing.jsx. Si l'un change, changez l'autre dans le même commit.
create function public.plan_limits(p_plan text)
returns table (max_visuals_per_week int, max_templates int, max_teams int)
language sql
immutable
as $$
  select
    case upper(coalesce(p_plan, 'BASIC'))
      when 'PREMIUM'  then 100000   -- « illimité » en pratique
      when 'STANDARD' then 15
      else 5                        -- BASIC et toute valeur inconnue
    end,
    case upper(coalesce(p_plan, 'BASIC'))
      when 'PREMIUM'  then 22       -- « illimité » = la totalité des gabarits
      when 'STANDARD' then 5
      else 1
    end,
    case upper(coalesce(p_plan, 'BASIC'))
      when 'PREMIUM'  then 999      -- « illimité » en pratique
      when 'STANDARD' then 3
      else 1
    end;
$$;

-- plan_limits() gagne une colonne : les appelants qui la lisaient à deux
-- colonnes doivent être recréés, sinon ils échouent à l'exécution.
create or replace function public.admin_set_club_plan(p_club_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visuals int;
  v_templates int;
  v_teams int;
begin
  if not public.is_app_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_plan not in ('BASIC', 'STANDARD', 'PREMIUM') then
    raise exception 'Offre inconnue : %', p_plan using errcode = '22023';
  end if;
  select l.max_visuals_per_week, l.max_templates, l.max_teams
    into v_visuals, v_templates, v_teams
    from public.plan_limits(p_plan) l;
  update public.clubs
     set plan = p_plan,
         max_visuals_per_week = v_visuals,
         max_templates = v_templates,
         max_teams = v_teams
   where id = p_club_id;
end;
$$;

revoke all on function public.admin_set_club_plan(uuid, text) from public;
grant execute on function public.admin_set_club_plan(uuid, text) to authenticated;

create or replace function public.clubs_apply_plan_limits()
returns trigger
language plpgsql
as $$
declare
  v_visuals int;
  v_templates int;
  v_teams int;
begin
  select l.max_visuals_per_week, l.max_templates, l.max_teams
    into v_visuals, v_templates, v_teams
    from public.plan_limits(new.plan) l;
  if new.max_visuals_per_week is null then new.max_visuals_per_week := v_visuals; end if;
  if new.max_templates       is null then new.max_templates       := v_templates; end if;
  if new.max_teams           is null then new.max_teams           := v_teams;     end if;
  return new;
end;
$$;

drop trigger if exists clubs_plan_limits on public.clubs;
create trigger clubs_plan_limits
  before insert on public.clubs
  for each row execute function public.clubs_apply_plan_limits();


-- ── 5. Quota appliqué côté serveur ──────────────────────────────────────────
-- Le blocage côté navigateur est contournable par un appel direct à l'API.
create or replace function public.teams_enforce_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_used  int;
begin
  if public.is_app_admin() then
    return new;
  end if;

  select coalesce(max_teams, 1) into v_limit
  from public.clubs where id = new.club_id;

  if v_limit is null then
    return new;  -- club introuvable : laissé à la charge de la RLS
  end if;

  select count(*) into v_used from public.teams where club_id = new.club_id;

  if v_used >= v_limit then
    raise exception 'Limite d''équipes atteinte (% pour cette offre)', v_limit
      using errcode = '54000';
  end if;

  return new;
end;
$$;

drop trigger if exists teams_quota on public.teams;
create trigger teams_quota
  before insert on public.teams
  for each row execute function public.teams_enforce_quota();


-- ── 6. Mise à niveau des clubs existants ────────────────────────────────────
update public.clubs c
   set max_teams = coalesce(
         c.max_teams,
         (select l.max_teams from public.plan_limits(c.plan) l))
 where c.max_teams is null;


-- ── Contrôle ────────────────────────────────────────────────────────────────
--   select c.name, c.plan, c.max_teams,
--          (select count(*) from public.teams t where t.club_id = c.id) as equipes,
--          (select count(*) from public.players p where p.club_id = c.id
--             and p.team_id is null) as joueurs_orphelins
--   from public.clubs c order by c.name;
