# BOX·OPS — Améliorations cadres

3 améliorations sur la feature cadres :

## 1. Drag & drop des cadres entre arêtes

Tu peux maintenant **glisser-déposer une barre de cadre** vers une autre arête du plan, sans passer par "Supprimer + Recréer".

**Comment ça marche** :
- Survole une barre de cadre → curseur "grab" + tooltip "clic pour éditer · glisser pour déplacer"
- Clique-maintiens et tire → la barre devient semi-transparente, **toutes les arêtes du plan deviennent des zones de drop** en bleu pâle
- Pendant le drag, la zone survolée s'illumine en **orange safety** (couleur de cible)
- Lâche sur l'arête voulue → le cadre est déplacé en base via PATCH, toast de confirmation

**Conditions d'activation** :
- Le drag fonctionne dans le même contexte que celui des boîtes (rôle owner/admin/editor, pas en mode édition du plan, pas en mode placement)
- Le clic simple (sans drag) reste actif pour ouvrir l'édition

## 2. Filtre type dans l'inventaire

L'inventaire (onglet "Inventaire") a maintenant un nouveau filtre **Type** avec 4 options :
- **Tout** (par défaut)
- **📦 Boîtes** seulement
- **🖼 Cadres** seulement
- **🪑 Meubles** seulement

Chaque ligne de l'inventaire affiche désormais aussi :
- Une **icône kind** au début (📦/🖼/🪑)
- Pour les cadres, l'icône varie selon le type (🎨 tableau, 📷 photo, 📜 poster, 🪞 miroir, 🖼 autre)
- Un **badge ⚠** orange pour les cadres fragiles
- Le compteur en haut s'adapte ("3 cadres" au lieu de "3 boîtes" si filtre actif)

## 3. Suppression colonne `flatEdge` legacy

La colonne deprecated `flatEdge` (`"N"|"S"|"E"|"W"` de l'ancienne version) est supprimée de la base. Cleanup propre.

## Note sur la 3D des cadres

J'ai laissé la **vue 3D des cadres** pour plus tard. La 3D actuelle utilise des polygones SVG iso et je n'ai pas pu vérifier la version exacte de ton `MapGrid3D.tsx` actuel. Si tu veux qu'on s'y attaque, à la prochaine session envoie-moi le fichier et je l'adapte.

## Fichiers du patch

```
prisma/migrations/20260427100000_drop_legacy_flat_edge/migration.sql   ← NOUVEAU (DROP COLUMN)
prisma/schema.prisma                                                   ← remplacé (retire flatEdge)

src/app/page.tsx                                                       ← handleFlatDrop ajouté
src/components/MapGrid.tsx                                             ← drag & drop des barres
src/components/InventoryList.tsx                                       ← filtre kind + icônes
```

## Installation

### 1. Copier les fichiers

Via l'Explorateur Windows : décompresse, copie `src/` et `prisma/` par-dessus, accepte de remplacer.

### 2. Migration Prisma

```powershell
cd C:\Users\Utilisateur\Downloads\storage-box-app\storage-box-app
npx prisma migrate deploy
npx prisma generate
```

La migration supprime juste la vieille colonne `flatEdge`. Aucun risque.

### 3. Restart serveur

```powershell
# Ctrl+C dans la fenêtre où tourne npm run dev
npm run dev
```

### 4. Tests

**Drag & drop cadres** :
1. Vue plan, ne sois pas en mode édition
2. Survole un cadre → tooltip dit "glisser pour déplacer"
3. Clique-maintiens, déplace → barre devient pâle, arêtes deviennent bleu clair
4. Survole une autre arête → elle devient orange
5. Lâche → toast "Cadre déplacé", la barre apparaît au nouvel endroit

**Filtre inventaire** :
1. Onglet "Inventaire" → "Filtres"
2. Nouvelle section "Type" avec 4 boutons
3. Clique "🖼 Cadres" → seuls les cadres restent visibles, compteur "X / Y cadres"
4. Vérifie que les cadres ont leur icône (🎨 si tableau, 📷 si photo, etc.)

## Commit

```powershell
git add prisma src/app src/components
git commit -m "improvements: drag & drop cadres entre arêtes + filtre type inventaire + drop colonne legacy"
git push
```

Vercel applique la migration et redéploie automatiquement.

## Limitations

- **Drag & drop sur mobile** : le drag HTML5 natif est limité sur mobile. Sur tablette ça peut marcher avec un long-press.
- **Pas de drag des cadres entre lieux** : un cadre reste dans son `placeId`. Le drag déplace seulement entre arêtes du même lieu.
- **3D des cadres** : pas encore. Voir note ci-dessus.
