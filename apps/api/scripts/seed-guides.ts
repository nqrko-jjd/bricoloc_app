/**
 * Sème les articles du magazine « Conseils & DIY » (FR = source).
 * Traduction NL/EN : `npx tsx scripts/translate-guides.ts` (DeepL).
 * Idempotent (upsert par slug).
 *
 *   npx tsx scripts/seed-guides.ts
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

interface GuideSeed {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  readMinutes: number;
  tone: 'red' | 'navy' | 'light';
  relatedSlugs?: string[];
  featured?: boolean;
  body: string;
}

const GUIDES: GuideSeed[] = [
  {
    slug: 'choisir-ponceuse-murs',
    category: 'peinture',
    title: 'Comment choisir la bonne ponceuse pour ses murs ?',
    excerpt:
      'Girafe, excentrique ou vibrante : le bon outil, les bons grains et les gestes pour un mur prêt à peindre, sans traces ni sur-ponçage.',
    readMinutes: 6,
    tone: 'red',
    featured: true,
    relatedSlugs: ['ponceuse-girafe', 'ponceuse-excentrique', 'aspirateur-chantier'],
    body: `Poncer un mur avant peinture, ce n'est pas « tout attaquer au gros grain ». Le but est d'égaliser les raccords d'enduit, de dépolir l'ancienne peinture et d'enlever les défauts, sans creuser le support. Le choix de la machine dépend surtout de la surface et de la hauteur.

## La ponceuse girafe : grandes surfaces et plafonds
C'est l'outil des cloisons entières et des plafonds. Le plateau rond au bout d'un bras télescopique permet de travailler debout, sans échafaudage, et l'aspiration intégrée évite le nuage de poussière. On la réserve aux surfaces d'un seul tenant : au-dessus de 15 m², elle fait gagner un temps considérable. Pensez à raccorder un aspirateur de chantier à filtre fin — sans lui, la girafe encrasse vite le papier et sature la pièce.

## La ponceuse excentrique : reprises et petites zones
Pour les angles, les retours de fenêtre, les réparations ponctuelles ou un simple dépoli avant une nouvelle couche, la ponceuse excentrique Ø125 mm suffit. Elle est maniable, précise, et son mouvement aléatoire ne laisse pas de spirales visibles si on ne force pas.

## La ponceuse vibrante : finitions douces
Plateau rectangulaire, mouvement orbital court : elle lisse sans mordre. On l'utilise en toute fin, au grain fin, pour uniformiser avant la sous-couche.

## Les grains, dans l'ordre
- **80** : dérochage, raccords d'enduit marqués, ancienne peinture écaillée.
- **120** : passe intermédiaire, la plus courante avant peinture.
- **180 à 240** : finition, juste avant la sous-couche.

Ne sautez jamais plus d'un cran : passer de 80 à 240 laisse des rayures que la peinture révélera en lumière rasante.

## Les bons gestes
Gardez la machine à plat, avancez lentement et par bandes qui se recouvrent de moitié. Ne restez pas immobile : l'excentrique creuse en quelques secondes. Dépoussiérez au chiffon microfibre humide avant de peindre, et éclairez le mur en rasant pour repérer ce qui reste à reprendre.`,
  },
  {
    slug: 'poser-parquet-flottant',
    category: 'bois',
    title: 'Poser un parquet flottant sans mauvaise surprise',
    excerpt:
      'Préparer le support, gérer les joints de dilatation et réussir les découpes : la méthode pour une pose stable qui ne « claque » pas.',
    readMinutes: 8,
    tone: 'navy',
    relatedSlugs: ['scie-sur-table', 'scie-plongeante', 'aspirateur-chantier'],
    body: `Un parquet flottant se pose vite… quand la préparation est faite. La plupart des défauts — lames qui bougent, bruit sec au pas, joints qui s'ouvrent — viennent du support ou du joint de dilatation, pas de la pose elle-même.

## Le support : plan, sec, propre
La règle : maximum 2 mm de flèche sous une règle de 2 m. Une bosse se poncera, un creux se comblera avec un ragréage autolissant (séchage 24 à 48 h). Sur dalle béton, vérifiez l'humidité : un film plastique scotché une nuit ne doit pas montrer de condensation au matin. Sinon, film pare-vapeur obligatoire.

## L'acclimatation
Laissez les paquets fermés 48 h dans la pièce où ils seront posés, à plat. Le bois et le stratifié bougent avec l'hygrométrie ; poser des lames « froides » sorties du camion, c'est provoquer des ouvertures de joints en hiver.

## La sous-couche
Elle corrige les micro-défauts, atténue le bruit et, en rez-de-chaussée ou sur dalle, isole de l'humidité résiduelle. Posez-la bord à bord (pas de recouvrement), remontez-la légèrement le long des murs.

## Le joint de dilatation : le point clé
Laissez **8 à 10 mm** tout autour de la pièce, contre chaque mur, chaque tuyau, chaque seuil de porte. Des cales le maintiennent pendant la pose. Au-delà de 8 m de long ou entre deux pièces, prévoyez un profil de séparation. Sans ce jeu, le parquet gonfle et se soulève en « tuile ».

## Les découpes
Une scie sur table ou une scie plongeante sur rail donne des coupes nettes et droites, indispensables pour la première et la dernière rangée. Coupez toujours le décor **vers le bas** avec une scie circulaire, **vers le haut** avec une scie sauteuse, pour éviter les éclats sur la face visible. Pour les passages de tuyaux, percez au diamètre + 20 mm et recoupez.

## L'ordre de pose
Commencez le long du mur le plus droit, languette vers le mur. Décalez les joints bout à bout d'au moins 30 cm d'une rangée à l'autre. Terminez chaque rangée avec la chute de la précédente si elle fait plus de 30 cm : moins de perte, motif plus naturel.

## Les finitions
Retirez les cales, posez les plinthes (fixées au mur, jamais au parquet) et les barres de seuil. Le parquet doit « flotter » librement dessous.`,
  },
  {
    slug: 'nettoyeur-haute-pression-erreurs',
    category: 'exterieur',
    title: 'Nettoyeur haute pression : les 3 erreurs à éviter',
    excerpt:
      'Pression, distance et choix de buse : ce qui abîme les joints, le bois et les façades — et comment nettoyer efficacement sans casser.',
    readMinutes: 4,
    tone: 'light',
    relatedSlugs: ['nettoyeur-haute-pression-200', 'nettoyeur-haute-pression'],
    body: `Le nettoyeur haute pression est redoutable d'efficacité… et de dégâts quand on l'utilise mal. Trois erreurs reviennent tout le temps.

## Erreur 1 : trop près, trop fort
Sur une terrasse en pierre reconstituée, du bois ou un crépi, une lance tenue à 10 cm arrache la surface : traces en bandes, bois pelucheux, joints creusés. Gardez **30 à 40 cm** de distance, testez d'abord sur une zone peu visible, et travaillez à pression réduite si la machine le permet. Le nettoyage vient du bon équilibre débit/distance, pas de la seule pression.

## Erreur 2 : la mauvaise buse
- **Buse crayon (rotabuse / turbo)** : très concentrée, réservée au béton brut et aux surfaces très encrassées. Jamais sur du bois, du joint ni de la peinture.
- **Buse éventail 25°** : l'usage courant pour terrasses, murs, mobilier.
- **Buse 40° / basse pression** : application de détergent et rinçage délicat.

Commencez toujours par la buse la plus douce et resserrez seulement si nécessaire.

## Erreur 3 : oublier le détergent et le temps de pose
La haute pression seule décolle mal les traces grasses, les lichens et les algues. Appliquez un produit adapté (façade, terrasse, bois) à basse pression, laissez agir 5 à 10 minutes sans laisser sécher, puis rincez de haut en bas. Vous nettoierez mieux, plus vite, à pression plus faible — donc avec moins de risque.

## En bonus
Ne dirigez jamais le jet vers les menuiseries, les joints de fenêtre, les compteurs ou les prises extérieures. Sur une terrasse, travaillez toujours dans le sens des lames ou des joints, jamais en travers.`,
  },
  {
    slug: 'decouper-carrelage-sans-eclats',
    category: 'carrelage',
    title: 'Découper du carrelage sans éclats',
    excerpt:
      'Coupe droite, coupe en L, arrondi : quel outil pour quel cas, et comment préparer chaque coupe pour un chant net.',
    readMinutes: 7,
    tone: 'navy',
    relatedSlugs: ['coupe-carrelage-electrique', 'meuleuse', 'carrelette'],
    body: `Un carrelage éclaté au bord, c'est un joint irrégulier et une arête coupante. La coupe nette tient à l'outil choisi et à la vitesse d'exécution.

## La carrelette manuelle : les coupes droites
Pour la faïence murale et les carreaux grès jusqu'à ~10 mm, la carrelette (coupe-carreaux à molette) est rapide et propre. Une seule rayure franche et continue, sans repasser, puis on casse d'un coup sec. Molette adaptée au matériau, guide bien réglé : c'est 80 % des coupes d'un chantier.

## Le coupe-carrelage électrique (à eau) : grès cérame et grands formats
Dès que le carreau est dur (grès cérame pleine masse), épais, ou grand format, la scie à eau avec disque diamant s'impose. L'eau refroidit le disque et évacue la poussière ; le chant ressort lisse. Avancez **lentement et régulièrement** : forcer fait chauffer et éclater. Entrez et sortez le carreau doucement, c'est là que ça éclate.

## La meuleuse avec disque diamant : les découpes complexes
Coupes en L (autour d'une prise), entailles, arrondis : une petite meuleuse Ø125 avec disque diamant à jante continue. Tracez au crayon gras, coupez en plusieurs passes peu profondes plutôt qu'une seule, finissez les angles rentrants par l'arrière pour ne pas dépasser sur la face visible.

## Les trous
- **Petit diamètre (robinet, vis)** : foret diamant, perceuse **sans percussion**, en biais pour amorcer puis à plat, avec un filet d'eau.
- **Grand diamètre (évacuation)** : scie-cloche diamant, même principe, sans forcer.

## Les bons réflexes
Mesurez, tracez, et gardez toujours 2 à 3 mm de jeu au mur (le joint et la plinthe couvriront). Ébavurez chaque chant coupé avec une cale abrasive : le carreau se pose mieux et ne coupe pas les doigts.`,
  },
  {
    slug: 'percer-droit-tous-materiaux',
    category: 'preparation',
    title: 'Percer droit dans tous les matériaux',
    excerpt:
      'Brique, béton, plâtre ou carrelage : identifier le support, choisir le foret et le mode de perçage avant d’attaquer.',
    readMinutes: 5,
    tone: 'red',
    relatedSlugs: ['perforateur-sds-plus', 'perceuse-visseuse', 'perforateur'],
    body: `Un trou raté, c'est une cheville qui tourne dans le vide ou un carrelage fendu. Avant de percer, une seule question : dans quoi ?

## Identifier le support
Frappez le mur du doigt. Son creux = cloison en plaque de plâtre (BA13). Son plein et dur = béton ou brique pleine. Un point qui « sonne » différemment tous les 40 cm sur une cloison = les montants. Un aimant qui tient = poutrelle métallique, on ne perce pas.

## Le bon couple foret / mode
- **Plâtre, BA13, bois** : foret bois ou universel, perceuse en mode **rotation seule**, sans percussion. Cheville à expansion (type Molly) pour le placo.
- **Brique creuse** : foret béton, **percussion douce ou rotation seule**. La percussion forte casse les cloisons internes de la brique et la cheville ne tient plus.
- **Brique pleine, parpaing** : foret béton, percussion.
- **Béton** : perforateur SDS+ avec mèche béton. Une perceuse à percussion classique s'épuise et chauffe.
- **Carrelage** : foret spécial carrelage ou diamant, **rotation seule**, jusqu'à traverser l'émail — ensuite on peut passer en percussion douce dans le support.

## La technique
Marquez le point au pointeau (ou une croix de ruban de masquage sur le carrelage, qui empêche le foret de glisser). Démarrez perpendiculaire au mur, à vitesse lente, sans appuyer : c'est le foret qui coupe, pas la pression. Retirez régulièrement pour évacuer la poussière. Percez 5 mm de plus que la longueur de la cheville.

## Sécurité
Avant de percer près d'un interrupteur, d'une prise ou dans une cuisine/salle de bain, utilisez un détecteur de métaux et de câbles. Les gaines électriques passent souvent à l'horizontale et à la verticale de chaque appareillage.`,
  },
  {
    slug: '7-outils-renover-une-piece',
    category: 'bricopack',
    title: 'Les 7 outils pour rénover une pièce',
    excerpt:
      'Notre sélection essentielle pour démolir, préparer, poncer, peindre et terminer proprement — sans matériel superflu.',
    readMinutes: 3,
    tone: 'light',
    relatedSlugs: ['perforateur-sds-plus', 'ponceuse-girafe', 'aspirateur-chantier', 'station-de-peinture-airless'],
    body: `Rénover une chambre ou un salon ne demande pas un atelier complet. Sept machines couvrent l'essentiel du chantier, de la dépose à la peinture.

## 1. Le perforateur SDS+
Pour déposer un ancien carrelage, saigner un mur, fixer des tasseaux dans le béton. Avec un burin, il remplace la massette pour les petites démolitions.

## 2. La scie sauteuse ou la scie plongeante
Découpes de plinthes, de panneaux, ajustage de parquet ou de lambris. La scie plongeante sur rail si vous posez un sol.

## 3. La ponceuse girafe
Le gain de temps numéro un : murs et plafond dépolis et égalisés en une passe, debout, avec aspiration.

## 4. L'aspirateur de chantier
Indispensable derrière la girafe et la scie. Filtre fin, cuve eau et poussières : il garde le chantier vivable et se raccorde aux machines.

## 5. Le mélangeur (malaxeur)
Enduit de rebouchage, ragréage, colle : un malaxeur sur perceuse ou un modèle dédié fait un mélange homogène sans grumeaux, condition d'un mur lisse.

## 6. La station de peinture airless
Pour un plafond et quatre murs, l'airless applique la sous-couche et la peinture deux à trois fois plus vite qu'au rouleau, avec un rendu tendu. Protégez bien : elle projette large.

## 7. L'échafaudage roulant ou l'escabeau plateforme
Travailler en hauteur en sécurité, avec les deux mains libres et de quoi poser le pot. Pour un plafond, l'échafaudage roulant évite de descendre toutes les deux minutes.

## Et en pack ?
Ces outils se louent ensemble dans nos BricoPacks « Rénovation » : une seule réservation, une seule date, un tarif groupé.`,
  },
];

async function main() {
  let n = 0;
  for (const g of GUIDES) {
    await prisma.guide.upsert({
      where: { slug: g.slug },
      update: {
        category: g.category,
        title: g.title,
        excerpt: g.excerpt,
        body: g.body,
        readMinutes: g.readMinutes,
        tone: g.tone,
        relatedSlugs: g.relatedSlugs ?? [],
        featured: g.featured ?? false,
        published: true,
      },
      create: {
        slug: g.slug,
        category: g.category,
        title: g.title,
        excerpt: g.excerpt,
        body: g.body,
        readMinutes: g.readMinutes,
        tone: g.tone,
        relatedSlugs: g.relatedSlugs ?? [],
        featured: g.featured ?? false,
        published: true,
      },
    });
    n++;
  }
  console.log(`${n} guides semés.`);
  console.log('→ Traduire NL/EN : npx tsx scripts/translate-guides.ts');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
