# BOX·OPS — tweak : cellules carrées

Modification cosmétique : les cellules du plan sont désormais **carrées** (5rem × 5rem fixes) au lieu de rectangles qui s'étiraient sur toute la largeur de l'écran.

Un meuble de largeur 2 fait donc maintenant 10rem × 5rem (rectangle deux fois plus large que haut), cohérent.

Si le plan dépasse de l'écran (plus de ~16 cellules de large), il scrollera horizontalement comme avant.

## Fichier à remplacer

Juste `src/components/MapGrid.tsx`.

## Installation

```powershell
# Copie le fichier depuis le zip, écrase l'existant
git add src/components/MapGrid.tsx
git commit -m "tweak: cellules carrées dans le plan"
git push
```
