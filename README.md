# BOX·OPS — v12 HOTFIX : correction MapGrid.tsx

## Bug corrigé

Dans la v12 initiale, `src/components/MapGrid.tsx` référençait les variables `dragEnabled`, `draggedBox`, `dragOverCode`, `setDraggedBox`, `setDragOverCode` et `onBoxDrop` dans la fonction `CellButton` qui ne les recevait pas en paramètres. Résultat : erreur `ReferenceError: dragEnabled is not defined` au chargement de la page.

J'avais supposé que le rendu des cellules était inline dans le map, mais c'était une fonction séparée `CellButton`. Mon oubli, désolé.

## Correction

Passage des 6 variables en props à `CellButton`, aussi bien au niveau de l'appel (`MapGrid` → `CellButton`) que de la signature du composant.

## Installation

**Remplace uniquement le fichier `src/components/MapGrid.tsx`** par celui du hotfix. Pas besoin de migration, pas de `npm install`, rien d'autre.

```powershell
# Copie le fichier depuis le zip, écrase l'ancien
# Puis (si npm run dev n'a pas Auto-reload) :
```

Tu n'as rien à faire de plus — le hot reload de Next devrait prendre le nouveau fichier tout seul. Rafraîchis la page, l'erreur doit disparaître et tu peux tester le drag & drop.

## Push en prod

Une fois que ça marche en local :

```powershell
git add src/components/MapGrid.tsx
git commit -m "v12 hotfix: pass drag props to CellButton"
git push
```
