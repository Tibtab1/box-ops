# BOX·OPS — patch v12.1 : polissage & synchro temps réel

> **Prérequis** : v12 + ses 3 hotfixes déjà appliqués.

## Ce qui change

### 1. Bouton "Copier" bien visible sur les liens d'invitation
Quand tu génères un lien d'invitation, celui-ci s'affiche maintenant dans un champ dédié avec un bouton **📋 Copier** à côté. Clic → le lien est dans ton presse-papier et le bouton passe à **✓ Copié** en vert pendant 2 secondes. Plus besoin de cliquer sur le texte tronqué en espérant que ça copie.

Fonctionne aussi sur navigateurs qui bloquent l'API clipboard (fallback via textarea).

### 2. Synchro temps réel entre utilisateurs (polling 5s)
Quand deux personnes utilisent l'app sur le même lieu, les modifications de l'un apparaissent chez l'autre **en 5 secondes maximum**, sans rien faire. Tu déplaces une boîte → ton/ta partenaire voit la boîte se déplacer sur son écran peu après. Ajout de boîte, renommage, changement de couleur : tout se synchronise.

**C'est totalement silencieux** : pas de notification, pas de toast, pas de clignotement. Le plan et l'inventaire se mettent à jour progressivement comme s'ils étaient "vivants".

#### Comment c'est fait (pour ta culture)
- Un minuteur interroge le serveur toutes les 5 secondes quand ton onglet est **visible** (pas en arrière-plan, pour pas gaspiller de requêtes)
- Les données reçues sont comparées à celles affichées via un **fingerprint** (empreinte stable)
- Si rien n'a changé → on ne touche pas à l'affichage (zéro re-render, zéro clignotement)
- Si quelque chose a changé → React met à jour uniquement les morceaux concernés
- Pause automatique du polling pendant que tu remplis un formulaire de création/édition de boîte (pour pas effacer ce que tu tapes)
- Reprise + refresh immédiat quand tu reviens sur l'onglet après une absence

## Fichiers du patch

```
src/app/page.tsx                         ← remplacé (refresh avec mode silent + polling)
src/app/places/[id]/page.tsx             ← remplacé (bouton Copier)
src/lib/fingerprint.ts                   ← NOUVEAU (comparaison stable)
```

## Installation

### 1) Copie les 3 fichiers

Décompresse le zip et écrase les fichiers du même nom dans ton projet.

### 2) Teste en local

Pas de migration, pas de `npm install`. Juste :

```powershell
npm run dev
```

Si `npm run dev` tournait déjà, le hot-reload devrait prendre tout seul.

### 3) Scénario de test pour la synchro

Le plus simple pour vérifier :

1. **Chrome normal** : tu es connecté en tant que toi (compte A)
2. **Fenêtre privée** : connecte-toi avec un autre compte (B) qui a accès au même lieu que A
3. Dans Chrome normal : clique sur une boîte, change son nom, sauvegarde
4. Laisse la fenêtre privée **visible** — tu vois la boîte changer de nom **en 5s maximum**, sans rien faire

Autres tests :
- Déplace une boîte par drag & drop dans Chrome normal → apparaît sur B en 5s
- Ajoute une boîte → apparaît sur B en 5s
- Édite le plan dans A → B voit le nouveau plan en 5s

### 4) Scénario de test pour le bouton Copier

1. Va sur un lieu que tu possèdes → "👥 Partages"
2. Clique "Inviter par lien" → "Générer le lien"
3. Le nouveau lien apparaît dans la liste "Invitations en attente"
4. Champ texte avec l'URL + bouton "📋 Copier" → clic → passe à "✓ Copié"
5. Colle quelque part (Ctrl+V) pour vérifier que l'URL est bien dans ton presse-papier

### 5) Push en prod

```powershell
git add .
git commit -m "v12.1: bouton copier + synchro polling 5s"
git push
```

Vercel redéploie.

## Aspects techniques à connaître

- **Consommation réseau** : ~12 petites requêtes par minute et par onglet actif. Vercel Free accepte plusieurs millions de requêtes/mois, aucun risque d'atteindre les limites avec un usage familial.
- **Latence ressentie** : entre 0 et 5 secondes. Si tu veux plus rapide, il faudra passer à Pusher/Ably (WebSockets). Mais 5s est suffisant pour la plupart des cas d'usage "famille qui s'organise".
- **Conflits** : si deux personnes modifient la même boîte en même temps (très rare), le dernier qui sauvegarde gagne. C'est normal pour cette échelle d'usage.
- **Pause polling pendant formulaire** : garantit que ta saisie ne sera pas effacée par un poll. Dès que tu fermes le formulaire, le polling reprend.

## Limites

- **Pas de synchro immédiate** : délai de 0 à 5s. C'est le compromis coût/simplicité.
- **Pas de notification "X a modifié Y"** : c'est silencieux par design (choix à la conception). Si tu veux voir qui a fait quoi, faudra attendre l'historique par lieu de la v13.
- **Si le serveur Neon dort** (après 5 min d'inactivité) le premier poll peut prendre 1-2s. Les suivants sont instantanés.

## Prochaine étape (v13 — Polish final)

- Historique par lieu avec "qui a fait quoi, quand"
- Compteurs par tag dans la sidebar
- Transfert de propriété entre utilisateurs
- Mobile drag & drop
