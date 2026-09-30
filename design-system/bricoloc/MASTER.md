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
- Catégories : slider horizontal sur une seule rangée, sans cartes arrondies. Pictogrammes marine, numéros rouges, séparateurs fins ; défilement tactile et flèches de navigation. Pas de photo en fond, selon la préférence de David.

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


## Mise à jour du 30 septembre 2026

La couche `apps/web/app/redesign.css` complète les styles historiques sans modifier les moteurs de réservation, de disponibilité ou de facturation.

- Palette atelier : rouge `#CF2E24` (texte blanc lisible), marine `#142B3B`, fond chaud `#F7F6F2`, texte `#182E3B`.
- Bricolage Grotesque et Hanken Grotesk sont hébergées localement, avec leurs licences OFL. Pas de requête Google Fonts au chargement.
- Site : conteneur 1440 px ; hero 1600 px maximum ; catégories à icônes en slider sur toutes les tailles d’écran ; catalogue 4 colonnes sur grands écrans.
- Admin : navigation fixe défilante sur ordinateur / tablette paysage, tiroir sous 900 px ; groupes métiers et recherche ; priorités opérationnelles avant statistiques.
- Application native : largeur utile plafonnée à 1200 points ; catalogue et packs sur 2 à 4 colonnes sur tablette ; liste sur téléphone ; fenêtres de dates et produit plafonnées à 600 points ; barre d’onglets centrée et safe areas respectées.
- Motion : contenu visible par défaut, éléments hors écran révélés à leur entrée dans la fenêtre, prise en charge des éléments chargés après navigation ; suppression du minuteur global de 2,5 secondes ; préférence de mouvements réduits respectée.
- Référence de validation et limites : `docs/refonte-ui-ux-2026-09.md`.

## Références visuelles hors secteur — 30 septembre 2026

À la demande de David : élargir les références au voyage et à la location automobile.

- Airbnb (`https://www.airbnb.fr/`) : visuels dominants, texte posé sous les images, peu de cadres, hiérarchie compacte.
- SIXT (`https://www.sixt.fr/`) : contraste affirmé et réservation immédiatement identifiable. Conserver les dates facultatives du parcours Bricoloc, sans imposer un formulaire automobile.
- Application à l’accueil : cartes populaires et packs sans conteneur encadré ; rayon réservé aux médias ; titres plus sobres, prix et liens lisibles. Conserver les icônes et le slider des catégories.
- Conserver la charte Bricoloc, ne pas copier les textes, photos ou identités des références. Les photos de démonstration des produits restent provisoires.

## Édition catalogue et parc

- Une tâche à la fois : catalogue client ou machines internes ; masquer la liste pendant l’édition.
- Barre d’actions sticky : nom de fiche, fermer, enregistrer, retour d’erreur ; rester accessible sur tablette.
- Sections repliables : identité, présentation/photos, tarifs, documents, associations, approvisionnement/stock, publication. Adapter leur présence au type de fiche.
- Options rares ou sensibles (adresse publique, changement de type, paliers JSON) dans les détails avancés.
- Stock : recherche commune, filtre de disponibilité, catégories repliables et bouton explicite vers les exemplaires ; réserver les suppressions aux détails.
- BricoPacks : utiliser le même modèle d’édition pleine largeur, liste et édition séparées, actions en haut, sections par tâche. La recherche et les filtres restent conservés au retour à la liste.
- Inventaire : privilégier le scan et le pointage ; détails de série/emplacement repliables, aide accessible sans monopoliser le haut de page.
- Catalogue client : médias arrondis, aucune bordure extérieure ni ombre de carte ; informations et actions sous l’image, alignées par rangée. Services de l’accueil sur surface ouverte, avec des séparateurs fins.

## Direction révisée après validation de David

Le site public revient à la version `91c1e0c` (« c’est mieux »). La direction sans cadres et surfaces ouvertes de la dernière passe est retirée ; les règles précédentes sur ces deux points ne sont plus à appliquer. Conserver tout l’admin actuel.

Procéder désormais par proposition visuelle indépendante, une page à la fois, avant extension au site. Première proposition : `/apercu-fiche`, route de développement uniquement, avec le vrai visuel d’un produit Bricoloc. Titre et caractéristiques avant la galerie, panneau de réservation blanc bordé avec ombre légère, sélection active marine et bouton principal rouge. Sur tablette portrait : galerie, réservation puis détails. Aucune modification du panier réel, aucun déploiement.

## Référence fiche produit préférée par David

La proposition avec titre au-dessus de la galerie et panneau blanc de réservation est abandonnée. Pour l’aperçu isolé, suivre la fiche Bricoloc https://new.bricoloc.be/produits/agrafeuse-pneumatique-15-40mm : galerie encadrée à gauche, grand titre indigo à droite, palette rouge / lavande, réservation directement sur le fond de page. Réutiliser les composants existants. Ne pas étendre cette proposition avant retour de David ; ne pas modifier l’admin ni le panier réel.
