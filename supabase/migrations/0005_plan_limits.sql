-- ════════════════════════════════════════════════════════════════════════════
-- L'OFFRE PILOTE RÉELLEMENT LES LIMITES
-- ════════════════════════════════════════════════════════════════════════════
--
-- PROBLÈME CORRIGÉ
-- La colonne `clubs.plan` était décorative. Rien ne reliait l'offre aux deux
-- limites réellement appliquées (`max_visuals_per_week`, `max_templates`) :
-- passer un club en PREMIUM depuis l'écran admin ne changeait strictement
-- rien. Pire, un club sans `max_visuals_per_week` explicite retombait sur le
-- repli de 5 visuels par semaine — moins que l'offre BASIC annoncée à 8.
-- Un club pouvait donc payer l'offre la plus chère et rester plafonné à 5.
--
-- Cette migration rend l'offre autoritaire : les limites en découlent, à la
-- souscription comme au changement d'offre.
--
-- ⚠️ Les valeurs ci-dessous doivent rester alignées sur la constante PRICING
--    de src/Landing.jsx. Si vous changez les tarifs, changez les deux.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Barème des offres ────────────────────────────────────────────────────
create or replace function public.plan_limits(p_plan text)
returns table (max_visuals_per_week int, max_templates int)
language sql
immutable
as $$
  select
    case upper(coalesce(p_plan, 'BASIC'))
      when 'PREMIUM'  then 100000   -- « illimité » en pratique
      when 'STANDARD' then 30
      else 8                        -- BASIC et toute valeur inconnue
    end,
    case upper(coalesce(p_plan, 'BASIC'))
      when 'PREMIUM'  then 18
      when 'STANDARD' then 18
      else 6
    end;
$$;


-- ── 2. Le changement d'offre applique le barème ─────────────────────────────
create or replace function public.admin_set_club_plan(p_club_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visuals int;
  v_templates int;
begin
  if not public.is_app_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_plan not in ('BASIC', 'STANDARD', 'PREMIUM') then
    raise exception 'Offre inconnue : %', p_plan using errcode = '22023';
  end if;

  select l.max_visuals_per_week, l.max_templates
    into v_visuals, v_templates
    from public.plan_limits(p_plan) l;

  update public.clubs
     set plan = p_plan,
         max_visuals_per_week = v_visuals,
         max_templates = v_templates
   where id = p_club_id;
end;
$$;

revoke all on function public.admin_set_club_plan(uuid, text) from public;
grant execute on function public.admin_set_club_plan(uuid, text) to authenticated;


-- ── 3. Un club créé sans limites reçoit celles de son offre ─────────────────
create or replace function public.clubs_apply_plan_limits()
returns trigger
language plpgsql
as $$
declare
  v_visuals int;
  v_templates int;
begin
  select l.max_visuals_per_week, l.max_templates
    into v_visuals, v_templates
    from public.plan_limits(new.plan) l;

  if new.max_visuals_per_week is null then new.max_visuals_per_week := v_visuals; end if;
  if new.max_templates      is null then new.max_templates      := v_templates; end if;
  return new;
end;
$$;

drop trigger if exists clubs_plan_limits on public.clubs;
create trigger clubs_plan_limits
  before insert on public.clubs
  for each row execute function public.clubs_apply_plan_limits();


-- ── 4. Mise à niveau des clubs existants ────────────────────────────────────
-- N'écrase que les valeurs absentes, pour ne pas défaire un réglage manuel.
-- Pour réaligner TOUS les clubs sur le barème, retirez les deux conditions
-- `is null` ci-dessous.
update public.clubs c
   set max_visuals_per_week = coalesce(c.max_visuals_per_week, l.max_visuals_per_week),
       max_templates        = coalesce(c.max_templates,        l.max_templates)
  from public.plan_limits(c.plan) l
 where c.max_visuals_per_week is null
    or c.max_templates is null;


-- ── Contrôle ────────────────────────────────────────────────────────────────
--   select plan, count(*), min(max_visuals_per_week), max(max_visuals_per_week),
--          min(max_templates), max(max_templates)
--   from public.clubs group by plan order by plan;
