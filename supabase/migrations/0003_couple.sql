-- =====================================================================
-- Noesia Family — module « Espace couple » (messages, nous deux, dessins)
-- Fonctions RPC atomiques (évite les écrasements quand les deux parents
-- agissent en même temps) + temps réel de la liste à vivre.
-- Idempotent : peut être rejoué sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Photo éphémère : marquer comme vue (uniquement par le destinataire,
-- la première fois seulement).
-- ---------------------------------------------------------------------
create or replace function public.couple_mark_viewed(p_message uuid)
returns public.messages
language plpgsql security definer set search_path = public as $$
declare
  m public.messages;
begin
  if not public.is_parent() then
    raise exception 'Accès refusé';
  end if;
  update public.messages
     set viewed_at = coalesce(viewed_at, now())
   where id = p_message
     and kind = 'ephemeral'
     and sender_id <> auth.uid()
  returning * into m;
  if m.id is null then
    select * into m from public.messages where id = p_message;
  end if;
  return m;
end;
$$;

-- ---------------------------------------------------------------------
-- Photo éphémère : « 💛 On la garde ? »
-- Ajoute mon vote ; quand tous les parents ont voté, la photo devient un
-- souvenir (kept = true, plus d'expiration).
-- ---------------------------------------------------------------------
create or replace function public.couple_keep_vote(p_message uuid)
returns public.messages
language plpgsql security definer set search_path = public as $$
declare
  m public.messages;
  votes uuid[];
  parents uuid[];
begin
  if not public.is_parent() then
    raise exception 'Accès refusé';
  end if;
  select * into m from public.messages where id = p_message and kind = 'ephemeral' for update;
  if m.id is null or m.deleted then
    return m;
  end if;
  votes := array(select distinct v from unnest(m.keep_votes || auth.uid()) as v);
  parents := array(select id from public.members where role = 'parent');
  update public.messages
     set keep_votes = votes,
         kept = (parents <@ votes),
         expires_at = case when parents <@ votes then null else expires_at end
   where id = p_message
  returning * into m;
  return m;
end;
$$;

-- ---------------------------------------------------------------------
-- Question du jour (et autres jeux « révélés à deux ») : savoir si l'autre
-- a déjà répondu, SANS voir sa réponse.
-- ---------------------------------------------------------------------
create or replace function public.couple_partner_answered(p_game text, p_item text)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_parent() and exists (
    select 1 from public.paired_answers
     where game = p_game and item_key = p_item and member_id <> auth.uid());
$$;

grant execute on function public.couple_mark_viewed(uuid) to authenticated;
grant execute on function public.couple_keep_vote(uuid) to authenticated;
grant execute on function public.couple_partner_answered(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Temps réel : liste à vivre
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bucket_list') then
    alter publication supabase_realtime add table public.bucket_list;
  end if;
end $$;

-- Index utiles (souvenirs, compteur « je pense à toi »)
create index if not exists messages_kind_idx on public.messages (kind, created_at desc);
