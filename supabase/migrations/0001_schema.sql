-- =====================================================================
-- Noesia Family — schéma principal
-- Une installation = une famille. Les parents ont un compte (auth.users),
-- les enfants sont des "profils" (table people) sans compte.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Comptes autorisés (liste blanche) : seules ces adresses peuvent se connecter
-- ---------------------------------------------------------------------
create table public.allowed_emails (
  email        text primary key check (email = lower(email)),
  display_name text not null,
  role         text not null default 'parent' check (role in ('parent', 'child')),
  color        text not null default '#e07a5f',
  emoji        text not null default '🙂'
);
alter table public.allowed_emails enable row level security;
-- Aucune policy : lisible uniquement par le service (trigger security definer).

-- ---------------------------------------------------------------------
-- Personnes de la famille (parents + enfants)
-- ---------------------------------------------------------------------
create table public.people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('parent', 'child')),
  color       text not null default '#81b29a',
  emoji       text not null default '🙂',
  birthdate   date,
  details     jsonb not null default '{}'::jsonb,  -- tailles, allergies, médecin, école…
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Membres = comptes connectés
-- ---------------------------------------------------------------------
create table public.members (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null unique,
  display_name text not null,
  role         text not null default 'parent' check (role in ('parent', 'child')),
  person_id    uuid unique references public.people (id) on delete set null,
  settings     jsonb not null default '{"spicy_max_level": 1, "spicy_lock": true}'::jsonb,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Fonctions d'aide pour les règles d'accès (RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid());
$$;

create or replace function public.is_parent() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and role = 'parent');
$$;

create or replace function public.can_access_space(space text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when space = 'couple' then public.is_parent() else public.is_member() end;
$$;

-- Création automatique du membre à la première connexion.
-- Refuse toute adresse absente de allowed_emails.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  allowed public.allowed_emails;
  pid uuid;
begin
  select * into allowed from public.allowed_emails where email = lower(new.email);
  if not found then
    raise exception 'Adresse non autorisée pour Noesia Family';
  end if;

  -- Réutilise un profil existant du même nom (créé à l'avance) sinon en crée un.
  select id into pid from public.people
    where kind = allowed.role and lower(name) = lower(allowed.display_name)
      and id not in (select person_id from public.members where person_id is not null)
    limit 1;
  if pid is null then
    insert into public.people (name, kind, color, emoji, sort_order)
    values (allowed.display_name, allowed.role, allowed.color, allowed.emoji, 0)
    returning id into pid;
  end if;

  insert into public.members (id, email, display_name, role, person_id)
  values (new.id, lower(new.email), allowed.display_name, allowed.role, pid)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Notifications push : abonnements des appareils
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Journal anti-doublon des notifications automatiques (cron)
create table public.notification_log (
  key      text primary key,
  sent_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- AGENDA
-- ---------------------------------------------------------------------
create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  space                 text not null default 'family' check (space in ('family', 'couple')),
  title                 text not null,
  emoji                 text not null default '📅',
  notes                 text,
  location              text,
  start_date            date not null,              -- date (heure de Paris)
  end_date              date,                       -- pour les événements sur plusieurs jours
  all_day               boolean not null default false,
  start_time            time,
  end_time              time,
  recurrence            text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  recurrence_interval   int not null default 1 check (recurrence_interval >= 1),
  weekdays              int[] not null default '{}', -- 1 = lundi … 7 = dimanche (récurrence hebdo)
  until_date            date,
  exdates               date[] not null default '{}',
  pause_school_holidays boolean not null default false,
  person_ids            uuid[] not null default '{}',
  driver_id             uuid references public.people (id) on delete set null,  -- qui emmène
  pickup_id             uuid references public.people (id) on delete set null,  -- qui récupère
  checklist             text[] not null default '{}',                           -- à ne pas oublier
  remind_minutes_before int[] not null default '{60}',
  remind_eve            boolean not null default false,
  countdown             boolean not null default false,
  created_by            uuid references public.members (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index events_start_idx on public.events (start_date);

-- Rappels (tâches) avec accusé "C'est fait"
create table public.reminders (
  id           uuid primary key default gen_random_uuid(),
  space        text not null default 'family' check (space in ('family', 'couple')),
  title        text not null,
  notes        text,
  due_at       timestamptz not null,
  recurrence   text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  assigned_to  uuid references public.members (id) on delete set null,  -- null = tout le monde
  person_id    uuid references public.people (id) on delete set null,   -- enfant concerné
  require_ack  boolean not null default true,
  done_at      timestamptz,
  done_by      uuid references public.members (id) on delete set null,
  last_sent_at timestamptz,
  created_by   uuid references public.members (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index reminders_due_idx on public.reminders (due_at) where done_at is null;

-- ---------------------------------------------------------------------
-- ENFANTS : carnet (mots d'enfants, santé, mesures, souvenirs, dessins)
-- ---------------------------------------------------------------------
create table public.child_entries (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.people (id) on delete cascade,
  kind        text not null check (kind in ('quote', 'health', 'measure', 'memory', 'drawing')),
  entry_date  date not null default current_date,
  title       text,
  body        text,
  height_cm   numeric(5, 1),
  weight_kg   numeric(5, 2),
  media_path  text,
  created_by  uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index child_entries_person_idx on public.child_entries (person_id, kind, entry_date desc);

-- ---------------------------------------------------------------------
-- MESSAGES (discussion des parents)
-- ---------------------------------------------------------------------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null default 'couple',
  sender_id   uuid not null references public.members (id) on delete cascade,
  kind        text not null check (kind in ('text', 'drawing', 'photo', 'ephemeral', 'capsule', 'thought', 'system')),
  body        text,
  media_path  text,
  -- photo éphémère
  view_once   boolean not null default false,
  expires_at  timestamptz,
  viewed_at   timestamptz,
  keep_votes  uuid[] not null default '{}',
  kept        boolean not null default false,
  deleted     boolean not null default false,
  -- capsule temporelle (le contenu est dans capsule_contents)
  unlock_at   timestamptz,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index messages_channel_idx on public.messages (channel, created_at desc);

create table public.capsule_contents (
  message_id  uuid primary key references public.messages (id) on delete cascade,
  body        text,
  media_path  text
);

create table public.chat_reads (
  member_id    uuid not null references public.members (id) on delete cascade,
  channel      text not null default 'couple',
  last_read_at timestamptz not null default now(),
  primary key (member_id, channel)
);

-- Dessins (mur + tableau partagé en direct)
create table public.drawings (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Dessin',
  strokes     jsonb not null default '[]'::jsonb,
  preview_path text,
  person_id   uuid references public.people (id) on delete set null,   -- dessin d'un enfant
  created_by  uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- NOUS DEUX : humeur, question du jour, liste à vivre
-- ---------------------------------------------------------------------
create table public.moods (
  member_id   uuid not null references public.members (id) on delete cascade,
  mood_date   date not null,
  mood        text not null,
  note        text,
  updated_at  timestamptz not null default now(),
  primary key (member_id, mood_date)
);

-- Réponses aux jeux "révélés à deux" (question du jour, devine ma réponse,
-- qui de nous deux, tu préfères, 36 questions…). La réponse de l'autre n'est
-- visible qu'après avoir soi-même répondu (voir policy).
create table public.paired_answers (
  id          uuid primary key default gen_random_uuid(),
  game        text not null,             -- 'daily', 'devine', 'qui', 'tupreferes', '36q', 'tupreferes_hot'…
  item_key    text not null,             -- identifiant de la question (ou date pour 'daily')
  member_id   uuid not null references public.members (id) on delete cascade,
  answer      jsonb not null,            -- réponse personnelle
  guess       jsonb,                     -- pronostic sur la réponse de l'autre (devine ma réponse)
  created_at  timestamptz not null default now(),
  unique (game, item_key, member_id)
);

create or replace function public.has_answered(p_game text, p_item text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.paired_answers
                 where game = p_game and item_key = p_item and member_id = auth.uid());
$$;

create table public.bucket_list (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  emoji       text not null default '✨',
  notes       text,
  done_at     timestamptz,
  created_by  uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- JEUX
-- ---------------------------------------------------------------------
create table public.games (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,             -- 'morpion', 'alignes4', 'bataille', 'pendu', 'dessin'
  state       jsonb not null default '{}'::jsonb,
  players     uuid[] not null,           -- [créateur, adversaire]
  turn        uuid,                      -- à qui de jouer
  status      text not null default 'active' check (status in ('setup', 'active', 'finished')),
  winner      uuid,
  created_by  uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Secrets d'une partie (bateaux, mot à deviner…) : visibles par leur seul propriétaire.
create table public.game_secrets (
  game_id    uuid not null references public.games (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  secret     jsonb not null,
  primary key (game_id, member_id)
);

-- Envies en commun : chacun ne voit que ses propres réponses.
create table public.desire_answers (
  item_key    text not null,
  member_id   uuid not null references public.members (id) on delete cascade,
  answer      text not null check (answer in ('yes', 'maybe', 'no')),
  updated_at  timestamptz not null default now(),
  primary key (item_key, member_id)
);

-- Bons pour…
create table public.coupons (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references public.members (id) on delete cascade,
  to_id       uuid not null references public.members (id) on delete cascade,
  title       text not null,
  emoji       text not null default '🎟️',
  description text,
  spicy       boolean not null default false,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Défis à distance
create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references public.members (id) on delete cascade,
  to_id       uuid not null references public.members (id) on delete cascade,
  text        text not null,
  level       int not null default 1 check (level between 1 and 3),
  status      text not null default 'sent' check (status in ('sent', 'accepted', 'done', 'declined')),
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);

-- ---------------------------------------------------------------------
-- SORTIES
-- ---------------------------------------------------------------------
create table public.places (
  id           uuid primary key default gen_random_uuid(),
  space        text not null default 'family' check (space in ('family', 'couple')),
  name         text not null,
  category     text not null default 'resto' check (category in ('resto', 'bar', 'sortie', 'balade', 'weekend', 'activite', 'autre')),
  url          text,
  instagram    text,
  address      text,
  city         text,
  lat          double precision,
  lng          double precision,
  image_url    text,
  description  text,
  price_level  int check (price_level between 1 and 4),
  tags         text[] not null default '{}',
  notes        text,
  status       text not null default 'todo' check (status in ('todo', 'done')),
  ratings      jsonb not null default '{}'::jsonb,   -- { member_id: 1..5 }
  done_at      timestamptz,
  added_by     uuid references public.members (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- "On sort où ce soir ?" : chacun swipe, on garde les lieux aimés par les deux.
create table public.place_swipes (
  session_date date not null,
  place_id     uuid not null references public.places (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  liked        boolean not null,
  created_at   timestamptz not null default now(),
  primary key (session_date, place_id, member_id)
);

-- ---------------------------------------------------------------------
-- LISTES PARTAGÉES (courses, cadeaux, rentrée…)
-- ---------------------------------------------------------------------
create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  emoji       text not null default '📝',
  space       text not null default 'family' check (space in ('family', 'couple')),
  sort_order  int not null default 0,
  created_by  uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.list_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists (id) on delete cascade,
  text        text not null,
  done        boolean not null default false,
  created_by  uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- RÈGLES D'ACCÈS (Row Level Security)
-- =====================================================================
alter table public.people            enable row level security;
alter table public.members           enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log  enable row level security;
alter table public.events            enable row level security;
alter table public.reminders         enable row level security;
alter table public.child_entries     enable row level security;
alter table public.messages          enable row level security;
alter table public.capsule_contents  enable row level security;
alter table public.chat_reads        enable row level security;
alter table public.drawings          enable row level security;
alter table public.moods             enable row level security;
alter table public.paired_answers    enable row level security;
alter table public.bucket_list       enable row level security;
alter table public.games             enable row level security;
alter table public.game_secrets      enable row level security;
alter table public.desire_answers    enable row level security;
alter table public.coupons           enable row level security;
alter table public.challenges        enable row level security;
alter table public.places            enable row level security;
alter table public.place_swipes      enable row level security;
alter table public.lists             enable row level security;
alter table public.list_items        enable row level security;

-- Famille : tous les membres
create policy people_all on public.people for all using (public.is_member()) with check (public.is_parent());
create policy child_entries_all on public.child_entries for all using (public.is_member()) with check (public.is_member());
create policy lists_all on public.lists for all using (public.can_access_space(space)) with check (public.can_access_space(space));
create policy list_items_all on public.list_items for all
  using (exists (select 1 from public.lists l where l.id = list_id and public.can_access_space(l.space)))
  with check (exists (select 1 from public.lists l where l.id = list_id and public.can_access_space(l.space)));

-- Membres : chacun voit la famille, ne modifie que son propre profil
create policy members_select on public.members for select using (public.is_member());
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where id = auth.uid();
$$;
create policy members_update on public.members for update using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());

-- Push : chacun gère ses appareils
create policy push_own on public.push_subscriptions for all using (member_id = auth.uid()) with check (member_id = auth.uid());

-- Agenda & rappels : selon l'espace
create policy events_all on public.events for all using (public.can_access_space(space)) with check (public.can_access_space(space));
create policy reminders_all on public.reminders for all using (public.can_access_space(space)) with check (public.can_access_space(space));

-- Sorties
create policy places_all on public.places for all using (public.can_access_space(space)) with check (public.can_access_space(space));
create policy place_swipes_select on public.place_swipes for select using (public.is_member());
create policy place_swipes_write on public.place_swipes for all using (member_id = auth.uid()) with check (member_id = auth.uid());

-- Espace couple : parents uniquement
create policy messages_select on public.messages for select using (public.is_parent());
create policy messages_insert on public.messages for insert with check (public.is_parent() and sender_id = auth.uid());
create policy messages_update on public.messages for update using (public.is_parent()) with check (public.is_parent());
create policy messages_delete on public.messages for delete using (sender_id = auth.uid());

create policy capsule_select on public.capsule_contents for select using (
  public.is_parent() and exists (
    select 1 from public.messages m where m.id = message_id
      and (m.sender_id = auth.uid() or m.unlock_at <= now())));
create policy capsule_insert on public.capsule_contents for insert with check (
  exists (select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid()));

create policy chat_reads_own on public.chat_reads for all using (public.is_parent()) with check (member_id = auth.uid());
create policy drawings_all on public.drawings for all using (public.is_member()) with check (public.is_member());
create policy moods_select on public.moods for select using (public.is_parent());
create policy moods_write on public.moods for all using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy paired_select on public.paired_answers for select using (
  public.is_parent() and (member_id = auth.uid() or public.has_answered(game, item_key)));
create policy paired_write on public.paired_answers for all using (member_id = auth.uid()) with check (member_id = auth.uid() and public.is_parent());

create policy bucket_all on public.bucket_list for all using (public.is_parent()) with check (public.is_parent());

create policy games_select on public.games for select using (auth.uid() = any (players));
create policy games_insert on public.games for insert with check (public.is_parent() and auth.uid() = any (players));
create policy games_update on public.games for update using (auth.uid() = any (players)) with check (auth.uid() = any (players));
create policy games_delete on public.games for delete using (auth.uid() = any (players));
create policy secrets_own on public.game_secrets for all using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy desires_own on public.desire_answers for all using (member_id = auth.uid()) with check (member_id = auth.uid() and public.is_parent());
create policy coupons_select on public.coupons for select using (public.is_parent() and auth.uid() in (from_id, to_id));
create policy coupons_insert on public.coupons for insert with check (from_id = auth.uid() and public.is_parent());
create policy coupons_update on public.coupons for update using (auth.uid() in (from_id, to_id));
create policy coupons_delete on public.coupons for delete using (from_id = auth.uid());
create policy challenges_select on public.challenges for select using (public.is_parent() and auth.uid() in (from_id, to_id));
create policy challenges_insert on public.challenges for insert with check (from_id = auth.uid() and public.is_parent());
create policy challenges_update on public.challenges for update using (auth.uid() in (from_id, to_id));
create policy challenges_delete on public.challenges for delete using (from_id = auth.uid());
-- notification_log : aucune policy (service uniquement)

-- =====================================================================
-- FONCTIONS MÉTIER (appelées depuis l'app via supabase.rpc)
-- =====================================================================

-- Envies en commun : ne révèle QUE les envies partagées, jamais un "non".
create or replace function public.desire_matches()
returns table (item_key text, level text)
language sql stable security definer set search_path = public as $$
  select a.item_key,
         case when a.answer = 'yes' and b.answer = 'yes' then 'match' else 'explore' end as level
  from public.desire_answers a
  join public.desire_answers b on b.item_key = a.item_key and b.member_id <> a.member_id
  where a.member_id = auth.uid()
    and public.is_parent()
    and a.answer in ('yes', 'maybe') and b.answer in ('yes', 'maybe');
$$;

-- Nombre d'envies auxquelles l'autre a répondu (sans révéler les réponses)
create or replace function public.desire_partner_progress()
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.desire_answers
  where member_id <> auth.uid() and public.is_parent();
$$;

-- Jeu à secret : le "propriétaire" du secret et l'adversaire.
-- Bataille navale : tir sur la grille adverse.
create or replace function public.battleship_fire(p_game uuid, p_cell int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  opponent uuid;
  ships jsonb;
  hit boolean := false;
  sunk boolean := false;
  ship jsonb;
  shots jsonb;
  my_shots jsonb;
  all_sunk boolean := true;
  cell jsonb;
begin
  select * into g from public.games where id = p_game for update;
  if g.id is null or g.type <> 'bataille' then raise exception 'Partie introuvable'; end if;
  if g.status <> 'active' then raise exception 'La partie n''est pas en cours'; end if;
  if g.turn <> auth.uid() then raise exception 'Ce n''est pas ton tour'; end if;
  if p_cell < 0 or p_cell > 99 then raise exception 'Case invalide'; end if;

  opponent := case when g.players[1] = auth.uid() then g.players[2] else g.players[1] end;
  select secret -> 'ships' into ships from public.game_secrets where game_id = p_game and member_id = opponent;
  if ships is null then raise exception 'L''adversaire n''a pas encore placé ses bateaux'; end if;

  shots := coalesce(g.state -> 'shots', '{}'::jsonb);
  my_shots := coalesce(shots -> auth.uid()::text, '[]'::jsonb);
  if my_shots @> jsonb_build_array(jsonb_build_object('cell', p_cell)) then
    raise exception 'Case déjà visée';
  end if;

  for ship in select * from jsonb_array_elements(ships) loop
    if ship -> 'cells' @> to_jsonb(p_cell) then
      hit := true;
      -- coulé si toutes les cases du bateau ont été touchées
      sunk := true;
      for cell in select * from jsonb_array_elements(ship -> 'cells') loop
        if (cell)::int <> p_cell and not my_shots @> jsonb_build_array(jsonb_build_object('cell', (cell)::int, 'hit', true)) then
          sunk := false;
        end if;
      end loop;
    end if;
  end loop;

  my_shots := my_shots || jsonb_build_array(jsonb_build_object('cell', p_cell, 'hit', hit, 'sunk', sunk));
  shots := jsonb_set(shots, array[auth.uid()::text], my_shots);

  -- victoire ?
  for ship in select * from jsonb_array_elements(ships) loop
    for cell in select * from jsonb_array_elements(ship -> 'cells') loop
      if not my_shots @> jsonb_build_array(jsonb_build_object('cell', (cell)::int, 'hit', true)) then
        all_sunk := false;
      end if;
    end loop;
  end loop;

  update public.games set
    state = jsonb_set(g.state, '{shots}', shots),
    turn = case when all_sunk then null when hit then auth.uid() else opponent end,
    status = case when all_sunk then 'finished' else 'active' end,
    winner = case when all_sunk then auth.uid() else null end,
    updated_at = now()
  where id = p_game;

  return jsonb_build_object('hit', hit, 'sunk', sunk, 'won', all_sunk);
end;
$$;

-- Pendu / Dessine-je-devine : proposer une lettre ou un mot.
-- Le secret appartient au joueur qui a choisi le mot (secret->>'word').
create or replace function public.word_guess(p_game uuid, p_guess text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  owner uuid;
  word text;
  norm_word text;
  guess text := upper(trim(p_guess));
  letters jsonb;
  wrong int;
  max_wrong int := 7;
  revealed text := '';
  ch text;
  solved boolean := true;
  i int;
begin
  select * into g from public.games where id = p_game for update;
  if g.id is null or g.type not in ('pendu', 'dessin') then raise exception 'Partie introuvable'; end if;
  if g.status <> 'active' then raise exception 'La partie est terminée'; end if;
  owner := (g.state ->> 'owner')::uuid;
  if owner = auth.uid() then raise exception 'Tu connais déjà le mot !'; end if;
  if not auth.uid() = any (g.players) then raise exception 'Pas ta partie'; end if;

  select secret ->> 'word' into word from public.game_secrets where game_id = p_game and member_id = owner;
  norm_word := upper(translate(word, 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ', 'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUYY'));
  guess := translate(guess, 'ÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ', 'AAAAAACEEEEIIIINOOOOOUUUUYY');

  if g.type = 'dessin' then
    if guess = norm_word then
      update public.games set status = 'finished', winner = auth.uid(),
        state = g.state || jsonb_build_object('word', word, 'guesses', coalesce(g.state -> 'guesses', '[]'::jsonb) || to_jsonb(guess)),
        updated_at = now() where id = p_game;
      return jsonb_build_object('correct', true, 'word', word);
    else
      update public.games set
        state = g.state || jsonb_build_object('guesses', coalesce(g.state -> 'guesses', '[]'::jsonb) || to_jsonb(guess)),
        updated_at = now() where id = p_game;
      return jsonb_build_object('correct', false);
    end if;
  end if;

  -- pendu
  letters := coalesce(g.state -> 'letters', '[]'::jsonb);
  wrong := coalesce((g.state ->> 'wrong')::int, 0);
  if length(guess) = 1 then
    if letters @> to_jsonb(guess) then raise exception 'Lettre déjà proposée'; end if;
    letters := letters || to_jsonb(guess);
    if position(guess in norm_word) = 0 then wrong := wrong + 1; end if;
  else
    if guess <> norm_word then wrong := wrong + 1; else
      for i in 1..length(norm_word) loop
        ch := substr(norm_word, i, 1);
        if ch ~ '[A-Z]' and not letters @> to_jsonb(ch) then letters := letters || to_jsonb(ch); end if;
      end loop;
    end if;
  end if;

  for i in 1..length(norm_word) loop
    ch := substr(norm_word, i, 1);
    if ch !~ '[A-Z]' then revealed := revealed || substr(word, i, 1);
    elsif letters @> to_jsonb(ch) then revealed := revealed || substr(word, i, 1);
    else revealed := revealed || '_'; solved := false;
    end if;
  end loop;

  update public.games set
    state = g.state || jsonb_build_object('letters', letters, 'wrong', wrong, 'revealed', revealed, 'max_wrong', max_wrong)
                    || case when solved or wrong >= max_wrong then jsonb_build_object('word', word) else '{}'::jsonb end,
    status = case when solved or wrong >= max_wrong then 'finished' else 'active' end,
    winner = case when solved then auth.uid() when wrong >= max_wrong then owner else null end,
    updated_at = now()
  where id = p_game;
  return jsonb_build_object('solved', solved, 'wrong', wrong, 'revealed', revealed);
end;
$$;

-- Initialise l'état public d'un pendu à partir du secret (masque le mot).
create or replace function public.word_init(p_game uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  word text;
  revealed text := '';
  i int;
begin
  select * into g from public.games where id = p_game for update;
  if (g.state ->> 'owner')::uuid <> auth.uid() then raise exception 'Seul le créateur du mot peut lancer la partie'; end if;
  select secret ->> 'word' into word from public.game_secrets where game_id = p_game and member_id = auth.uid();
  if word is null then raise exception 'Mot manquant'; end if;
  for i in 1..length(word) loop
    if substr(word, i, 1) ~ '[[:alpha:]]' then revealed := revealed || '_'; else revealed := revealed || substr(word, i, 1); end if;
  end loop;
  update public.games set
    state = g.state || jsonb_build_object('revealed', revealed, 'length', length(word), 'letters', '[]'::jsonb, 'wrong', 0, 'max_wrong', 7),
    status = 'active', updated_at = now()
  where id = p_game;
end;
$$;

-- Marquer un rappel comme fait (et programmer la prochaine occurrence s'il est récurrent)
create or replace function public.complete_reminder(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r public.reminders;
begin
  select * into r from public.reminders where id = p_id for update;
  if r.id is null or not public.can_access_space(r.space) then raise exception 'Rappel introuvable'; end if;
  if r.recurrence = 'none' then
    update public.reminders set done_at = now(), done_by = auth.uid() where id = p_id;
  else
    update public.reminders set
      due_at = r.due_at + case r.recurrence when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end,
      last_sent_at = null, done_by = auth.uid()
    where id = p_id;
  end if;
end;
$$;

-- =====================================================================
-- TEMPS RÉEL
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.messages, public.games, public.moods, public.paired_answers, public.events,
      public.reminders, public.list_items, public.place_swipes, public.challenges,
      public.coupons, public.drawings;
  end if;
end $$;

-- =====================================================================
-- STOCKAGE (photos, dessins)
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('media', 'media', false)
    on conflict (id) do nothing;

    create policy media_read on storage.objects for select using (
      bucket_id = 'media' and (
        -- espace couple : parents uniquement
        (name like 'couple/%' and public.is_parent())
        -- capsules : uniquement après la date d'ouverture (ou pour l'expéditeur)
        or (name like 'capsules/%' and public.is_parent() and exists (
              select 1 from public.capsule_contents c join public.messages m on m.id = c.message_id
              where c.media_path = name and (m.sender_id = auth.uid() or m.unlock_at <= now())))
        -- famille
        or (name like 'family/%' and public.is_member())
      ));
    create policy media_insert on storage.objects for insert with check (
      bucket_id = 'media' and (
        ((name like 'couple/%' or name like 'capsules/%') and public.is_parent())
        or (name like 'family/%' and public.is_member())));
    create policy media_delete on storage.objects for delete using (
      bucket_id = 'media' and owner = auth.uid());
  end if;
end $$;
