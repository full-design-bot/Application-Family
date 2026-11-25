# 🏡 Noesia Family

L'app privée de notre famille : agenda, messages, souvenirs, jeux et sorties.
C'est une **app web installable sur iPhone** (PWA), avec de vraies notifications push, sans App Store.

> **Pour l'installer :** suivez le guide pas à pas [`docs/PARAMETRAGE.md`](docs/PARAMETRAGE.md).
> **Hébergement sur le serveur Noesia** (`famille.noesia.cloud`) : [`docs/DEPLOIEMENT_NOESIA.md`](docs/DEPLOIEMENT_NOESIA.md).

## Ce que fait l'app

| Espace | Fonctionnalités |
|---|---|
| 🏠 **Accueil** | Journée de la famille, rappels, « Je pense à toi », humeurs, question du jour, compte à rebours, parties en cours |
| 📅 **Agenda** | Semaine de la famille, activités récurrentes (« piscine le mardi jusqu'en juin »), pause automatique pendant les vacances scolaires (zone A), qui emmène et qui récupère, choses à ne pas oublier, rappels la veille et avant l'heure |
| ⏰ **Rappels** | « Rappelle à … de … », avec accusé « C'est fait » qui prévient l'autre |
| 👦👧 **Enfants** | Profils de Jules et Pia : infos, santé, mots d'enfants, courbe de croissance, souvenirs et dessins |
| 💬 **Messages** | Discussion à deux, photos, **photos éphémères** (« on la garde ? »), **capsules temporelles**, croquis |
| 🎨 **Dessin** | Tableau partagé **en direct** : chacun voit les traits de l'autre apparaître |
| 💑 **Nous deux** | « Je pense à toi », météo du cœur, question du jour révélée à deux, liste à vivre, compte à rebours |
| 📍 **Sorties** | Restos et idées ajoutés par lien, @instagram ou nom ; « On sort où ce soir ? » avec matchs ; carte ; notes à deux ; raccourci iOS |
| 🎲 **Jeux** | Classiques à distance (morpion, 4 alignés, bataille navale, pendu, dessine-je-devine), jeux pour mieux se connaître, et un espace coquin 🔥 verrouillé par Face ID |
| 📝 **Listes** | Courses, cadeaux, rentrée… partagées en temps réel |

## Technique

- **Next.js 16** (App Router) · **React 19** · **Tailwind CSS 4**
- **Supabase** : Postgres avec règles d'accès par ligne (RLS), connexion par code e-mail, Realtime, stockage privé
- **Web Push** (VAPID) et service worker (`public/sw.js`)
- Tâches planifiées : Supabase `pg_cron` appelle `/api/cron` toutes les 5 minutes
- Vacances scolaires : calendrier officiel de l'Éducation nationale (`data.education.gouv.fr`)
- Lieux : OpenStreetMap (Nominatim et Photon), cartes Leaflet

### Sécurité et vie privée

- Seules les adresses e-mail listées dans `allowed_emails` peuvent créer un compte : c'est la base de données qui refuse les autres.
- L'espace couple (messages, jeux, humeurs…) n'est accessible qu'aux comptes **parents**, garanti par la base, pas seulement par l'interface.
- Les réponses « révélées à deux » ne sont lisibles qu'après avoir soi-même répondu. Les envies en commun ne révèlent jamais un « non ».
- Les capsules temporelles restent illisibles jusqu'à leur date, y compris les photos.
- Les photos éphémères sont supprimées du serveur après expiration, sauf si vous les gardez tous les deux.
- Les notifications de l'espace coquin sont neutres sur l'écran verrouillé.

## Développement

```bash
cp .env.example .env.local   # puis remplir les valeurs
npm install
npm run dev                  # http://localhost:3000
npm test                     # tests unitaires (vitest)
npm run build
```

Les conventions de code sont dans [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md). Le schéma de base est dans `supabase/migrations/`.
Pour vérifier les règles d'accès sur un Postgres local vierge : `supabase/tests/00_stubs.sql`, puis les migrations, puis `supabase/tests/rls_test.sql`.

Pour regénérer les icônes : `node scripts/generate-icons.cjs` (nécessite Playwright).
