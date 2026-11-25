# Noesia Family — conventions de développement

App web installable sur iPhone (PWA) pour une famille : 2 parents avec compte, 2 enfants
(Jules 6 ans, Pia 3 ans) en **profils sans compte**, Bordeaux (vacances zone A).
Toute l'interface est **en français**, pensée **mobile d'abord** (iPhone, une main).

## Pile technique

- **Next.js 16** (App Router, `src/`). ⚠️ Next 16 : `middleware` s'appelle `proxy` (`src/proxy.ts`),
  `params` / `searchParams` des pages sont des **Promise**. En cas de doute : `node_modules/next/dist/docs/`.
- **React 19**, **Tailwind CSS v4** (thème dans `src/app/globals.css`).
- **Supabase** : Postgres + RLS, Auth (code OTP par e-mail), Realtime, Storage (bucket privé `media`).
- **Web Push** (VAPID, librairie `web-push`) + service worker `public/sw.js`.
- Paquets disponibles : `@supabase/supabase-js`, `@supabase/ssr`, `date-fns` (v4) + `@date-fns/tz`,
  `lucide-react` (icônes), `perfect-freehand` (traits de dessin), `leaflet` + `react-leaflet` (cartes),
  `web-push`, `vitest` (tests). **Ne pas installer d'autres paquets.**

## Données

- Schéma complet : `supabase/migrations/0001_schema.sql` (tables, RLS, fonctions RPC). **Lis-le.**
- Types TypeScript des lignes : `src/lib/types.ts`.
- Une installation = une famille (pas de `family_id`).
- `space` = `'family'` (tous les membres) ou `'couple'` (parents uniquement).
- Besoin d'une modification du schéma ? Ajoute un **nouveau fichier** de migration propre à ton module
  (n'édite pas `0001`) : `0002_agenda.sql`, `0003_couple.sql`, `0004_jeux.sql`, `0005_sorties.sql`.
  SQL idempotent si possible (`create ... if not exists`, `create or replace`).

### Accès aux données depuis l'interface

Pages et composants **client** (`"use client"`) qui utilisent le client navigateur :

```ts
import { supabase } from "@/lib/supabase/client";
const { data, error } = await supabase().from("events").select("*").order("start_date");
```

Temps réel :

```ts
useEffect(() => {
  const sb = supabase();
  const ch = sb.channel("events-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => load())
    .subscribe();
  return () => { sb.removeChannel(ch); };
}, []);
```

Les noms de canaux doivent être uniques par usage (préfixe = ton module).

Côté serveur (routes API) : `serverSupabase()` (au nom de l'utilisateur), `currentMember()`,
`adminSupabase()` (contourne RLS : **uniquement** cron et push) dans `src/lib/supabase/server.ts`.

## Briques communes (à réutiliser, ne pas modifier)

| Fichier | Contenu |
|---|---|
| `src/lib/family.tsx` | `useFamily()` → `me`, `partner`, `members`, `people`, `children`, `personOf(memberId)`, `personById`, `memberById`, `nameOf`, `isParent`, `reload()` ; `useHolidays()` |
| `src/components/ui.tsx` | `Button`, `LinkButton`, `IconButton`, `Card`, `CardLink`, `SectionTitle`, `PageHeader`, `Field`, `Input`, `Textarea`, `Select`, `Toggle`, `Segmented`, `Chip`, `Sheet` (feuille modale), `EmptyState`, `Spinner`, `LoadingBlock`, `Avatar`, `Badge`, `useToast()`, `cn()` |
| `src/lib/push/client.ts` | `notify({ to: "partner" \| "all" \| "me" \| ids, title, body, url, tag, discreet })` |
| `src/lib/push/server.ts` | `sendPushToMembers(ids, payload)`, `parentIds()` (serveur) |
| `src/lib/cron/log.ts` | `claimNotification(key)` anti-doublon (serveur) |
| `src/lib/media.ts` | `uploadPhoto(folder, file)`, `uploadMedia(folder, blob, ext)`, `compressImage`, `signedUrl(path)`, `useSignedUrl(path)`, `deleteMedia` — dossiers `couple/`, `capsules/`, `family/` |
| `src/lib/dates.ts` | Tout à l'heure de Paris : `todayISO`, `toParisISODate`, `toParisTime`, `parisDateTime(date, "HH:mm")`, `addDaysISO`, `isoWeekday`, `formatDayLong`, `formatDayShort`, `formatDateFull`, `formatTime`, `fromNow`, `formatMessageTime`, `daysBetween`, `ageFrom`, `WEEKDAYS_FR` |
| `src/lib/holidays.ts` | `Holiday`, `holidayOn`, `isSchoolHoliday`, `nextHoliday`, `fetchHolidays()` (serveur) |
| `src/lib/lock.ts`, `src/components/SpicyLock.tsx` | Verrou Face ID / code : entourer les pages coquines de `<SpicyLock>` |
| `src/components/AppShell.tsx` | Barre d'onglets : Accueil `/`, Agenda `/agenda`, Messages `/messages`, Jeux `/jeux`, Plus `/plus` |

Les pages connectées vivent dans `src/app/(app)/…` (le layout fournit `FamilyProvider`, `ToastProvider`, la barre d'onglets).
Commence chaque page par `<PageHeader title="…" back="/…" />`.

## Style

- Cartes arrondies (`rounded-3xl`), couleurs du thème : `bg-bg`, `bg-card`, `bg-card-2`, `text-ink`, `text-muted`,
  `border-line`, `accent` (terracotta), `sage`, `sky`, `sand`, `rose` + variantes `-soft` pour les fonds pastel.
- Mode sombre automatique : **n'utilise que les couleurs du thème**, jamais `bg-white` / `text-black` en dur.
- Gros boutons tactiles (≥ 44 px), emojis bienvenus, ton chaleureux et complice, tutoiement.
- Champs ≥ 16 px (évite le zoom iOS) — déjà réglé globalement.
- La barre d'onglets fait ~80 px en bas : le `main` a déjà le padding nécessaire. Pour un élément fixé en bas
  (ex. zone de saisie du chat), place-le au-dessus : `bottom-[calc(64px+env(safe-area-inset-bottom))]`.

## Notifications

- Après une action qui concerne l'autre parent, appelle `notify({ title, body, url })` (par défaut → l'autre parent).
- Contenu coquin : **toujours** `discreet: true` (texte neutre sur l'écran verrouillé).
- Notifications programmées : chaque module expose une fonction de cron (voir ci-dessous).

## Cron (tâches planifiées)

`/api/cron` (appelé toutes les 5 minutes) appellera les fonctions exportées par les modules :

```ts
// src/lib/cron/<module>.ts
import "server-only";
export async function run<Module>Cron(now: Date): Promise<string[]> { /* renvoie un journal lisible */ }
```

Utilise `adminSupabase()`, `sendPushToMembers()`, et `claimNotification(clé)` pour ne jamais notifier deux fois.

## Vérifications

- `npx tsc --noEmit` et `npx eslint <tes dossiers>` doivent passer.
- **Ne lance pas** `next build` ni `next dev` (plusieurs personnes travaillent dans le même dossier).
- Logique pure (récurrences, règles de jeu…) : tests `vitest` dans `src/**/*.test.ts` (`npx vitest run <fichier>`).
