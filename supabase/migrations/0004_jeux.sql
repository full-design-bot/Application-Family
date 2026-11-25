-- =====================================================================
-- Noesia Family — module Jeux
-- =====================================================================

-- Questions auxquelles l'autre parent a déjà répondu (clés uniquement, jamais
-- les réponses) : permet d'afficher « Sam a répondu, à toi ! » sans rien
-- dévoiler avant d'avoir soi-même répondu.
create or replace function public.paired_partner_keys(p_game text default null)
returns table (game text, item_key text)
language sql stable security definer set search_path = public as $$
  select a.game, a.item_key
  from public.paired_answers a
  where a.member_id <> auth.uid()
    and public.is_parent()
    and (p_game is null or a.game = p_game);
$$;
