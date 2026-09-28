-- ════════════════════════════════════════════════════════════════════════════
-- CRÉDITS IA
-- ════════════════════════════════════════════════════════════════════════════
--
-- La rédaction assistée coûte de l'argent à CHAQUE clic. Deux exigences en
-- découlent, et aucune ne peut être satisfaite côté navigateur :
--
--   1. Le quota doit être vérifié ET consommé en base, dans la même opération.
--      Un compteur tenu en JavaScript se remet à zéro depuis la console du
--      navigateur ; un contrôle « lire puis écrire » en deux requêtes laisse
--      deux clics simultanés passer tous les deux.
--
--   2. Le décompte doit être auditable. Si la facture Anthropic surprend, il
--      faut pouvoir dire quel club a généré quoi et quand.
--
-- D'où une table de journal plutôt qu'un simple compteur : une ligne par
-- génération, et le quota est un COUNT sur le mois civil en cours.
--
-- ⚠️ Le barème ci-dessous doit rester aligné sur la constante PRICING de
--    src/Landing.jsx. Si vous changez l'un, changez l'autre dans le même
--    commit. C'est la même règle que pour 0005.
--
-- SANS CETTE MIGRATION le site continue de fonctionner à l'identique : le
-- bouton de rédaction assistée se désactive tout seul et affiche que la
-- fonction n'est pas disponible. Rien d'autre n'en dépend.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Colonne de limite, comme les deux autres ─────────────────────────────
-- Elle permet d'accorder un quota particulier à un club depuis l'écran admin
-- sans toucher à son offre.
alter table public.clubs
  add column if not exists max_ai_per_month int;


-- ── 2. Le barème gagne une troisième limite ─────────────────────────────────
-- `create or replace` refuse un changement de type de retour : il faut passer
-- par un drop. Les fonctions plpgsql qui l'appellent la résolvent à
-- l'exécution et par nom de colonne, elles ne cassent donc pas.
drop function if exists public.plan_limits(text);

create function public.plan_limits(p_plan text)
returns table (max_visuals_per_week int, max_templates int, max_ai_per_month int)
language sql
immutable
as $$
  -- ⚠️ Identique à PRICING dans src/Landing.jsx.
  select
    case upper(coalesce(p_plan, 'BASIC'))
      when 'PREMIUM'  then 100000   -- « illimité » en pratique
      when 'STANDARD' then 15
      else 5                        -- BASIC et toute valeur inconnue
    end,
    case upper(coalesce(p_plan, 'BASIC'))
      when 'PREMIUM'  then 18
      when 'STANDARD' then 5
      else 1
    end,
    case upper(coalesce(p_plan, 'BASIC'))
      when 'PREMIUM'  then 100000   -- « illimité » en pratique
      when 'STANDARD' then 60
      else 10                       -- BASIC : de quoi goûter à la fonction
    end;
$$;


-- ── 3. Le changement d'offre applique aussi le quota IA ─────────────────────
create or replace function public.admin_set_club_plan(p_club_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visuals int;
  v_templates int;
  v_ai int;
begin
  if not public.is_app_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_plan not in ('BASIC', 'STANDARD', 'PREMIUM') then
    raise exception 'Offre inconnue : %', p_plan using errcode = '22023';
  end if;

  select l.max_visuals_per_week, l.max_templates, l.max_ai_per_month
    into v_visuals, v_templates, v_ai
    from public.plan_limits(p_plan) l;

  update public.clubs
     set plan = p_plan,
         max_visuals_per_week = v_visuals,
         max_templates = v_templates,
         max_ai_per_month = v_ai
   where id = p_club_id;
end;
$$;

revoke all on function public.admin_set_club_plan(uuid, text) from public;
grant execute on function public.admin_set_club_plan(uuid, text) to authenticated;


-- ── 4. Un club créé reçoit le quota de son offre ────────────────────────────
create or replace function public.clubs_apply_plan_limits()
returns trigger
language plpgsql
as $$
declare
  v_visuals int;
  v_templates int;
  v_ai int;
begin
  select l.max_visuals_per_week, l.max_templates, l.max_ai_per_month
    into v_visuals, v_templates, v_ai
    from public.plan_limits(new.plan) l;

  if new.max_visuals_per_week is null then new.max_visuals_per_week := v_visuals; end if;
  if new.max_templates        is null then new.max_templates        := v_templates; end if;
  if new.max_ai_per_month     is null then new.max_ai_per_month     := v_ai; end if;
  return new;
end;
$$;

drop trigger if exists clubs_plan_limits on public.clubs;
create trigger clubs_plan_limits
  before insert on public.clubs
  for each row execute function public.clubs_apply_plan_limits();


-- ── 5. Journal des générations ──────────────────────────────────────────────
create table if not exists public.ai_generations (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text,                      -- type de visuel : goal, result, post…
  tokens_in   int,
  tokens_out  int,
  created_at  timestamptz not null default now()
);

-- Le quota est un COUNT sur (club, mois en cours) : c'est l'index qui compte.
create index if not exists ai_generations_club_date
  on public.ai_generations (club_id, created_at desc);

alter table public.ai_generations enable row level security;

-- Le club lit son propre journal — l'écran de rédaction affiche « il vous
-- reste N générations ». Personne n'écrit directement : seule la fonction
-- ci-dessous insère, et elle est SECURITY DEFINER.
drop policy if exists ai_generations_read_own on public.ai_generations;
create policy ai_generations_read_own on public.ai_generations
  for select to authenticated
  using (exists (select 1 from public.clubs c
                  where c.id = ai_generations.club_id and c.user_id = auth.uid()));

revoke all on public.ai_generations from anon, authenticated;
grant select on public.ai_generations to authenticated;


-- ── 6. Où en est le club ? ──────────────────────────────────────────────────
-- Lecture seule, sans effet de bord : sert à afficher le compteur et à griser
-- le bouton avant même d'appeler le serveur.
create or replace function public.ai_credits_state()
returns table (used int, allowed int, remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_allowed int;
  v_used int;
begin
  select c.id,
         coalesce(c.max_ai_per_month,
                  (select l.max_ai_per_month from public.plan_limits(c.plan) l))
    into v_club, v_allowed
    from public.clubs c
   where c.user_id = auth.uid()
   order by c.created_at asc
   limit 1;

  if v_club is null then
    return query select 0, 0, 0;
    return;
  end if;

  select count(*)::int into v_used
    from public.ai_generations g
   where g.club_id = v_club
     and g.created_at >= date_trunc('month', now());

  return query select v_used, v_allowed, greatest(0, v_allowed - v_used);
end;
$$;

revoke all on function public.ai_credits_state() from public;
grant execute on function public.ai_credits_state() to authenticated;


-- ── 7. Vérifier ET consommer, en une seule opération ────────────────────────
-- Le contrôle et l'écriture sont dans la même instruction : deux clics
-- simultanés ne peuvent pas passer tous les deux au-dessus de la limite.
-- Renvoie le nombre de générations restantes APRÈS consommation.
create or replace function public.ai_consume_credit(p_kind text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_allowed int;
  v_used int;
begin
  select c.id,
         coalesce(c.max_ai_per_month,
                  (select l.max_ai_per_month from public.plan_limits(c.plan) l))
    into v_club, v_allowed
    from public.clubs c
   where c.user_id = auth.uid()
   order by c.created_at asc
   limit 1;

  if v_club is null then
    raise exception 'Aucun club rattaché à ce compte' using errcode = '42501';
  end if;

  -- Le verrou sérialise les appels concurrents du MÊME club sans bloquer les
  -- autres. Deux onglets ouverts ne peuvent donc pas consommer le même crédit.
  perform pg_advisory_xact_lock(hashtextextended(v_club::text, 0));

  select count(*)::int into v_used
    from public.ai_generations g
   where g.club_id = v_club
     and g.created_at >= date_trunc('month', now());

  if v_used >= v_allowed then
    raise exception 'Quota IA mensuel atteint (% sur %)', v_used, v_allowed
      using errcode = 'P0001';
  end if;

  insert into public.ai_generations (club_id, user_id, kind)
  values (v_club, auth.uid(), p_kind);

  return v_allowed - v_used - 1;
end;
$$;

revoke all on function public.ai_consume_credit(text) from public;
grant execute on function public.ai_consume_credit(text) to authenticated;


-- ── 8. Rendre un crédit quand la génération a échoué ────────────────────────
-- Le crédit est pris AVANT l'appel payant : c'est ce qui empêche d'obtenir des
-- générations gratuites en coupant la connexion au bon moment. En contrepartie,
-- un échec côté Anthropic doit être remboursé, sinon le club paie une panne.
-- La fenêtre de deux minutes évite qu'un appel tardif n'efface une génération
-- légitime faite entre-temps.
create or replace function public.ai_refund_credit()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select g.id into v_id
    from public.ai_generations g
    join public.clubs c on c.id = g.club_id
   where c.user_id = auth.uid()
     and g.created_at > now() - interval '2 minutes'
     and g.tokens_out is null      -- jamais aboutie : aucun jeton enregistré
   order by g.created_at desc
   limit 1;

  if v_id is not null then
    delete from public.ai_generations where id = v_id;
  end if;
end;
$$;

revoke all on function public.ai_refund_credit() from public;
grant execute on function public.ai_refund_credit() to authenticated;


-- ── 9. Enregistrer la consommation réelle de jetons ─────────────────────────
-- Appelée après la réponse d'Anthropic, pour que la facture soit traçable.
-- Sans effet sur le quota : un échec ici ne doit rien casser.
create or replace function public.ai_record_tokens(p_in int, p_out int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select g.id into v_id
    from public.ai_generations g
    join public.clubs c on c.id = g.club_id
   where c.user_id = auth.uid()
   order by g.created_at desc
   limit 1;

  if v_id is not null then
    update public.ai_generations
       set tokens_in = p_in, tokens_out = p_out
     where id = v_id;
  end if;
end;
$$;

revoke all on function public.ai_record_tokens(int, int) from public;
grant execute on function public.ai_record_tokens(int, int) to authenticated;


-- ── 10. Mise à niveau des clubs existants ───────────────────────────────────
-- N'écrase que les valeurs absentes, comme en 0005.
update public.clubs c
   set max_ai_per_month = (select l.max_ai_per_month from public.plan_limits(c.plan) l)
 where c.max_ai_per_month is null;


-- ── Contrôle ────────────────────────────────────────────────────────────────
--   select plan, count(*), min(max_ai_per_month), max(max_ai_per_month)
--     from public.clubs group by plan order by plan;
--
--   select * from public.ai_credits_state();
