# Bricoloc — Design System (MASTER)

> Source de vérité visuelle. Établi à partir de la skill *ui-ux-pro-max* (E-commerce +
> Hyperlocal Service + Marketplace) et de la charte réelle Bricoloc. Les fichiers
> `pages/*.md` peuvent surcharger ce master pour une page précise.

## Direction

**« Atelier / catalogue »** — grille rigoureuse (discipline suisse) portant des blocs de
couleur affirmés et une grille *bento* de catégories, avec révélations au scroll.
Le rouge est utilisé **avec décision** (accent unique) contre le marine et un blanc chaud.
Le motif « flèches in/out » du logo revient comme fil conducteur (louer → travailler → rendre).

- **Pattern landing** : Hero + Feature-Rich Showcase + Bento Grid + preuve sociale + CTA
- **Styles** : Vibrant & Block-based (énergie) × Swiss Modernism 2.0 (rigueur) × Motion-Driven (scroll)
- **À éviter** : néon/enfantin, dégradés violets, glassmorphism, emoji-icônes, tout centré, `rounded-lg` partout, cartes à liseré d'accent

## Couleurs (tokens)

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `--primary` | `#EE2C24` | `#F5473C` | rouge de marque — accent unique, CTA, survols |
| `--on-primary` | `#FFFFFF` | `#0A0F17` | texte sur rouge |
| `--navy` | `#0B1D3A` | `#0B1D3A` | blocs sombres, pied de page, borne |
| `--ink` | `#15213A` | `#E9ECF2` | texte principal |
| `--muted-fg` | `#586074` | `#9AA3B4` | texte secondaire |
| `--ground` | `#F6F5F1` | `#0A121D` | fond de page (blanc chaud, léger biais rouge) |
| `--surface` | `#FFFFFF` | `#131C2A` | cartes, panneaux |
| `--surface-2` | `#EFEDE7` | `#0F1826` | fonds alternés, puces |
| `--border` | `#E3DFD6` | `#26313F` | filets |
| `--ok` | `#12833F` | `#3FB56E` | « disponible » (sémantique, ≠ accent) |
| `--warn` | `#A85F00` | `#D68A2E` | « stock limité » |
| `--err` | `#B21E17` | `#E8564C` | « indisponible » |
| `--ring` | `#EE2C24` | `#F5473C` | focus clavier |

Contraste vérifié ≥ 4.5:1 pour le texte, ≥ 3:1 pour les gros glyphes, dans les deux thèmes.

## Typographie

- **Display** : `Bricolage Grotesque` (700 / 800) — titres, prix mis en avant, gros chiffres.
  Grotesque contemporain, légèrement industriel, avec du caractère. **Validé par David.**
- **Texte + labels + données** : `Hanken Grotesk` (400 / 500 / 600 / 700 / 800) — lecture, UI,
  eyebrows (700 majuscule `letter-spacing .16em`), prix secondaires, tags.
  ⚠️ **Pas de police mono** — David l'a trouvée « machine à écrire », rejetée.

Base 16 px, interligne 1.62. Titres `text-wrap: balance`. Labels majuscules `letter-spacing: .14–.16em`.
Échelle : 13 · 15 · 16 · 18 · 22 · 28 · 38 · 54 · 76.

## Espacement & layout

- Base **8 px** ; échelle 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96.
- Grille **12 colonnes**, conteneur max **1200 px**, gouttières 24 px (mobile) → 40 px (desktop).
- Mesure de lecture ~68 caractères.
- Rayons : `6px` (puces/inputs), `14px` (cartes), `22px` (grandes tuiles/bento), `999px` (pastilles).
- Cartes : filet `--border` + ombre douce (`0 1px 2px / 0 12px 30px` navy à ~6 %). **Pas** de liseré d'accent.
- Bento catégories : tuiles de tailles variées (1×1, 2×1), image en fond, voile navy au survol + label.

## Motion (scroll)

- **Reveal** : `opacity 0→1`, `translateY 10–20px→0`, 320–480 ms, `cubic-bezier(.2,.7,.2,1)`.
  Déclenché à l'entrée dans le viewport (IntersectionObserver), une seule fois.
- **Bento stagger** : vague depuis le centre, 60 ms entre tuiles, `back.out(1.4)` léger.
- **Hover** : cartes `translateY(-2px)` + ombre ; CTA fond `--primary` → `--primary` foncé, 160 ms.
- **Compteurs / prix** : incrément 600 ms à l'apparition.
- `prefers-reduced-motion` : tout est immédiat, aucun transform.

## Icônes

Jeu unique type **Lucide**, trait `1.75px`, taille en tokens (`16 / 20 / 24`). SVG uniquement.
Jamais d'emoji. Style outline pour la navigation, filled réservé aux états actifs.

## Composants clés

- **Barre de recherche** proéminente (accueil + header) avec autocomplétion produits/catégories + chips « les plus recherchés ».
- **Bandeau de période** (dates de location) : discret mais toujours visible, modifiable partout.
- **Carte produit** : image 16:10, tag catégorie mono, nom (display), prix `X €/jour` + `sem. / mois`, caution, pastille de disponibilité, bouton « Ajouter ».
- **Sélecteur de prix en paliers** (fiche produit) : 3 cartes — Jour · Semaine (−×) · Mois (−×).
- **Sélecteur Pro / Particulier** : bouton discret dans le header (défaut : Particulier / TVAC).
- **Sélecteur de langue** : FR / NL / EN dans le header + pied de page.

## Contexte

FR / NL / EN. EUR. Dates `JJ/MM/AAAA`. HTVA + TVAC. Belgique.
Mobile : React Native — polices embarquées (`expo-font`), cibles tactiles ≥ 44 pt, safe areas.
Borne 16" tactile : cibles ≥ 64 pt, texte ≥ 20 px, navigation courte, reset après inactivité.
