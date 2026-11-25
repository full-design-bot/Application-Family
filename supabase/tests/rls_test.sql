-- Test des règles d'accès sur un Postgres local (avec stubs auth/storage).
\set ON_ERROR_STOP 1
grant usage on schema public, auth, storage to authenticated;
grant select on storage.objects to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

insert into public.allowed_emails (email, display_name, color, emoji) values
  ('a@test.fr', 'Alex', '#e07a5f', '🦊'), ('b@test.fr', 'Sam', '#3d5a80', '🐻');

-- adresse non autorisée -> refus
do $$ begin
  insert into auth.users (email) values ('intrus@test.fr');
  raise exception 'ECHEC: intrus accepté';
exception when others then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'OK intrus refusé: %', sqlerrm;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'A@test.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.fr');
select count(*) = 2 as members_ok from public.members;
insert into public.people (name, kind) values ('Jules', 'child'), ('Pia', 'child');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select count(*) as people_visibles from public.people;
insert into public.paired_answers (game, item_key, member_id, answer) values ('daily', '2026-11-25', auth.uid(), '"bleu"');
insert into public.desire_answers values ('massage', auth.uid(), 'yes'), ('voyage', auth.uid(), 'yes'), ('x', auth.uid(), 'no');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select count(*) = 0 as b_ne_voit_pas_avant_reponse from public.paired_answers;
insert into public.paired_answers (game, item_key, member_id, answer) values ('daily', '2026-11-25', auth.uid(), '"vert"');
select count(*) = 2 as b_voit_apres from public.paired_answers;
select count(*) = 0 as b_ne_voit_pas_envies_a from public.desire_answers;
insert into public.desire_answers values ('massage', auth.uid(), 'yes'), ('voyage', auth.uid(), 'maybe'), ('x', auth.uid(), 'yes');
select string_agg(item_key || ':' || level, ',' order by item_key) as matches from public.desire_matches();

-- capsule
insert into public.messages (id, sender_id, kind, unlock_at) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'capsule', now() + interval '1 day');
insert into public.capsule_contents values ('10000000-0000-0000-0000-000000000001', 'secret', null);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select count(*) = 0 as capsule_cachee from public.capsule_contents;

-- bataille navale
insert into public.games (id, type, players, turn, status, state) values
 ('20000000-0000-0000-0000-000000000001', 'bataille', array['00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b']::uuid[], '00000000-0000-0000-0000-00000000000a', 'active', '{}');
insert into public.game_secrets values ('20000000-0000-0000-0000-000000000001', auth.uid(), '{"ships":[{"cells":[0,1]}]}');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.game_secrets values ('20000000-0000-0000-0000-000000000001', auth.uid(), '{"ships":[{"cells":[5,6]}]}');
select count(*) = 1 as b_ne_voit_que_son_secret from public.game_secrets;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.battleship_fire('20000000-0000-0000-0000-000000000001', 5) as tir1;
select public.battleship_fire('20000000-0000-0000-0000-000000000001', 6) as tir2;
select status, winner = auth.uid() as a_gagne from public.games where id = '20000000-0000-0000-0000-000000000001';

-- pendu
insert into public.games (id, type, players, status, state) values
 ('20000000-0000-0000-0000-000000000002', 'pendu', array['00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b']::uuid[], 'setup', jsonb_build_object('owner', auth.uid()));
insert into public.game_secrets values ('20000000-0000-0000-0000-000000000002', auth.uid(), '{"word":"Été"}');
select public.word_init('20000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.word_guess('20000000-0000-0000-0000-000000000002', 'e');
select public.word_guess('20000000-0000-0000-0000-000000000002', 't');
select status, state->>'word' as mot from public.games where id = '20000000-0000-0000-0000-000000000002';
