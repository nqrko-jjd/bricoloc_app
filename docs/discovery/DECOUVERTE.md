# BRICOLOC — Découverte (projet réel)

> Société : Bricoloc (JJD Consult — david@jjd-consult.be). Refonte de la plateforme
> actuelle (WordPress + WooCommerce + plugin booking) sur `www.bricoloc.be`.
> On garde les **droits complets** sur le contenu du site actuel.

## Marque

| Élément | Valeur |
|---|---|
| Rouge | **`#EE2C24`** (⚠️ pas `#E52421` — corriger partout) |
| Bleu marine | `#0B1D3A` |
| Logo | Marque « B » = deux flèches (→ ←) = cycle location / in-out. `Logo/logo-b-rouge.svg` (icône 800×800), `Bricoloc_Promo_Pack/logo*.png` (lockups) |
| Tagline principale | « Louez mieux, travaillez mieux » · aussi « Le bon outil, au bon moment » · « Location outils en ligne » |
| Hero du site actuel | « Votre projet, nos outils, Votre succès ! » |
| 3 arguments | Tarifs dégressifs (30 % / 3 j · 50 % / semaine · 60 % / mois) · Livraison ou Click & Collect (7h30–17h, lun–sam) · BricoPacks sur-mesure |

## Modèle de prix réel (TARIF_BRICOLOC_2024.pdf, ~120 machines)

- Colonnes : **Qté (stock) · Jour · Semaine · Mois · Garantie (caution, tiers A/B/…)**
- Règle constante : **Semaine = 4 × Jour**, **Mois = 12 × Jour**
- Exemples : Agrafeuse grillage 5/20/60 · Aspirateur eau+poussières 20/80/240 · Carotteuse diamant 45/180/540 · Marteau-piqueur 12 kg 20 J · Tondeuse thermique 75/300/900
- Texte complet : `docs/discovery/tarif-bricoloc-2024.txt`

## Catégories réelles

`forer_casser` · `travail-du-beton-pierre` · `travail-du-bois` · `peintures-et-finitions` ·
`chauffage-et-deshumidification` · `exterieur` · `plomberie-et-electricite` ·
`echelles-echafaudages` · `nettoyage` · `bricopack`

## BricoPacks

percement mur dur · percement mur creux · enduisage mur · pose parquet/stratifié · pose carrelage < 45 cm

## Catalogue (~90 machines actives + packs)

Liste complète des slugs WooCommerce : voir `docs/discovery/catalogue-woo.md`.
API accessible : `https://www.bricoloc.be/wp-json/wc/store/v1/products` et `/wp-json/wp/v2/product`.
Photos produits (webp) présentes dans `Downloads/Bricoloc/` (nommées par slug).

## Assets disponibles (`C:\Users\david\Downloads\Bricoloc\`)

| Dossier | Contenu utile |
|---|---|
| `Logo/` | SVG + AI du logo et de la marque « B » |
| `Bricoloc_Promo_Pack/` | logo.png / logo_alt.png / logo_vert.png, icônes SVG (drill, sander, scaffold) |
| `Image site/` | photos d'ambiance (chantier, carrelage, perçage…) + BricoPack |
| `Video/` | `man_destroying_wall (1080p).mp4` (hero possible) + ~25 vidéos d'usage d'outils |
| `Icones/` | step1–4.png (« comment ça marche »), drill.ai |
| `*.webp` (racine) | photos produits par slug (marteau-piqueur, disqueuse, décapeur…) |
| `Texture-pattern/` | motifs outils sans couture |
| `3D/Entrepot/` | rendus 3D de l'entrepôt |
| `Branding/` | cartes de visite, mockups camionnette |
| ❓ **Brico / Bolt** | pas trouvés — à demander à David (existent-ils ? sous quel nom ?) |

## Contexte technique cible (décisions prises 2026-09-01)

- **3 langues : FR / NL / EN** — i18n complet (site + appli + admin + contenu + SEO hreflang).
  Contenus : **auto-traduction FR → NL/EN via DeepL** à chaque modif du FR, corrigeable en admin (1 champ/langue).
  → besoin d'une **clé API DeepL** (offre gratuite 500k car./mois OK au début).
- Base : SQLite (dev) → **PostgreSQL** (prod). Changement = datasource Prisma + migrations.
- Paiement : **Mollie** (compte existant chez David) — Bancontact + cartes. Clé test d'abord, live au Lot 7. Mock conservé pour le dev.
- **Migration : catalogue uniquement** (machines + tarifs + photos). PAS les comptes clients.
- Scanner : **Zebra TC51** (DataWedge keyboard-wedge) **+ smartphone (caméra)** **+ scanner USB** — mode Terminal unique, mêmes écrans. Étiquettes QR + Code128.
- Hébergement : **VPS Combell** (belge, support 24/7 FR/NL, hébergeur Node reconnu) + **Docker Compose** (API + web + Postgres + reverse-proxy HTTPS + backups). Pile portable. Behostings = plan B.
- Déploiement final : VPS Combell + domaine bricoloc.be + redirections SEO depuis l'ancien WordPress.
- Nav : 10 catégories réelles + section accueil « Pour quel chantier ? » (léger).
- Mascottes Brico/Bolt : plus tard (à produire).

## Plan validé

Feuille de route : `docs/plan-refonte.html` (artefact : https://claude.ai/code/artifact/54974954-4182-491c-bb66-35f957f72ffe).
Lots : 0 Fondations · 1 Accueil · 2 Fiches produits · 3 Catalogue réel · 4 Back-office · 5 Scan/inventaire · 6 Mobile · 7 Paiement+déploiement.
**Prochaine étape : 2 maquettes (accueil + fiche produit) avant de coder le Lot 0.**

## Réf. espace client — MyKiloutou (à intégrer, lots 2 & 6)

- Contrats, accords tarifaires, devis, factures, réservations en cours, doc technique
- **Infos de livraison** du matériel (suivi)
- **Demander la reprise** + **prolonger** en self-service
- **Dépôt de bons de commande** (comptes Pro)
- Alerte « matériel inutilisé depuis 3 j » → invite à le rendre pour arrêter la facturation
- (plus tard) bilan carbone des équipements loués
