# Assets réels Bricoloc — `apps/api/uploads/`

Déposés par David le 2026-09-01. Dossier **gitignoré** (160 Mo) → à synchroniser séparément vers le VPS.

## Contenu

| Type | Nombre | Notes |
|---|---|---|
| Photos produits (jpg/jpeg/webp/png) | ~385 | nommage mixte : slug FR (`aspirateur-eau-poussière-1000w-bricoloc-2.webp`) ou marque-modèle (`makita-HM1214C.jpg`). Plusieurs vues par produit (`-1`, `-2`…). |
| PDF | 8 | notices constructeur (Atika, FLEX VC21L, Maffel MT55, RIGID micro, SuperPro…) + `clauses-de-securite-locamat.pdf` |
| Logos | 3 | `logo-new.png`, `logo-new-vert.png` (version verticale), `logo_b.png` (le « B » seul) |
| Bannières | 5 | `bricoloc_header1..3.jpg`, `bricoloc_info.jpg` |
| Photos d'ambiance | ~10 | `pexels-*`, `young-worker-*`, `pose-parquet-*` — usage hero / éditorial |
| **Liste machines** | 1 xlsx + 2 ods + 1 pdf | **catalogue réel complet** — voir ci-dessous |
| `invoices/` | sous-dossier | factures PDF générées par l'app (ne pas toucher) |

## `Liste machine (1).xlsx` → `docs/discovery/liste-machines-sheet1.tsv`

**994 lignes**, 18 colonnes. Extrait via `scratchpad/xlsx2tsv.mjs`.

Colonnes : `Marque · Modèle · Qté · Type · Lien prix · Prix Achat Unitaire · Prix Total · Lien (constructeur) · Concurrent 1 (URL) · Jour · Semaine · Mois · Garantie · Concurrent 2 (URL) · Jour · Semaine · Mois · Garantie`

- **`Type`** (catégorie) n'est renseigné que sur la 1re ligne de chaque groupe (en-tête de section) — à propager en post-traitement.
- Les colonnes de prix = tarifs **concurrents** (benchmark), pas les nôtres. Le **tarif Bricoloc réel** est dans `tarif-bricoloc-2024.txt` (J/S/M/Garantie).
- **Marques du parc** (~70) : ABAC, AEG, AGP, AIRPRESS, ALTREX, ARROW, ATIKA, BATTIPAV, BOSCH, BRENNENSTUHL, BRICOLOC (marque maison), CARAT, DEWALT, DREMEL, EARLEX, EDMA, EIBENSTOCH, ELIX, EUROM, FESTOOL, FLEX, FLOTEC, FUTECH, GEBERIT, GRACO, HIKOKI, HILTI, HITACHI, HUSQVARNA, KARCHER, KLINDEX, LESCHA, M-TEC, MACC, MAFFEL, MAKITA, MASTER, MCCULLOCH, METABO, MILWAUKEE, MONDELIN, NILFISK, PASLODE, PIHER, PREBENA, RAPID, REHEAT, REMKO, REMS, RIGID, ROTHENBERGER, RUBI, SDMO, SECURX, SENCYS, SPIT, STANLEY, STEINEL, STIGA, STIHL, TOOLLAND, TURFMASTER, UNICRAFT…

## À faire (Lot 3)

1. Post-traiter le TSV : propager `Type`, normaliser, mapper `Type` → 10 catégories réelles.
2. Croiser avec `tarif-bricoloc-2024.txt` (tarifs) + `catalogue-woo.md` (slugs actuels).
3. Rapprocher chaque produit de ses photos dans `uploads/` (matching slug / marque-modèle).
4. Importer : `Product` (i18n), `PriceTier` (J/S/M), `deposit` (Garantie), `stockQty` (Qté), `brand`, images.
