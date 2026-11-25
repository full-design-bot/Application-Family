-- =====================================================================
-- Noesia Family — module Sorties
-- =====================================================================

-- Temps réel sur les lieux (liste, fiche et « On sort où ce soir ? » se mettent à jour
-- quand l'autre ajoute, note ou modifie un lieu). place_swipes est déjà publié dans 0001.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'places'
     ) then
    alter publication supabase_realtime add table public.places;
  end if;
end $$;

-- Index utiles pour les listes
create index if not exists places_status_created_idx on public.places (status, created_at desc);
create index if not exists place_swipes_session_idx on public.place_swipes (session_date, place_id);
