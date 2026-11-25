# 🛠️ Paramétrer Noesia Family

Compte environ **45 minutes**, une seule fois. Tout est gratuit à votre échelle.

Vous allez créer :

1. un projet **Supabase** : la base de données, les comptes et le stockage des photos ;
2. un projet **Vercel** : l'hébergement de l'app sur une adresse en `https://` ;
3. quelques clés secrètes à copier de l'un à l'autre.

> 💡 Gardez un bloc-notes ouvert pour coller les valeurs au fur et à mesure.
> Ne les partagez avec personne et ne les mettez jamais dans le code.

---

## Étape 1 — Créer le projet Supabase (10 min)

1. Créez un compte sur [supabase.com](https://supabase.com) puis **New project**.
   - Nom : `noesia-family`
   - Région : **Europe (Paris)** ou **Europe (Frankfurt)**
   - Choisissez un mot de passe de base de données et gardez-le.
2. Une fois le projet prêt, ouvrez **Project Settings → API Keys** (ou **Data API**) et notez :
   - **Project URL**, à utiliser comme `NEXT_PUBLIC_SUPABASE_URL` ;
   - **Publishable key** (`sb_publishable_…`, ou l'ancienne « anon key »), à utiliser comme `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ;
   - **Secret key** (`sb_secret_…`, ou l'ancienne « service_role key »), à utiliser comme `SUPABASE_SECRET_KEY`. ⚠️ Elle est ultra-secrète.

## Étape 2 — Créer les tables (5 min)

Dans Supabase, ouvrez **SQL Editor → New query**. Pour **chaque fichier** du dossier `supabase/migrations/`, **dans l'ordre** (`0001…`, `0002…`, etc.) :

1. ouvrez le fichier sur GitHub ;
2. copiez tout son contenu ;
3. collez-le dans l'éditeur SQL ;
4. cliquez **Run**. Le message attendu est « Success ».

Ensuite, ouvrez `supabase/setup/01_famille.sql` et **remplacez** :

- `<email-parent-1@exemple.fr>` et `<Prénom parent 1>` par vos informations ;
- `<email-parent-2@exemple.fr>` et `<Prénom parent 2>` par celles de l'autre parent.

Puis exécutez-le de la même façon. Il crée aussi les profils de Jules et Pia.

> Seules ces deux adresses pourront se connecter. Toute autre adresse est refusée par la base elle-même.

## Étape 3 — Configurer la connexion par code (5 min)

L'app se connecte avec un **code à 6 chiffres** reçu par e-mail. Un lien ne convient pas : sur iPhone, il s'ouvrirait dans Safari au lieu de l'app installée.

1. **Authentication → Sign In / Providers → Email** :
   - **Enable Email provider** : activé ;
   - **Confirm email** : activé ;
   - **Email OTP Length** : `6`.
2. **Authentication → Emails → Templates**. Modifiez **« Magic Link »** et **« Confirm signup »** pour y mettre le code :

   - Objet : `Ton code Noesia Family`
   - Message :

   ```html
   <h2>Ton code de connexion</h2>
   <p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Saisis ce code dans l'app Noesia Family. Il expire dans 1 heure.</p>
   ```

3. **Les e-mails doivent pouvoir partir.** Par défaut, Supabase n'envoie des e-mails qu'aux membres de votre équipe Supabase, et très peu par heure. Deux solutions :
   - **Simple :** ajoutez l'adresse de l'autre parent comme membre de votre organisation Supabase (**Organization → Team → Invite**).
   - **Recommandé :** branchez un service d'envoi gratuit comme [Resend](https://resend.com) (100 e-mails par jour) dans **Authentication → Emails → SMTP Settings**.
4. **Authentication → URL Configuration → Site URL** : collez l'adresse de l'app une fois l'étape 5 faite (par exemple `https://noesia-family.vercel.app`).

## Étape 4 — Générer les clés des notifications (2 min)

Sur un ordinateur avec Node.js installé, lancez :

```bash
npx web-push generate-vapid-keys
```

Notez :

- la **Public Key**, à utiliser comme `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ;
- la **Private Key**, à utiliser comme `VAPID_PRIVATE_KEY`.

Notez aussi :

- `VAPID_SUBJECT` : `mailto:` suivi de votre adresse e-mail, par exemple `mailto:moi@exemple.fr` ;
- `CRON_SECRET` : une longue suite de caractères au hasard, par exemple le résultat de `openssl rand -hex 32`.

> Pas d'ordinateur avec Node.js ? Demandez à Claude de générer ces clés pour vous.

## Étape 5 — Mettre l'app en ligne avec Vercel (10 min)

> 🏠 **Vous avez le serveur Noesia ?** Suivez plutôt [`DEPLOIEMENT_NOESIA.md`](DEPLOIEMENT_NOESIA.md) à la place des étapes 5 et 6 : l'app sera sur `https://famille.noesia.cloud`.

1. Créez un compte sur [vercel.com](https://vercel.com) en vous connectant avec GitHub.
2. **Add New → Project**, puis choisissez le dépôt **Application-Family**.
3. Dans **Environment Variables**, ajoutez les variables du fichier `.env.example` :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | étape 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | étape 1 |
   | `SUPABASE_SECRET_KEY` | étape 1 |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | étape 4 |
   | `VAPID_PRIVATE_KEY` | étape 4 |
   | `VAPID_SUBJECT` | étape 4 |
   | `CRON_SECRET` | étape 4 |
   | `SCHOOL_LOCATION` | `Bordeaux` |

4. Cliquez **Deploy**. Après 2 à 3 minutes, l'app est en ligne sur une adresse en `https://…vercel.app`.
5. Retournez à l'étape 3, point 4, pour coller cette adresse dans Supabase.

> Si vous modifiez une variable plus tard, il faut relancer un déploiement : **Deployments → … → Redeploy**.

## Étape 6 — Activer les tâches planifiées (5 min)

Ce sont elles qui envoient les rappels (« Piscine dans 1 h »), la question du jour, l'ouverture des capsules et la suppression des photos éphémères.

1. Dans Supabase, **Database → Extensions** : activez **pg_cron** et **pg_net**.
2. Ouvrez `supabase/setup/02_taches_planifiees.sql`, remplacez `<URL-DE-L-APP>` et `<CRON_SECRET>`, puis exécutez-le dans **SQL Editor**.
3. Pour vérifier, attendez 5 minutes, puis lancez :

   ```sql
   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
   ```

   Le statut attendu est `succeeded`.

## Étape 7 — Installer l'app sur les deux iPhones (5 min chacun)

1. Ouvrez l'adresse de l'app dans **Safari**.
2. Touchez **Partager**, puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. Ouvrez **Noesia** depuis l'icône et connectez-vous avec le code reçu par e-mail.
4. Dans **Plus → Réglages**, touchez **Activer les notifications**, puis **Autoriser**.
5. Toujours dans **Réglages**, touchez **Envoyer une notification de test**.
6. Recommencez sur le second iPhone.

Il faut **iOS 16.4 ou plus récent**.

## Étape 8 — Les finitions dans l'app

- **Plus → Les enfants** : dates de naissance, école, tailles et contacts de Jules et Pia.
- **Agenda → +** : créez « 🏊 Piscine » pour Jules, chaque mardi, avec « Suspendre pendant les vacances scolaires ».
- **Plus → Réglages → Espace coquin** : configurez Face ID et choisissez votre niveau.
- **Plus → Sorties → Raccourci** : créez le raccourci iOS pour enregistrer un resto depuis Instagram ou Plans en un geste.

---

## ❓ En cas de souci

| Problème | Solution |
|---|---|
| Une page « Noesia Family n'est pas encore paramétrée » s'affiche | Il manque des variables dans Vercel (étape 5). La page indique lesquelles. Pensez à redéployer. |
| « Adresse non autorisée » | L'adresse n'est pas dans `allowed_emails` (étape 2), ou elle contient une majuscule ou une faute. |
| Le code n'arrive pas | Regardez dans les spams, puis vérifiez l'étape 3, point 3 (envoi des e-mails). |
| Pas de bouton notifications, ou un message d'erreur | Sur iPhone, l'app doit être ouverte **depuis l'icône** de l'écran d'accueil, pas depuis Safari. |
| Les rappels n'arrivent pas | Vérifiez l'étape 6 (`cron.job_run_details`) et que les notifications sont activées sur l'iPhone (Réglages iOS → Notifications → Noesia). |
| Vacances scolaires absentes | Le calendrier officiel est chargé automatiquement. En cas de panne, une copie intégrée couvre 2026 à 2028 pour la zone A. |
