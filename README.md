# BOX·OPS — patch v10 : multi-Lieu (Phase B, itération 1)

## Ce qui change

L'app supporte maintenant **plusieurs Lieux** par compte utilisateur.

### Vocabulaire
- **Lieu** (dans le code : `Place`) = un contenant : "Mon garage", "Cave chez papa", "Box loueur"…
- **Boîte** (dans le code : `Box`) = un carton à l'intérieur d'un Lieu. Pas de changement.

### Nouveautés visibles
- **Switcher de Lieu** dans le header : un dropdown "Lieu : Mon garage ▾" qui liste tes lieux et permet de basculer
- Tu peux **créer un nouveau lieu** directement depuis ce dropdown
- **Page `/places`** pour gérer la liste complète : renommer, supprimer, ouvrir
- Chaque Lieu a son propre plan indépendant (rangées, cellules, boîtes, historique)

### Système de rôles (préparé, activé à l'itération 2)
Chaque Lieu aura trois niveaux de partage :
- **viewer** : lecture seule
- **editor** : peut ajouter / modifier / déplacer / supprimer des boîtes
- **admin** : tout de editor + éditer le plan
- **owner** : tout de admin + gérer les partages + supprimer le lieu

Les routes API vérifient déjà ces rôles, mais il n'y a pas encore d'UI pour inviter des gens — ça viendra à l'itération 2.

### Migration de tes données
**Rien ne sera perdu.** La migration SQL crée automatiquement un Lieu "Mon premier lieu" pour chaque utilisateur existant et y attribue toutes ses boîtes/emplacements actuels. Tu retrouveras exactement ce que tu avais avant, simplement dans un Lieu nommé.

## Fichiers du patch

```
prisma/schema.prisma                                  ← nouveau schéma
prisma/migrations/20260421200000_add_places/
  └─ migration.sql                                    ← NOUVEAU (data migration)

src/lib/require-place.ts                              ← NOUVEAU (helper scoping + rôles)
src/components/PlaceSwitcher.tsx                      ← NOUVEAU (dropdown header)
src/app/places/page.tsx                               ← NOUVEAU (gestion des lieux)

src/app/api/places/route.ts                           ← NOUVEAU
src/app/api/places/[id]/route.ts                      ← NOUVEAU
src/app/api/places/active/route.ts                    ← NOUVEAU

src/app/api/bootstrap/route.ts                        ← remplacé (crée un Lieu)
src/app/api/boxes/route.ts                            ← remplacé (scopé par place)
src/app/api/boxes/[id]/route.ts                       ← remplacé
src/app/api/boxes/[id]/history/route.ts               ← remplacé
src/app/api/boxes/[id]/reorder/route.ts               ← remplacé
src/app/api/export/route.ts                           ← remplacé
src/app/api/locations/route.ts                        ← remplacé
src/app/api/locations/[code]/route.ts                 ← remplacé
src/app/api/plan/route.ts                             ← remplacé
src/app/api/search/route.ts                           ← remplacé
src/app/print/page.tsx                                ← remplacé
src/app/page.tsx                                      ← ajoute PlaceSwitcher
```

Tous les autres fichiers du projet restent inchangés (composants UI, middleware, auth, etc.).

## Installation

### 1) Copie les fichiers du patch

Décompresse le zip et **écrase les fichiers existants** de ton projet `storage-box-app` avec ceux du patch. Les 3 nouveaux dossiers (`api/places/`, `app/places/`, `migrations/20260421200000_add_places/`) seront créés.

### 2) Aucune dépendance nouvelle

Pas de `npm install` nécessaire — tout fonctionne avec les libs existantes.

### 3) Applique la migration

```powershell
npx prisma migrate deploy
```

> ⚠️ Utilise bien `migrate deploy` et **pas** `migrate dev`. La migration `migration.sql` fournie contient la logique de rapatriement des données existantes, il ne faut pas qu'elle soit régénérée par Prisma.

Tu devrais voir :
```
Applying migration `20260421200000_add_places`
All migrations have been successfully applied.
```

> 💡 Si jamais Prisma te dit "Database schema is not empty" et refuse, c'est probablement que tu avais créé une migration manuellement entre temps. Dis-le moi.

### 4) Régénère le client Prisma

```powershell
npx prisma generate
```

Cette commande crée les types TypeScript pour les nouveaux modèles `Place` et `PlaceShare`.

### 5) Teste en local

```powershell
npm run dev
```

Ouvre http://localhost:3000. Tu devrais :
- Voir ton ancien plan comme avant (tes boîtes sont là)
- Voir un nouveau dropdown **"Lieu : Mon premier lieu"** dans le header
- Cliquer dessus → bouton **"+ Nouveau lieu"** en bas
- Page **`/places`** accessible via le dropdown → "⚙ Gérer mes lieux"

### 6) Commit et push

Quand tout marche en local :

```powershell
git add .
git commit -m "v10: multi-Lieu (phase B iteration 1)"
git push
```

Vercel détecte le push, lance `prisma migrate deploy` qui applique la migration sur Neon en production, puis build. ~2 min plus tard ton app déployée est à jour.

## Premiers pas avec plusieurs Lieux

### Créer un deuxième lieu
1. Clique sur "Lieu : Mon premier lieu" dans le header
2. Clique "+ Nouveau lieu"
3. Tape un nom (ex: "Cave") et valide
4. L'app recharge sur ce nouveau lieu, avec un plan vide

> Ce nouveau lieu n'a **pas** de plan auto-créé. Tu dois entrer en mode "Éditer le plan" et ajouter des rangées/cellules toi-même. C'est voulu — ça te laisse configurer ton lieu aux dimensions réelles.

### Renommer / Supprimer
Via le dropdown → "⚙ Gérer mes lieux" → boutons dans la liste.

> Tu ne peux pas supprimer ton dernier lieu (il t'en faut toujours un actif).

## Architecture technique

### `requirePlaceAccess()`
Chaque route API qui manipule des données commence par appeler ce helper :
1. Lit la session → userId
2. Lit le cookie `boxops-active-place` → placeId
3. Vérifie en DB que l'utilisateur a accès (owner ou share)
4. Vérifie le rôle minimal requis (`viewer` par défaut, `editor` pour modifs boîtes, `admin` pour modifs plan)
5. Retourne `{ userId, placeId, role }` ou une NextResponse d'erreur

Résultat : impossible d'accéder à un Lieu auquel tu n'as pas droit, même en forgeant des cookies ou des IDs.

### Cookie d'état
Le Lieu actif est stocké dans un cookie httpOnly `boxops-active-place`. Ça veut dire :
- Chaque onglet partage le même Lieu actif (cohérent pour un même utilisateur)
- Quand tu changes de Lieu dans un onglet, l'autre onglet verra le nouveau à sa prochaine action
- Le cookie est invalidé à la déconnexion

### Migration SQL
Elle fait 4 étapes :
1. Crée tables `Place` et `PlaceShare`
2. Insère un Lieu "Mon premier lieu" par utilisateur qui a déjà des données
3. Ajoute une colonne `placeId` nullable sur `Location` et `Box`, puis backfill
4. Verrouille : `NOT NULL`, `FOREIGN KEY`, nouvelle unique `(placeId, code)`, suppression des anciens index `userId`-based

Elle est idempotente-safe pour les déploiements frais (Vercel qui rejoue tout sur une DB vide) parce que toutes les étapes 1-4 sont cohérentes sur une DB sans données.

## Dépannage

**"Prisma schema and migration drift"** après avoir copié les fichiers
→ Supprime `node_modules/.prisma` et refais `npx prisma generate`.

**Le dropdown dit "—" et la page est vide**
→ Tu n'as pas encore de Lieu. Logique si tu n'avais pas de données en v9. Recharge la page, le bootstrap va t'en créer un.

**"Lieu introuvable" sur toutes les API**
→ Ton cookie pointe vers un Lieu supprimé. Passe par `/api/places/active` POST vers un Lieu existant, ou dégage le cookie manuellement (DevTools → Application → Cookies).

**Le plan est vide après migration alors que j'avais des boîtes**
→ Ouvre Prisma Studio (`npx prisma studio`) et regarde la table `Place`. Tu devrais avoir un "Mon premier lieu". Puis la table `Location` — chaque ligne doit avoir un `placeId` non nul. Si ce n'est pas le cas, la migration n'est pas passée complètement.

## Itération 2 à venir

- Table `PlaceShare` déjà prête → page de gestion des partages par Lieu
- Invitation **par email** (si l'autre personne a déjà un compte)
- Invitation **par lien unique** (génère une URL `https://box-ops.vercel.app/invite/abc123`)
- Modification de rôle / révocation de partage
- Notification visuelle quand quelqu'un te partage un Lieu ("X lieux partagés avec moi")
