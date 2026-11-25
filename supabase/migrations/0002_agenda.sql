-- =====================================================================
-- Noesia Family — module Agenda / Rappels / Enfants / Listes
-- Complète 0001 : temps réel sur les listes elles-mêmes et le carnet des enfants.
-- Idempotent : peut être rejoué sans erreur.
-- =====================================================================

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['lists', 'child_entries', 'people'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
