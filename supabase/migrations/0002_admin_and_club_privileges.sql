-- ════════════════════════════════════════════════════════════════════════════
-- SÉCURITÉ · Colonnes privilégiées de `clubs` + rôle administrateur
-- ════════════════════════════════════════════════════════════════════════════
--
-- PROBLÈME CORRIGÉ
-- L'application doit pouvoir modifier sa propre ligne `clubs` (nom, couleurs,
-- logo, thème). Ce droit d'UPDATE porte sur TOUTE la ligne : rien n'empêchait
-- un utilisateur connecté d'exécuter depuis la console du navigateur
--
--     supabase.from('clubs').update({ approved: true, plan: 'PREMIUM',
--                                     max_visuals_per_week: 9999 })
--                           .eq('id', <son propre club>)
--
-- et de s'auto-approuver, se donner l'offre PREMIUM et lever son quota.
-- Les politiques RLS ne savent pas restreindre par colonne : seuls les GRANT
-- au niveau colonne le peuvent. C'est ce que fait cette migration.
--
-- Le contrôle admin était lui aussi purement côté client (liste d'emails
-- embarquée dans le bundle JS, donc publique et contournable). Il passe en
-- base, et les actions d'administration passent par des fonctions
-- SECURITY DEFINER qui vérifient réellement l'appelant.
--
-- ⚠️ Vérifiez que les noms de colonnes correspondent à votre schéma avant
--    d'exécuter. Le bloc de quota tout en bas est optionnel.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Liste des administrateurs ────────────────────────────────────────────
create table if not exists public.app_admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

-- Personne n'accède à la table directement : tout passe par is_app_admin(),
-- qui est SECURITY DEFINER. Aucune policy = aucun accès direct.

insert into public.app_admins (email) values
  ('hugo.fenoli@live.fr'),
  ('lucas.dipasquale01@gmail.com')
on conflict (email) do nothing;


-- ── 2. « L'appelant est-il admin ? » ────────────────────────────────────────
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;


-- ── 3. Colonnes de `clubs` réellement modifiables par un club ───────────────
-- On retire le droit d'UPDATE global, puis on le rend colonne par colonne.
-- Toute tentative d'écrire `approved`, `plan`, `max_visuals_per_week` ou
-- `max_templates` échoue désormais côté serveur, RLS ou pas.
alter table public.clubs alter column approved set default false;

revoke update on public.clubs from authenticated;
grant  update (name, color1, color2, logo_url, theme_mode, is_configured, email)
  on public.clubs to authenticated;

-- L'insertion initiale (premier login via magic link) ne porte que sur ces
-- trois colonnes ; `approved` prend son défaut, c'est-à-dire false.
revoke insert on public.clubs from authenticated;
grant  insert (user_id, email, name) on public.clubs to authenticated;


-- ── 4. Actions d'administration ─────────────────────────────────────────────
-- SECURITY DEFINER : la fonction contourne les GRANT ci-dessus, mais seulement
-- après avoir vérifié que l'appelant est bien dans app_admins.
create or replace function public.admin_set_club_approval(p_club_id uuid, p_approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  update public.clubs set approved = p_approved where id = p_club_id;
end;
$$;

create or replace function public.admin_set_club_plan(p_club_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  if p_plan not in ('BASIC', 'STANDARD', 'PREMIUM') then
    raise exception 'Offre inconnue : %', p_plan using errcode = '22023';
  end if;
  update public.clubs set plan = p_plan where id = p_club_id;
end;
$$;

revoke all on function public.admin_set_club_approval(uuid, boolean) from public;
revoke all on function public.admin_set_club_plan(uuid, text)        from public;
grant execute on function public.admin_set_club_approval(uuid, boolean) to authenticated;
grant execute on function public.admin_set_club_plan(uuid, text)        to authenticated;

-- L'écran admin liste tous les clubs : il lui faut une policy de lecture
-- globale, réservée aux admins.
drop policy if exists clubs_admin_select_all on public.clubs;
create policy clubs_admin_select_all on public.clubs
  for select to authenticated
  using (public.is_app_admin());


-- ════════════════════════════════════════════════════════════════════════════
-- 5. OPTIONNEL · Quota hebdomadaire appliqué côté serveur
-- ════════════════════════════════════════════════════════════════════════════
-- La limite de visuels par semaine n'est aujourd'hui vérifiée que dans le
-- navigateur : un appel direct à l'API la contourne. Ce trigger reproduit
-- exactement la règle du client (fenêtre glissante de 7 jours, défaut 5).
-- Retirez ce bloc si vous préférez garder la limite indicative.

create or replace function public.visuals_enforce_weekly_quota()
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

  select coalesce(max_visuals_per_week, 5) into v_limit
  from public.clubs where id = new.club_id;

  if v_limit is null then
    return new;  -- club introuvable : laissé à la charge de la RLS
  end if;

  select count(*) into v_used
  from public.visuals
  where club_id = new.club_id
    and created_at >= now() - interval '7 days';

  if v_used >= v_limit then
    raise exception 'Limite hebdomadaire atteinte (% visuels sur 7 jours)', v_limit
      using errcode = '54000';
  end if;

  return new;
end;
$$;

drop trigger if exists visuals_weekly_quota on public.visuals;
create trigger visuals_weekly_quota
  before insert on public.visuals
  for each row execute function public.visuals_enforce_weekly_quota();


-- ════════════════════════════════════════════════════════════════════════════
-- 6. À VÉRIFIER À LA MAIN · politiques RLS existantes
-- ════════════════════════════════════════════════════════════════════════════
-- Cette migration ajoute une policy de lecture pour les admins, mais elle ne
-- peut pas supprimer une policy trop permissive déjà en place. Or l'écran
-- admin lit `clubs` sans filtre et fonctionnait avant cette migration : cela
-- suggère qu'une policy SELECT ouverte à tous les comptes connectés existe
-- peut-être — auquel cas n'importe quel club peut lire les lignes des autres
-- (emails compris).
--
-- Listez les policies :
--
--   select tablename, policyname, cmd, roles, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('clubs','players','player_photos','media','visuals')
--   order by tablename, policyname;
--
-- Ce qu'on veut voir, pour chaque table :
--   · clubs         SELECT/UPDATE  → auth.uid() = user_id  (+ la policy admin)
--   · players       ALL            → le club appartient à auth.uid()
--   · player_photos ALL            → le joueur appartient à un club de auth.uid()
--   · media         ALL            → le club appartient à auth.uid()
--   · visuals       ALL            → le club appartient à auth.uid()
--
-- Exemple de policy correcte pour une table rattachée à un club :
--
--   create policy media_own on public.media for all to authenticated
--     using      (exists (select 1 from public.clubs c
--                         where c.id = media.club_id and c.user_id = auth.uid()))
--     with check (exists (select 1 from public.clubs c
--                         where c.id = media.club_id and c.user_id = auth.uid()));
--
-- Vérifiez aussi que RLS est bien ACTIVÉE partout :
--
--   select relname, relrowsecurity from pg_class
--   where relname in ('clubs','players','player_photos','media','visuals');
