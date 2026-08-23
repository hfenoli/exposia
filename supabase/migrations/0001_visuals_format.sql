-- Format de publication d'un visuel : story (9:16), post (4:5) ou square (1:1).
-- Sans cette colonne, l'application reste fonctionnelle mais retombe sur
-- « story » au rechargement (voir writeVisual() dans src/App.jsx).
alter table public.visuals
  add column if not exists format text not null default 'story';

alter table public.visuals
  drop constraint if exists visuals_format_check;

alter table public.visuals
  add constraint visuals_format_check
  check (format in ('story', 'post', 'square'));

-- Les visuels déjà en base ont tous été créés au format story.
update public.visuals set format = 'story' where format is null;
