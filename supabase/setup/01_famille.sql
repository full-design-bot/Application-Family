-- =====================================================================
-- Noesia Family — paramétrage de VOTRE famille
-- À exécuter UNE fois dans Supabase → SQL Editor, APRÈS la migration 0001
-- (et les migrations 0002…). Remplacez les valeurs entre <…>.
-- =====================================================================

-- 1. Les deux adresses e-mail autorisées à se connecter (en minuscules)
insert into public.allowed_emails (email, display_name, role, color, emoji) values
  ('<email-parent-1@exemple.fr>', '<Prénom parent 1>', 'parent', '#e07a5f', '🦊'),
  ('<email-parent-2@exemple.fr>', '<Prénom parent 2>', 'parent', '#3d5a80', '🐻')
on conflict (email) do update set display_name = excluded.display_name, color = excluded.color, emoji = excluded.emoji;

-- 2. Les enfants (profils sans compte). Dates de naissance modifiables ensuite dans l'app.
insert into public.people (name, kind, color, emoji, birthdate, sort_order)
select * from (values
  ('Jules', 'child', '#4a90d9', '🐬', null::date, 1),
  ('Pia',   'child', '#9b6ad6', '🦄', null::date, 2)
) as v(name, kind, color, emoji, birthdate, sort_order)
where not exists (select 1 from public.people p where p.name = v.name and p.kind = 'child');

-- 3. Quelques listes pour démarrer
insert into public.lists (title, emoji, space, sort_order)
select * from (values ('Courses', '🛒', 'family', 1), ('Idées cadeaux', '🎁', 'family', 2)) as v(title, emoji, space, sort_order)
where not exists (select 1 from public.lists);
