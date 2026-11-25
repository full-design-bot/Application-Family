// Types des lignes de la base (voir supabase/migrations/0001_schema.sql)

export type Space = "family" | "couple";
export type Role = "parent" | "child";

export interface Person {
  id: string;
  name: string;
  kind: Role;
  color: string;
  emoji: string;
  birthdate: string | null;
  details: PersonDetails;
  sort_order: number;
  created_at: string;
}

export interface PersonDetails {
  school?: string;
  class_name?: string;
  clothes_size?: string;
  shoe_size?: string;
  allergies?: string;
  doctor?: string;
  doctor_phone?: string;
  blood_type?: string;
  notes?: string;
  contacts?: { name: string; role?: string; phone?: string }[];
  [key: string]: unknown;
}

export interface MemberSettings {
  spicy_max_level?: 1 | 2 | 3;
  spicy_lock?: boolean;
  [key: string]: unknown;
}

export interface Member {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  person_id: string | null;
  settings: MemberSettings;
  created_at: string;
}

export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface EventRow {
  id: string;
  space: Space;
  title: string;
  emoji: string;
  notes: string | null;
  location: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  all_day: boolean;
  start_time: string | null; // HH:MM:SS
  end_time: string | null;
  recurrence: Recurrence;
  recurrence_interval: number;
  weekdays: number[]; // 1 = lundi … 7 = dimanche
  until_date: string | null;
  exdates: string[];
  pause_school_holidays: boolean;
  person_ids: string[];
  driver_id: string | null;
  pickup_id: string | null;
  checklist: string[];
  remind_minutes_before: number[];
  remind_eve: boolean;
  countdown: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  space: Space;
  title: string;
  notes: string | null;
  due_at: string;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  assigned_to: string | null;
  person_id: string | null;
  require_ack: boolean;
  done_at: string | null;
  done_by: string | null;
  last_sent_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ChildEntry {
  id: string;
  person_id: string;
  kind: "quote" | "health" | "measure" | "memory" | "drawing";
  entry_date: string;
  title: string | null;
  body: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  media_path: string | null;
  created_by: string | null;
  created_at: string;
}

export type MessageKind = "text" | "drawing" | "photo" | "ephemeral" | "capsule" | "thought" | "system";

export interface Message {
  id: string;
  channel: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  media_path: string | null;
  view_once: boolean;
  expires_at: string | null;
  viewed_at: string | null;
  keep_votes: string[];
  kept: boolean;
  deleted: boolean;
  unlock_at: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface CapsuleContent {
  message_id: string;
  body: string | null;
  media_path: string | null;
}

export interface Drawing {
  id: string;
  title: string;
  strokes: unknown[];
  preview_path: string | null;
  person_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Mood {
  member_id: string;
  mood_date: string;
  mood: string;
  note: string | null;
  updated_at: string;
}

export interface PairedAnswer {
  id: string;
  game: string;
  item_key: string;
  member_id: string;
  answer: unknown;
  guess: unknown;
  created_at: string;
}

export interface BucketItem {
  id: string;
  title: string;
  emoji: string;
  notes: string | null;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Game {
  id: string;
  type: "morpion" | "alignes4" | "bataille" | "pendu" | "dessin" | string;
  state: Record<string, unknown>;
  players: string[];
  turn: string | null;
  status: "setup" | "active" | "finished";
  winner: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  from_id: string;
  to_id: string;
  title: string;
  emoji: string;
  description: string | null;
  spicy: boolean;
  used_at: string | null;
  created_at: string;
}

export interface Challenge {
  id: string;
  from_id: string;
  to_id: string;
  text: string;
  level: 1 | 2 | 3;
  status: "sent" | "accepted" | "done" | "declined";
  created_at: string;
  done_at: string | null;
}

export type PlaceCategory = "resto" | "bar" | "sortie" | "balade" | "weekend" | "activite" | "autre";

export interface Place {
  id: string;
  space: Space;
  name: string;
  category: PlaceCategory;
  url: string | null;
  instagram: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  description: string | null;
  price_level: number | null;
  tags: string[];
  notes: string | null;
  status: "todo" | "done";
  ratings: Record<string, number>;
  done_at: string | null;
  added_by: string | null;
  created_at: string;
}

export interface PlaceSwipe {
  session_date: string;
  place_id: string;
  member_id: string;
  liked: boolean;
  created_at: string;
}

export interface List {
  id: string;
  title: string;
  emoji: string;
  space: Space;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  text: string;
  done: boolean;
  created_by: string | null;
  created_at: string;
}
