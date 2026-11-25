# 🚀 Héberger Noesia Family sur Noesia

Noesia Family s'installe sur la plateforme **Noesia** comme l'app du Tennis Club : un conteneur de plus derrière le Caddy existant, à l'adresse **`https://famille.noesia.cloud`**.

```
Internet ─→ Caddy ──┬─ boxinnov.noesia.cloud ── app-boxinnov ─┐
                    ├─ demo.noesia.cloud ────── app-demo ──────┼─→ Postgres Noesia
                    ├─ tcm.noesia.cloud ─────── app-tcm ───────┘
                    └─ famille.noesia.cloud ─── app-famille ───→ Supabase (base, connexion, photos, temps réel)
```

L'app **n'utilise pas le Postgres de Noesia**. Ses données (comptes, messages, photos, temps réel) restent chez Supabase. Le serveur Noesia ne fait tourner que l'interface web, environ 150 Mo de mémoire.

Faites d'abord les **étapes 1 à 4 de [`PARAMETRAGE.md`](PARAMETRAGE.md)** (Supabase, tables, code de connexion, clés des notifications). Ce document remplace ensuite l'étape 5 (Vercel) et l'étape 6 (tâches planifiées).

> ⚠️ Comme le rappelle `DEPLOIEMENT.md` de l'ERP : **n'écrasez jamais** `docker-compose.yml` ni le `Caddyfile` du serveur. On **ajoute** des blocs, après avoir comparé.

---

## 1. Le DNS, en premier (Cloudflare)

Dans Cloudflare, zone `noesia.cloud`, ajoutez :

- type **A** ;
- nom **`famille`** ;
- valeur : **l'IP du serveur Noesia** (la même que `tcm`) ;
- **DNS only**, nuage **gris**.

Sans cet enregistrement, Caddy échoue en boucle sur la demande de certificat.

## 2. Récupérer le code sur le serveur

```bash
ssh -i ~/.ssh/noesia_hetzner root@<IP du serveur Noesia>
git clone https://github.com/full-design-bot/Application-Family.git /opt/famille
cd /opt/famille && git checkout claude/eloquent-sagan-wcxtbb   # ou main une fois fusionné
```

## 3. Les secrets

Ajoutez à la fin de **`/opt/noesia/.env`** le contenu de [`deploy/noesia/env.famille`](../deploy/noesia/env.famille), avec les vraies valeurs (étapes 1 et 4 de `PARAMETRAGE.md`) :

```bash
nano /opt/noesia/.env      # coller le bloc FAMILLE_*
chmod 600 /opt/noesia/.env
```

## 4. Déclarer le conteneur

Ajoutez le bloc [`deploy/noesia/docker-compose.famille.yml`](../deploy/noesia/docker-compose.famille.yml) dans **`/opt/noesia/docker-compose.yml`**, section `services:`, juste après `app-tcm`. Faites attention à l'indentation : 2 espaces avant `app-famille:`.

```bash
cd /opt/noesia
cp docker-compose.yml docker-compose.yml.avant-famille     # sauvegarde
nano docker-compose.yml                                    # coller le bloc
docker compose config --quiet && echo "compose OK"
```

## 5. Déclarer l'adresse dans Caddy

Ajoutez le bloc [`deploy/noesia/Caddyfile.famille`](../deploy/noesia/Caddyfile.famille) à la fin de **`/opt/noesia/Caddyfile`** :

```bash
cp Caddyfile Caddyfile.avant-famille
nano Caddyfile                                             # coller le bloc
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
```

## 6. Construire et démarrer

Le build prend environ 3 minutes et utilise jusqu'à 1,5 Go de mémoire pendant la construction.

```bash
cd /opt/noesia
docker compose build app-famille
docker compose up -d app-famille
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
```

Pour vérifier :

```bash
curl -s https://famille.noesia.cloud/api/health          # → {"ok":true}
docker compose logs app-famille --tail=30
```

## 7. Les tâches planifiées (rappels, capsules, photos éphémères)

Sur Noesia, le plus simple est d'utiliser le cron du serveur, comme les sauvegardes :

```bash
cp /opt/famille/deploy/noesia/cron.noesia-famille /etc/cron.d/noesia-famille
nano /etc/cron.d/noesia-famille      # remplacer <CRON_SECRET> par FAMILLE_CRON_SECRET
chmod 600 /etc/cron.d/noesia-famille
```

Pour vérifier, attendez 5 minutes, puis :

```bash
cat /var/log/noesia-famille-cron.log     # vide = tout va bien
```

> Alternative : la méthode Supabase `pg_cron` (`supabase/setup/02_taches_planifiees.sql`) marche aussi. N'activez **pas les deux** en même temps.

## 8. Dernier réglage dans Supabase

**Authentication → URL Configuration → Site URL** : `https://famille.noesia.cloud`

Ensuite, installez l'app sur les iPhones : étape 7 de `PARAMETRAGE.md`, avec l'adresse `https://famille.noesia.cloud`.

---

## Mettre à jour l'app

```bash
cd /opt/famille && git pull
cd /opt/noesia && docker compose build app-famille && docker compose up -d app-famille
```

Si une nouvelle migration SQL apparaît dans `supabase/migrations/`, exécutez-la dans Supabase **avant** de redémarrer.

## En cas de souci

| Symptôme | Piste |
|---|---|
| Certificat non émis | Le DNS ne pointe pas encore, ou le nuage Cloudflare est orange |
| Page « pas encore paramétrée » | Il manque une variable `FAMILLE_*`. Les variables `NEXT_PUBLIC_*` imposent un `docker compose build` |
| `502` sur l'adresse | `docker compose logs app-famille` : le conteneur ne démarre pas |
| Rappels absents | `/var/log/noesia-famille-cron.log` et l'étape 7 |

## Sauvegardes

Rien à ajouter sur le serveur : `app-famille` ne stocke rien sur Noesia, ses données sont chez Supabase. Pour garder une copie chez vous, faites un `pg_dump` avec la chaîne de connexion Supabase (**Connect → Connection string**). Les conditions de sauvegarde de Supabase dépendent de l'offre choisie.
