# BOX·OPS — patch v9 : déploiement Vercel + Neon Postgres

## Ce que tu vas obtenir

Une URL du genre `https://box-ops-ton-pseudo.vercel.app` accessible depuis n'importe où, SSL automatique, 100 % gratuit à vie pour un usage perso/petite équipe.

**Limites du free tier à connaître** :
- Vercel : 100 Go de bande passante / mois (largement assez)
- Neon Postgres : 0,5 Go de stockage à vie (tu peux y mettre des milliers de boîtes et photos compressées)
- Si la DB n'est pas utilisée pendant 5 min sur Neon Free, elle "s'endort" et le premier accès prend 1-2 secondes pour se réveiller (pas grave pour ton usage)

## Changements de cette version

- Schéma Prisma : `provider = "postgresql"` au lieu de `sqlite`
- Photos : **compression automatique** côté client (max 1600 px, JPEG 82 %) pour rester sous la limite de body Vercel (4,5 Mo)
- Config Next : `output: "standalone"` pour démarrage plus rapide sur Vercel
- Nouveau script : `npm run db:studio` pour inspecter la DB facilement

## Fichiers du patch

```
prisma/schema.prisma              ← provider sqlite → postgresql
src/components/BoxForm.tsx        ← compression image
src/lib/image.ts                  ← NOUVEAU helper compression
next.config.js                    ← output: standalone
.env.example                      ← variables prod
package.json                      ← script db:studio
```

## Étape par étape

### Étape 1 — Créer un compte Neon (Postgres gratuit)

1. Va sur [https://neon.tech/](https://neon.tech/)
2. Clique **Sign up** → connecte-toi avec ton GitHub
3. Il te propose de créer un projet : nomme-le **box-ops**, région **Europe (Frankfurt)** (au plus proche de toi)
4. Sur la page d'accueil du projet, trouve **Connection string** → copie l'URL type `postgresql://...`
5. **Important** : prends bien la version **pooled** (si on te demande, sinon l'URL par défaut marche)

Garde cette URL sous la main.

### Étape 2 — Appliquer le patch en local et tester

1. Copie les fichiers du patch dans ton projet existant (écrase)
2. Installe (au cas où des deps ont bougé) :
   ```powershell
   npm install
   ```
3. Modifie ton `.env` local pour pointer vers Neon :
   ```
   DATABASE_URL="postgresql://...ton-url-neon..."
   AUTH_SECRET="...ta-cle-existante..."
   AUTH_TRUST_HOST="true"
   ```
4. Applique les migrations sur la base Neon fraîche :
   ```powershell
   npx prisma migrate deploy
   ```
   Ça pousse toutes tes migrations existantes (`init`, `add_stacks`, `add_moves`, `add_auth`) vers Postgres. Pas de prompt cette fois parce que c'est du `deploy` (pour prod), pas du `dev`.
5. Teste en local :
   ```powershell
   npm run dev
   ```
   Ouvre http://localhost:3000, crée un compte, vérifie que ton plan apparaît. Si tu avais des données en local SQLite, **elles sont perdues** — on recommence from scratch sur Postgres.

Si ça marche en local, passe à l'étape 3.

### Étape 3 — Pousser ton code sur GitHub

Depuis ton dossier `storage-box-app` dans PowerShell :

```powershell
git init
git add .
git commit -m "v9 ready for deployment"
```

Puis crée un nouveau repo sur GitHub (privé ou public, peu importe) :
1. Va sur [https://github.com/new](https://github.com/new)
2. Nom : `box-ops` (ou ce que tu veux)
3. **Ne coche rien** (ni README, ni .gitignore, ni license)
4. Clique "Create repository"
5. GitHub te donne 2 commandes type :
   ```powershell
   git remote add origin https://github.com/ton-pseudo/box-ops.git
   git branch -M main
   git push -u origin main
   ```
   Copie-colle-les dans PowerShell.

> ⚠️ Vérifie que ton `.gitignore` contient bien `.env` avant le push ! Sinon ta clé `AUTH_SECRET` et ton URL Neon seront publiques sur GitHub.
> Normalement c'est déjà le cas (fichier fourni), mais vérifie avec `cat .gitignore | findstr env`.

### Étape 4 — Déployer sur Vercel

1. Va sur [https://vercel.com/](https://vercel.com/)
2. Clique **Sign Up** → **Continue with GitHub**
3. Sur le dashboard, clique **Add New...** → **Project**
4. Tu vois ton repo `box-ops` → clique **Import**
5. **Framework Preset** : Next.js (auto-détecté)
6. **Root Directory** : laisse `.` (racine)
7. Déroule **Environment Variables** et ajoute ces 4 lignes :

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `postgresql://...` (ton URL Neon) |
   | `AUTH_SECRET` | la clé que tu as déjà (ou génère-en une nouvelle avec `npm run auth:secret`) |
   | `AUTH_GOOGLE_ID` | (facultatif) ton Google Client ID |
   | `AUTH_GOOGLE_SECRET` | (facultatif) ton Google Client Secret |

8. Clique **Deploy**. Ça prend 2-3 minutes. Quand c'est fini, Vercel te donne une URL du style `https://box-ops-xxxx.vercel.app`.

### Étape 5 — Mettre à jour Google OAuth (si tu l'utilises)

Ton URL est maintenant `https://box-ops-xxxx.vercel.app`, il faut l'autoriser dans Google Cloud :

1. Va sur [https://console.cloud.google.com/](https://console.cloud.google.com/) → ton projet
2. **APIs & Services** → **Credentials** → clique sur ton OAuth Client ID existant
3. Dans **Authorized redirect URIs**, clique **Add URI** et ajoute :
   ```
   https://box-ops-xxxx.vercel.app/api/auth/callback/google
   ```
   (remplace par ton URL Vercel réelle)
4. Garde aussi `http://localhost:3000/api/auth/callback/google` pour pouvoir tester en local
5. **Save**

Si tu es en mode "Testing" sur OAuth consent screen, n'oublie pas d'ajouter les emails autorisés (max 100).

### Étape 6 — Tester en prod

Ouvre ton URL Vercel dans un navigateur, crée un compte, connecte-toi, joue avec ton plan. Tout devrait fonctionner comme en local.

## Déploiement continu

Chaque `git push` sur la branche `main` redéploiera automatiquement sur Vercel. Tu peux aussi faire des branches de test qui auront chacune leur URL de prévisualisation.

Pour appliquer une future migration Prisma :

```powershell
# En local, crée la migration et teste-la
npx prisma migrate dev --name ma_feature

# Commit et push
git add .
git commit -m "feat: ma feature"
git push
```

Vercel lance automatiquement `npm run build` qui exécute `prisma migrate deploy` → la migration est appliquée à Neon avant le nouveau déploiement. Aucune manip à faire sur Vercel ou Neon.

## Dépannage

**Le build échoue sur Vercel avec "Environment variable not found: DATABASE_URL"**
→ Tu as oublié de coller `DATABASE_URL` dans les env vars Vercel. Va dans **Settings** → **Environment Variables**, ajoute-la, puis **Redeploy** depuis l'onglet Deployments.

**"Can't reach database server" sur la page de login**
→ L'URL Neon a un problème. Vérifie qu'elle se termine bien par `?sslmode=require` (Vercel et Neon l'exigent).

**Google OAuth : "Error 400: redirect_uri_mismatch"**
→ L'URL de callback ne correspond pas. Regarde attentivement le message d'erreur de Google, il te donne l'URL exacte à ajouter dans la console.

**"Internal Server Error" au login credentials**
→ Vérifie les logs dans Vercel : **Deployments** → ton déploiement → **Runtime Logs**. Souvent c'est `AUTH_SECRET` manquant.

**La DB "dort" et la première requête est lente**
→ Normal sur Neon Free. Après quelques secondes d'activité, c'est réveillé. Pour éviter, passe à Neon Launch ($19/mois) — pas nécessaire pour ton usage.

## Limites à connaître

- **Photos stockées en base64 dans la DB** : simple mais lourd. Si tu dépasses 0,5 Go (des milliers de photos 2 Mo), tu paieras Neon. Pour un vrai stockage d'images à grande échelle, il faudra passer à un bucket S3/Cloudflare R2. Pour l'instant ça ira.
- **Pas de vraie persistance des uploads** : les photos sont en DB, donc persistent normalement
- **Pas de queue / job background** : tout est synchrone. Si tu fais évoluer l'app avec des tâches longues (envoi d'emails, etc.), il faudra un worker externe.
