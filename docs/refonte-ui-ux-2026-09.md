# Refonte Bricoloc — septembre 2026

## Résultat

Version locale du dépôt `nqrko-jjd/bricoloc_app`, préparée sur la branche `design/modernisation-site-admin`. Le site en ligne et le dépôt distant n’ont pas été modifiés.

La refonte couvre l’habillage partagé du site, l’accueil, le catalogue, la navigation et la connexion admin, le tableau de bord, ainsi que plusieurs adaptations de l’application native sur tablette. Les pages métier existantes héritent des nouveaux styles ; elles n’ont pas toutes été restructurées individuellement.

## Analyse et choix

Le dossier du 4 septembre contient un prototype HTML, pas le code de l’application. L’application GitHub utilise Next.js 15 pour le site et l’admin, React Native / Expo pour le mobile, avec une API et des tarifs partagés.

Le site public actuel a été consulté sur `new.bricoloc.be`. La charte existante du dépôt a été lue avant les modifications. La comparaison avec [Boels](https://www.boels.com/fr-fr) et [Loxam, parcours par projet](https://www.loxam.fr/location-projet-travaux) a servi à retenir une recherche visible et une entrée par chantier ; la direction graphique reste propre à Bricoloc.

| Constat | Modification |
| --- | --- |
| Hero occupant presque tout l’écran, photo très assombrie | Hero plus compact, photo lisible, recherche et accès BricoPacks directs |
| Cartes et accroches souvent identiques | Catégories illustrées, rythmes de sections distincts, présentation de l’app raccourcie |
| Écart entre la charte et les styles effectifs | Bricolage Grotesque / Hanken Grotesk hébergées localement, marine et fonds chauds, rouge conservé |
| Titres des étapes et descriptions décalés | Texte corrigé en FR / NL / EN et dans les contenus démo ; compatibilité avec les anciens textes connus du CMS, conservation des textes personnalisés |
| Animations toutes révélées après 2,5 secondes | Apparition au vrai défilement, observation des nouveaux éléments, contenu visible sans JavaScript |
| Admin : 21 rubriques au même niveau | Navigation par métier, recherche de rubrique, état actif sur les sous-pages et langues |
| Tableau de bord centré sur les chiffres | Retraits, retours et préparations avant les indicateurs financiers |
| Connexion équipe préremplie et erreur dans une alerte navigateur | Champs étiquetés, saisie utilisateur, attente visible et erreur intégrée |
| Menus hors écran accessibles au clavier | Tiroirs fermés inertes, focus contenu dans le menu ouvert, Échap, retour au bouton d’ouverture, fermeture lors du passage en mode ordinateur |
| Catalogue sans retour utile lors d’un échec réseau | Squelettes de chargement, erreur et nouvelle tentative, effacement des filtres, sélection annoncée |
| Cœurs évoquant une fonction favoris absente | Retrait des éléments concernés sur les cartes web et native, et la fiche produit native |
| App conçue principalement pour téléphone | Grille catalogue et packs de 2 à 4 colonnes sur tablette, largeur utile plafonnée, fenêtres centrées, safe areas |
| Catalogue native limité à 40 articles | Chargement de la suite, gestion des erreurs et des réponses de recherche devenues obsolètes |

## Tablettes et grands écrans

- Site : contenu limité à 1440 px, hero à 1600 px ; pas d’étirement illimité des textes.
- Catégories : slider d’icônes sur une rangée, avec navigation tactile et flèches.
- Catalogue web : 4 colonnes sur grand écran, dispositions existantes adaptées aux formats plus petits.
- Admin : navigation latérale sur ordinateur et tablette paysage, tiroir sous 900 px ; tableaux conservés et défilement dans leurs panneaux.
- Application : largeur utile de 1200 points au maximum, grille recalculée avec la taille de la fenêtre et la rotation, liste sur téléphone.
- Fenêtres natives : calendrier et aperçu produit limités à 600 points sur tablette ; barre d’onglets centrée et marges système respectées.
- Les animations ne bloquent pas les interactions et respectent les mouvements réduits.

## Validation réalisée

- Vérification TypeScript des modules partagés, de l’API et du site : réussie.
- Vérification TypeScript de l’application native après les adaptations : réussie.
- Tests métier partagés : 27 réussis.
- Tests API sur une copie locale séparée de la base démo : 25 réussis, 1 test d’intégration DeepL ignoré faute de clé.
- Compilation de production Next.js : réussie, 147 pages générées.
- Contrôle visuel dans le navigateur de l’accueil, de la connexion équipe, du tableau de bord et du catalogue.
- Admin : menu tablette portrait, recherche « stock », fermeture par Échap et restauration du focus vérifiés.
- Catalogue : largeur 375, 768 et 1920 px contrôlée ; aucune largeur de page excessive détectée. En 1920 px, 4 colonnes mesurées ; en tablette, 2 colonnes.
- Capture conservée : `../catalogue-tablette.jpg` (données et images de démonstration).

## Limites et vérifications avant publication

La relance des aperçus Next.js après compilation et Expo Web a été refusée par le contrôle automatique d’exécution. Les vérifications visuelles citées ont été réalisées sur l’aperçu de développement déjà chargé ; les dernières corrections de contraste et de compatibilité des anciens textes ont été validées par compilation.

L’application native a été vérifiée par TypeScript et lecture du code, mais pas exécutée sur un iPad ou un Android physique. La rotation, le mode écran partagé, les grands caractères système, les safe areas et le clavier natif doivent être vérifiés sur les appareils utilisés par l’équipe. Le thème sombre et les mouvements réduits ont été pris en compte dans le code, mais leur rendu complet n’a pas été contrôlé sur appareil.

L’admin en ligne n’a pas été utilisé : le contrôle s’est fait avec le compte de démonstration de la copie locale. Aucune donnée réelle ni transaction n’a été modifiée. Les photos/tarifs de la base locale de démonstration diffèrent de ceux du site actuel ; les composants continuent de lire le catalogue réel de l’API lors du déploiement.

Le dépôt avait déjà des dépendances signalées par l’audit npm à l’installation. Aucune mise à niveau forcée des dépendances métier n’a été intégrée à cette refonte.

## Intégration

Les modifications sont regroupées sur une branche locale. Il faut les intégrer au dépôt distant et déployer le site/API selon le processus existant ; l’application native nécessite ensuite une nouvelle version Expo/EAS. Ne pas exécuter `db:reset` sur la base en ligne : cette commande a servi exclusivement à la nouvelle copie locale de démonstration.

Les changements de contenu démo ne remplacent pas les textes personnalisés dans l’admin. Les anciens trois textes décalés connus sont corrigés au rendu ; il est possible de les éditer ensuite dans l’admin selon la rédaction souhaitée.

Les fichiers `.env`, les bases locales, les clés et les dépendances installées sont exclus de l’archive de livraison. Les polices incluent leurs licences OFL.

## Ajustements après retour de David

- Catégories : retour au slider d’icônes sur une seule rangée ; pictogramme propre à chaque famille ; navigation tactile et flèches ; numéros rouges et séparateurs fins.
- Références hors secteur consultées : [Airbnb](https://www.airbnb.fr/) et [SIXT](https://www.sixt.fr/). Offres de l’accueil allégées, images dominantes et informations sous le visuel ; disparition des cadres entourant les produits et les packs, suppression du cœur décoratif sans action.
- Catalogue admin : séparation entre catalogue client et machines du parc ; colonnes adaptées à la sélection ; liste masquée pendant l’édition.
- Éditeur : sections repliables, actions toujours visibles pendant le défilement, confirmation après sauvegarde et blocage du double enregistrement. Adresse publique, changement de type et paliers personnalisés rangés dans les options avancées.
- Champs par type : pas de tarif ni publication pour une machine interne ; prix unitaire et approvisionnement pour un consommable, sans caution ni partenaires de location. La caution des consommables est enregistrée à zéro ; les autres valeurs cachées existantes sont conservées.
- Stock : recherche également sur les consommables, série, code-barres, identifiant et emplacement ; filtre disponibilité/entretien ; catégories repliables ; ouverture des exemplaires par bouton explicite ; états en français ; lien direct vers l’éditeur.
- Vérifications locales : fiche existante enregistrée, validation du nom requis, barre d’actions après défilement, formulaires machine/consommable, recherche de consommable, filtre entretien vide et navigation stock → fiche. TypeScript validé ; contrôles visuels sur tablette et grand écran. La base de démonstration ne contient pas de machines techniques rattachées : leur création a été inspectée sans ajout en base.
- Les aperçus locaux Next.js et API ont pu être relancés lors de cette passe. Le blocage antérieur concernant Expo reste une limite de la vérification native.

## Suite de la refonte — catalogue, packs et inventaire

- Références Airbnb et SIXT consultées à nouveau. Le catalogue client reprend les médias arrondis avec titres et prix à l’extérieur ; les boutons sont alignés en bas des rangées. Les catégories restent en slider d’icônes, conformément au retour de David.
- Accueil : retrait et livraison présentés sur une surface ouverte avec séparateurs fins, sans répéter les cartes des produits et des packs.
- BricoPacks admin : recherche par nom/famille, filtre en ligne/brouillon, bouton Modifier explicite, liste masquée pendant l’édition ; sections repliables et barre d’enregistrement toujours accessible. Les tarifs de la liste portent désormais la mention HTVA.
- Inventaire : aide de scan repliée, champ de scan prioritaire, lien vers les exemplaires, séries et emplacements accessibles à la demande. L’avancement compte seulement les exemplaires attendus au dépôt, pour éviter de dépasser 100 % lorsque des machines pointées changent d’état.
- Correction tablette : le tiroir de navigation reste fixé à la fenêtre ; fermé, il ne réserve plus une hauteur d’écran vide avant le contenu.
- Contrôles : catalogue à 768 px (2 colonnes) et 1920 px (4 colonnes), sans débordement ; boutons de la première rangée alignés. Recherche de pack, filtre brouillon vide, édition, sauvegarde inchangée d’un pack de démonstration et retour à la liste vérifiés. Barre d’actions à 76 px après défilement en tablette ; inventaire et ouverture/fermeture du menu contrôlés. Aucun changement de données de production.
- TypeScript et compilation de production Next.js réussis après cette passe. Aperçus locaux relancés ; captures `../accueil-services.png`, `../bricopack-tablette.png` et `../inventaire-tablette.png` conservées.

## Décision finale de David : retour à la version appréciée et proposition séparée

Cette décision remplace la direction de la passe précédente pour le site public : retour à `91c1e0c`, la version suivie du retour « c’est mieux ». Les améliorations ultérieures de l’admin (packs, inventaire, correction du tiroir tablette) sont conservées. L’instruction de revenir à new.bricoloc.be a été retirée par David ; elle n’a pas été appliquée.

- Catalogue public restauré ; styles sans cadres du catalogue et surfaces ouvertes des services retirés. Les écarts restants dans la feuille de styles par rapport à `91c1e0c` concernent uniquement l’admin.
- Proposition indépendante sur `/apercu-fiche`, disponible exclusivement en développement et non indexable. Elle ne remplace aucune fiche existante ; le parcours de réservation actuel reste inchangé.
- Maquette utilisant le vrai produit « Aspirateur eau et poussières industriel 1400 W – 35 L » de new.bricoloc.be : photos chargées directement depuis les médias publics Bricoloc, tarif observé 35 € TVAC/jour et caution 350 €. Informations figées pour revue visuelle, pas de nouvelle promesse de disponibilité ni d’enregistrement dans un panier.
- Galerie, calendrier, choix retrait/livraison et quantité utilisables pour évaluer la présentation. Le bouton d’ajout indique explicitement qu’aucun article n’est ajouté.
- Contrôles à 375, 768 et 1440 px : aucun débordement de page. Panneau non fixe sur fenêtres trop courtes ; sur tablette portrait, réservation placée après la galerie, avant les informations supplémentaires. TypeScript validé.
- Capture : `../proposition-fiche-produit.png`.

## Référence choisie : fiche Agrafeuse Pneumatique 15-40mm

David préfère la fiche existante https://new.bricoloc.be/produits/agrafeuse-pneumatique-15-40mm à la proposition précédente. Cette référence remplace la direction visuelle de la maquette aspirateur uniquement.

- `/apercu-fiche` reprend la galerie encadrée à gauche, le grand titre à droite, les contrôles de réservation sans carte englobante et la palette rouge / indigo / lavande de cette fiche.
- Photos, catégorie, tarif 20 € TVAC/jour, caution 300 € et note publique repris de la référence observée. Le montant de la maquette est explicitement un exemple pour une journée, même après sélection de dates ; aucun calcul de réservation ni écriture panier.
- Sur tablette portrait et mobile, galerie puis titre et réservation en une colonne. Les styles restent limités à cet aperçu ; site public approuvé et admin conservés.
- TypeScript validé ; photos chargées ; changement de photo, quantité, retrait/livraison, ouverture/fermeture du calendrier et message de simulation vérifiés. Aucun débordement à 375, 768 et 1440 px.
- Capture `../proposition-fiche-produit.png` actualisée. Aucun déploiement.

## Préparation publication — 30 septembre 2026

David autorise l’application du style validé aux vraies fiches produits avant publication. `product-reference.css` restaure les couleurs et la typographie de référence uniquement dans `.pdetail-page` ; les composants de réservation, les données API et les avis restent ceux du site réel. L’aperçu statique n’est pas exposé en production.

Validation : typecheck complet et compilation Next.js de production réussis ; tests partagés réussis, API 25 réussis / 1 intégration DeepL ignorée, sur copie locale de la base de démonstration. Aucun changement de schéma, infrastructure ou données de production. Le contrôle visuel de cette dernière intégration est limité par le refus automatique de démarrer le serveur local ; l’aperçu équivalent a été vérifié dans la passe précédente.
