# BOX·OPS — onboarding nouveaux utilisateurs

## Ce qui change

**Avant** : un nouvel utilisateur qui se connecte pour la première fois arrivait sur un plan 3×4 "Mon premier lieu" créé automatiquement. Pas de choix.

**Après** : premier login → redirection vers un **écran d'onboarding plein** qui demande :
- Un nom de lieu
- Un modèle parmi les 4 presets (placard / cave / garage / entrepôt) + option vide

Une fois validé, le lieu est créé et l'utilisateur arrive sur l'app normalement.

## Fichiers du patch

**2 fichiers à copier tels quels** (nouveaux ou à remplacer) :

```
src/app/api/bootstrap/route.ts          ← remplacé (ne crée plus de lieu auto)
src/app/onboarding/page.tsx             ← NOUVEAU (écran d'accueil)
```

**1 fichier à modifier manuellement** : `src/app/page.tsx`

## Installation — étape 1 : copier les fichiers

Via l'Explorateur Windows :
1. Décompresse ce zip
2. Copie `src/app/api/bootstrap/route.ts` par-dessus l'existant
3. Copie le dossier entier `src/app/onboarding/` dans ton projet (le dossier n'existe pas encore)

## Installation — étape 2 : modifier page.tsx

Ouvre `src/app/page.tsx` dans VS Code.

**Cherche ce bloc** (il est vers la ligne 80-95) :

```tsx
  // Bootstrap: on first login the user has no locations yet; ask the server
  // to create a starter plan. Idempotent, so safe to call on every mount.
  useEffect(() => {
    fetch("/api/bootstrap", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.created) {
          // Refresh to show the new plan
          refresh();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

**Remplace-le par** :

```tsx
  // On first mount: check if the user has any place. If not, redirect to
  // /onboarding where they'll choose a preset and name their first place.
  const router = useRouter();
  useEffect(() => {
    fetch("/api/bootstrap", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.hasPlaces) {
          router.replace("/onboarding");
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

**Et en haut du fichier**, trouve la ligne :

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

Juste en dessous, ajoute :

```tsx
import { useRouter } from "next/navigation";
```

## Test

```powershell
npm run dev
```

Pour **tester le flow onboarding** :
1. Crée un nouveau compte de test (ou va sur Neon et supprime un User + ses Place pour un compte test)
2. Connecte-toi → tu dois être redirigé vers `/onboarding`
3. L'écran doit afficher : "Bienvenue - Configurons votre premier espace"
4. Remplis un nom + choisis un preset → bouton "Commencer →"
5. Tu arrives sur l'app normale avec ton lieu créé

Pour **tester que les utilisateurs existants ne sont pas embêtés** :
1. Avec ton compte actuel (qui a déjà des lieux), va sur `/` → ça marche normalement
2. Essaye d'aller manuellement sur `/onboarding` → tu dois être redirigé vers `/`

## Commit

```powershell
git add src/app/api/bootstrap/route.ts src/app/onboarding/page.tsx src/app/page.tsx
git commit -m "feat: onboarding explicite pour nouveaux utilisateurs"
git push
```

## Notes

- L'onboarding n'est **pas obligatoire** au sens où l'utilisateur pourrait techniquement fermer son navigateur et revenir. Mais tant qu'il n'a aucun lieu, il sera toujours renvoyé sur `/onboarding` à chaque login. Donc en pratique c'est un passage quasi-obligé.
- Si un utilisateur supprime TOUS ses lieux un jour, il sera aussi renvoyé vers `/onboarding`. C'est logique : sans lieu, rien à afficher.
- Les utilisateurs invités à un lieu par quelqu'un d'autre **ne passent pas** par l'onboarding (leur `sharedCount > 0` fait que `hasPlaces = true`). Logique aussi : ils ont déjà où aller.
