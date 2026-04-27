\# BOX·OPS — Contexte projet



\## Identité

SaaS de gestion d'espace de stockage personnel. Plan 2D/3D où l'utilisateur place ses boîtes, meubles et cadres dans des cellules.



\## Stack

\- Next.js 14.2.15 + TypeScript + Tailwind

\- Prisma 5.22 + PostgreSQL (Neon Free)

\- NextAuth v5 (Google + email/pwd)

\- Déployé sur Vercel : https://box-ops.vercel.app

\- GitHub : https://github.com/Tibtab1/box-ops (privé)

\- Coût : 0€/an actuel



\## Plateforme dev

\- Windows PowerShell

\- Path local : C:\\Users\\Utilisateur\\Downloads\\storage-box-app\\storage-box-app

\- Encodage : éviter les commandes PowerShell qui touchent à des fichiers avec accents (utiliser l'Explorateur Windows pour copier-remplacer)



\## Features en production

\- Plan 2D/3D iso, cellules carrées de capacité 20

\- Multi-place avec partage et invitations email (Resend)

\- Boîtes empilables, meubles 1×1 à 3×3 avec contenu, cadres sur arêtes

\- Drag \& drop boîtes / meubles / cadres

\- Inventaire filtrable (kind, tags, couleur, placement)

\- Undo Ctrl+Z, notifications, polling silent 5s

\- Onboarding nouveaux users, presets de lieux (closet/cellar/garage/warehouse)

\- Dark mode, exports, distance entre boîtes

\- Compression d'images, photos sur boîtes

\- Champs pro : SKU (référence) et quantité sur boîtes/meubles

\- Page /stock : inventaire groupé par SKU avec totaux de quantités

\- Favoris : étoile sur boîtes (BoxDetailPanel), filtre ★ dans inventaire, scroll auto

\- Hauteur 3D ×1/×2/×3 : picker dans BoxForm, rendu 3D FurniturePrism echelle heightFactor

\- Rayon X : toggle opacité meubles en vue 3D (toggle ✦ dans MapGrid3D)

\- Rotation meuble : bouton ↻ dans BoxDetailPanel (swap spanW/spanH via PATCH)

\- Vue partagée (split view) : plan + inventaire côte-à-côte, bouton ⊞

\- 3D→inventaire : clic boîte en vue 3D surligne l'élément dans l'inventaire

\- Suggestions tags : autocomplete dans BoxForm (prop allTags depuis page.tsx)

\- UI optimiste : handleBoxDrop met à jour cells local avant retour API

\- /api/activity : flux d'événements (moves + PlanLog) pour historique du plan



\## Modèle cadres (kind: "flat") — important

Refonte récente (V4). Un cadre n'est PAS dans une cellule, il vit sur l'arête entre 2 cellules.



Colonnes Box pour les cadres :

\- flatEdgeRowA, flatEdgeColA : cellule de référence

\- flatEdgeRowB, flatEdgeColB : cellule voisine (NULL = bord extérieur)

\- widthCm, heightCm : dimensions en cm

\- flatType : "painting" | "photo" | "poster" | "mirror" | "other"

\- isFragile : boolean

\- estimatedValueCents : valeur estimée en centimes



Création : bouton "🖼 + Cadre" → mode placement → clic sur ligne du plan

Édition : clic sur la barre du cadre

Déplacement : drag \& drop de la barre vers une autre arête



API /api/locations retourne { cells, flats } (objet, pas array)



\## Conventions code

\- Code en anglais, UI en français

\- Aesthetic "blueprint industrial" (couleurs : ink, paper, blueprint, safety)

\- Migrations Prisma datées (YYYYMMDDHHMMSS\_description)

\- Workflow après modif schema : npx prisma migrate deploy → npx prisma generate → restart npm run dev

\- Toujours commit + push après une feature qui marche localement (Vercel auto-deploy)



\## TODO immédiat

\- (vide — tous les TODOs immédiats sont livrés)



\## Idées pour la suite

\- Drag \& drop cadres entre lieux différents

\- Page /activity : vue historique des événements (PlanLog + moves)

\- Export PDF du plan complet pour assurance

\- Mode "déménagement" : cocher des boîtes pour les marquer prêtes à partir

\- API publique pour intégration domotique



\## Commercialisation envisagée

\- Micro-entreprise APE 62.01Z (à créer le moment venu)

\- Stripe pour billing

\- Pricing évoqué : 3-30€/mois selon plan

\- Cible : particuliers avec self-storage / multi-domiciles, petites entreprises

