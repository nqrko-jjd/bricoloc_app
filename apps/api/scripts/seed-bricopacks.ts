/**
 * Gamme BricoPack 2026 — 36 packs « choisissez le résultat ».
 *
 *   npx tsx scripts/seed-bricopacks.ts          (local)
 *   docker compose exec api node dist/scripts/seed-bricopacks.js   (prod, si compilé)
 *
 * Chaque pack = un produit `kind: 'PACK'` + `packMeta` (famille, niveau, équipe,
 * outils inclus avec rôle + « pourquoi », consommables suggérés, packs liés).
 * Le prix jour du pack = somme des tarifs jour des outils − remise (défaut 30 %),
 * arrondi. Les outils sont désignés par slug (doivent exister au catalogue).
 *
 * ⚠️ Contenus rédigés au plus proche du concept mais à FAIRE VALIDER par David
 * (quels outils exactement, quels consommables, quels prix).
 */
import '../src/env.js';
import { prisma } from '../src/db.js';
import { buildI18nText, translationEnabled } from '../src/lib/translate.js';

type Item = { slug: string; role: string; why: string };
type Conso = { label: string; detail: string; price: number };
type Pack = {
  slug: string;
  name: string;
  family: string;
  category: string;
  level: 'facile' | 'intermédiaire' | 'technique';
  team: string;
  popular?: boolean;
  discount?: number;
  intro: string;
  items: Item[];
  consumables?: Conso[];
  related?: string[];
};

const FAM_CAT: Record<string, string> = {
  peinture: 'peintures-finitions',
  'sols-bois': 'travail-du-bois',
  carrelage: 'beton-pierre',
  'gros-oeuvre': 'forer-casser',
  plomberie: 'plomberie-electricite',
  electricite: 'plomberie-electricite',
  jardin: 'exterieur',
  nettoyage: 'nettoyage',
  hauteur: 'echelles-echafaudages',
  manutention: 'forer-casser',
};

const C = {
  ruban: { label: 'Ruban de masquage', detail: '50 m · bords nets', price: 6.9 },
  bache: { label: 'Bâche de protection', detail: '4 × 5 m · réutilisable', price: 8.5 },
  abrasifs: { label: "Lot d'abrasifs", detail: 'Grains 120 / 180 / 220', price: 12.9 },
  enduit: { label: 'Enduit de rebouchage', detail: 'Pot de 1 kg', price: 9.5 },
  rouleaux: { label: 'Kit rouleaux & pinceaux', detail: 'Murs, plafonds, angles', price: 18.9 },
  masques: { label: 'Masques antipoussière', detail: 'Lot de 3 (FFP2)', price: 7.9 },
  gants: { label: 'Gants de chantier', detail: 'Paire, taille L', price: 3.5 },
  lunettes: { label: 'Lunettes de protection', detail: 'Anti-projections', price: 4.5 },
  sacs: { label: 'Sacs à gravats', detail: 'Lot de 10 · 60 L', price: 9.9 },
  film: { label: 'Film de protection sol', detail: '25 m × 1 m · antidérapant', price: 12.5 },
  colle: { label: 'Cartouche de colle/mastic', detail: 'MS polymère', price: 8.9 },
} satisfies Record<string, Conso>;

const PACKS: Pack[] = [
  /* ─────────────── PEINTURE ─────────────── */
  {
    slug: 'peindre-une-piece',
    name: 'Peindre une pièce',
    family: 'peinture',
    category: 'peintures-finitions',
    level: 'facile',
    team: '1 pers.',
    popular: true,
    intro:
      'Tout ce qu’il faut pour préparer, corriger et peindre murs et plafond proprement — réuni dans un seul pack.',
    items: [
      { slug: 'ponceuse-girafe', role: 'PRÉPARER', why: 'Lisser murs et plafonds vite fait, sans poncer des heures à la main.' },
      { slug: 'aspirateur-eau-et-poussieres-1000w-20-l', role: 'TRAVAILLER PROPREMENT', why: 'Branché à la ponceuse, il aspire la poussière et garde la pièce nette.' },
      { slug: 'malaxeur-de-mortier', role: 'PRÉPARER', why: 'Pour une peinture homogène, sans grumeaux, avant l’application.' },
      { slug: 'ponceuse-vibrante-triangulaire', role: 'FINIR', why: 'Pour les angles et les zones que la girafe n’atteint pas.' },
      { slug: 'echelle-de-toit-2-m', role: 'FINIR', why: 'Atteindre plafonds et hauts de murs dans une position stable.' },
      { slug: 'enrouleur-de-cable-40-m', role: 'TRAVAILLER PROPREMENT', why: 'Déplacer les machines dans toute la pièce sans changer de prise.' },
    ],
    consumables: [C.ruban, C.bache, C.abrasifs, C.enduit, C.rouleaux, C.masques],
    related: ['renover-des-boiseries', 'peindre-au-pistolet', 'nettoyage-apres-travaux'],
  },
  {
    slug: 'peindre-au-pistolet',
    name: 'Peindre au pistolet',
    family: 'peinture',
    category: 'peintures-finitions',
    level: 'intermédiaire',
    team: '1–2 pers.',
    intro: 'Couvrir rapidement un logement vide, un garage ou un atelier à la station airless.',
    items: [
      { slug: 'pulverisateur-de-peinture-airless-portable', role: 'APPLIQUER', why: 'Couvre en une fraction du temps d’un rouleau, film régulier.' },
      { slug: 'echelle-de-toit-2-m', role: 'FINIR', why: 'Traiter les plafonds et les hauteurs sans forcer.' },
      { slug: 'aspirateur-eau-et-poussieres-1000w-20-l', role: 'TRAVAILLER PROPREMENT', why: 'Dépoussiérer les supports avant projection.' },
      { slug: 'enrouleur-de-cable-40-m', role: 'TRAVAILLER PROPREMENT', why: 'Alimenter la station partout dans le volume.' },
    ],
    consumables: [C.bache, C.ruban, C.film, C.masques],
    related: ['peindre-une-piece', 'renover-des-boiseries'],
  },
  {
    slug: 'renover-des-boiseries',
    name: 'Rénover des boiseries',
    family: 'peinture',
    category: 'peintures-finitions',
    level: 'facile',
    team: '1 pers.',
    intro: 'Décaper et repeindre portes, volets, escaliers ou meubles.',
    items: [
      { slug: 'decapeur-thermique', role: 'DÉCAPER', why: 'Ramollit les anciennes couches pour les retirer proprement.' },
      { slug: 'ponceuse-excentrique-sans-fil-125mm', role: 'PRÉPARER', why: 'Reprend le bois à nu et casse la brillance avant peinture.' },
      { slug: 'ponceuse-vibrante-triangulaire', role: 'FINIR', why: 'Pour les moulures, chants et recoins.' },
      { slug: 'aspirateur-eau-et-poussieres-1000w-20-l', role: 'TRAVAILLER PROPREMENT', why: 'Capte les poussières de ponçage à la source.' },
    ],
    consumables: [C.abrasifs, C.ruban, C.rouleaux, C.masques],
    related: ['peindre-une-piece', 'fabriquer-et-assembler'],
  },

  /* ─────────────── SOLS & BOIS ─────────────── */
  {
    slug: 'poser-un-parquet-stratifie',
    name: 'Poser un parquet stratifié',
    family: 'sols-bois',
    category: 'travail-du-bois',
    level: 'intermédiaire',
    team: '1–2 pers.',
    popular: true,
    intro: 'Poser un sol flottant, réaliser les découpes et soigner les finitions.',
    items: [
      { slug: 'scie-circulaire', role: 'DÉCOUPER', why: 'Coupes droites nettes dans les lames, rapides et régulières.' },
      { slug: 'scie-a-onglet', role: 'DÉCOUPER', why: 'Coupes d’angle précises pour les seuils et les plinthes.' },
      { slug: 'ponceuse-vibrante-triangulaire', role: 'PRÉPARER', why: 'Corriger un point haut du support avant la pose.' },
      { slug: 'aspirateur-eau-et-poussieres-1000w-20-l', role: 'TRAVAILLER PROPREMENT', why: 'Support propre = pose sans grincements.' },
    ],
    consumables: [
      { label: 'Cales de dilatation', detail: 'Sachet de 30', price: 5.9 },
      { label: 'Sous-couche acoustique', detail: 'Rouleau 15 m²', price: 19.9 },
      C.colle,
    ],
    related: ['poncer-un-parquet', 'installer-plinthes-moulures'],
  },
  {
    slug: 'poncer-un-parquet',
    name: 'Poncer un parquet',
    family: 'sols-bois',
    category: 'travail-du-bois',
    level: 'technique',
    team: '1 pers.',
    intro: 'Remettre à neuf un parquet massif existant.',
    items: [
      { slug: 'ponceuse-a-bande-100-mm', role: 'PONCER', why: 'Attaque les surfaces et enlève l’ancienne finition.' },
      { slug: 'ponceuse-excentrique-150mm', role: 'FINIR', why: 'Adoucit la surface et rattrape les traces de bande.' },
      { slug: 'ponceuse-vibrante-triangulaire', role: 'FINIR', why: 'Bords, angles et sous les radiateurs.' },
      { slug: 'aspirateur-eau-et-poussieres-industriel-1250w-23-l', role: 'TRAVAILLER PROPREMENT', why: 'Le ponçage de parquet fait énormément de poussière — indispensable.' },
    ],
    consumables: [C.abrasifs, C.masques, { label: 'Pâte à bois', detail: 'Teinte chêne · 500 g', price: 8.9 }],
    related: ['poser-un-parquet-stratifie', 'renover-des-boiseries'],
  },
  {
    slug: 'fabriquer-et-assembler',
    name: 'Fabriquer et assembler',
    family: 'sols-bois',
    category: 'travail-du-bois',
    level: 'intermédiaire',
    team: '1 pers.',
    intro: 'Découper et assembler panneaux, étagères ou petits meubles.',
    items: [
      { slug: 'scie-sur-table-73-cm', role: 'DÉCOUPER', why: 'Refends et coupes répétées dans les panneaux, avec précision.' },
      { slug: 'defonceuse', role: 'USINER', why: 'Feuillures, rainures et chants profilés propres.' },
      { slug: 'perceuse-visseuse-sans-fil', role: 'ASSEMBLER', why: 'Percer et visser sans fatigue, à couple réglé.' },
      { slug: 'ponceuse-excentrique-sans-fil-125mm', role: 'FINIR', why: 'Adoucir toutes les faces avant montage.' },
    ],
    consumables: [C.abrasifs, C.colle, { label: 'Boîte de vis à bois', detail: 'Assortiment 4×30 à 5×60', price: 11.9 }],
    related: ['installer-plinthes-moulures', 'installer-une-cuisine'],
  },
  {
    slug: 'installer-plinthes-moulures',
    name: 'Installer plinthes & moulures',
    family: 'sols-bois',
    category: 'travail-du-bois',
    level: 'facile',
    team: '1 pers.',
    intro: 'Réaliser des coupes précises et terminer proprement une pièce.',
    items: [
      { slug: 'scie-a-onglet', role: 'DÉCOUPER', why: 'Onglets à 45° réguliers pour des angles qui ferment bien.' },
      { slug: 'cloueur-sans-fil-15-50-mm', role: 'POSER', why: 'Fixe les baguettes sans pré-perçage ni traces de marteau.' },
      { slug: 'detecteur-bois-metal', role: 'SÉCURISER', why: 'Repérer câbles et tuyaux avant de clouer dans le mur.' },
    ],
    consumables: [C.colle, C.ruban, { label: 'Pointes pour cloueur', detail: 'Boîte de 1000', price: 9.9 }],
    related: ['fabriquer-et-assembler', 'peindre-une-piece'],
  },
  {
    slug: 'installer-une-cuisine',
    name: 'Installer une cuisine',
    family: 'sols-bois',
    category: 'travail-du-bois',
    level: 'technique',
    team: '2 pers.',
    popular: true,
    intro: 'Monter les meubles, découper et poser le plan de travail.',
    items: [
      { slug: 'perceuse-visseuse-sans-fil', role: 'ASSEMBLER', why: 'Monter les caissons et fixer les meubles hauts.' },
      { slug: 'scie-circulaire', role: 'DÉCOUPER', why: 'Découpes du plan de travail et des joues.' },
      { slug: 'defonceuse', role: 'USINER', why: 'Évier, plaque et jonction de plans à l’anglaise.' },
      { slug: 'detecteur-bois-metal', role: 'SÉCURISER', why: 'Fixer dans le mur sans toucher une gaine.' },
      { slug: 'echelle-de-toit-2-m', role: 'POSER', why: 'Poser les meubles hauts à bonne hauteur, en sécurité.' },
    ],
    consumables: [C.colle, C.film, { label: 'Silicone sanitaire', detail: 'Cartouche translucide', price: 7.5 }],
    related: ['fabriquer-et-assembler', 'installer-un-sanitaire'],
  },

  /* ─────────────── CARRELAGE ─────────────── */
  {
    slug: 'poser-du-carrelage',
    name: 'Poser du carrelage',
    family: 'carrelage',
    category: 'beton-pierre',
    level: 'intermédiaire',
    team: '1–2 pers.',
    popular: true,
    intro: 'Carreler un sol ou un mur, du format standard au grand format.',
    items: [
      { slug: 'coupe-carrelage-75-cm', role: 'DÉCOUPER', why: 'Coupes droites nettes sans éclat, jusqu’au grand format.' },
      { slug: 'coupe-carrelage-electrique-portable', role: 'DÉCOUPER', why: 'Découpes en L, arrondis et petites reprises à l’eau.' },
      { slug: 'malaxeur-de-mortier', role: 'MÉLANGER', why: 'Colle et mortier homogènes, à la bonne consistance.' },
      { slug: 'meuleuse-a-beton-125-mm', role: 'PRÉPARER', why: 'Reprendre un ancien ragréage ou une laitance avant pose.' },
    ],
    consumables: [
      { label: 'Croisillons auto-nivelants', detail: 'Kit 100 clips + cales', price: 14.9 },
      { label: 'Peigne à colle', detail: '10 mm inox', price: 6.5 },
      C.masques,
      C.gants,
    ],
    related: ['retirer-un-ancien-carrelage', 'renover-les-joints'],
  },
  {
    slug: 'retirer-un-ancien-carrelage',
    name: 'Retirer un ancien carrelage',
    family: 'carrelage',
    category: 'beton-pierre',
    level: 'intermédiaire',
    team: '1–2 pers.',
    intro: 'Déposer l’ancien revêtement et préparer le support.',
    items: [
      { slug: 'marteau-piqueur-5-kg-10-j', role: 'DÉMOLIR', why: 'Décolle carreaux et chape-colle sans s’épuiser.' },
      { slug: 'meuleuse-a-beton-125-mm', role: 'PRÉPARER', why: 'Araser les résidus de colle et retrouver un support plan.' },
      { slug: 'aspirateur-eau-et-poussieres-industriel-1250w-23-l', role: 'TRAVAILLER PROPREMENT', why: 'La dépose de carrelage sature l’air de poussière.' },
    ],
    consumables: [C.sacs, C.masques, C.gants, C.lunettes],
    related: ['poser-du-carrelage', 'demolir-une-cloison'],
  },
  {
    slug: 'renover-les-joints',
    name: 'Rénover les joints',
    family: 'carrelage',
    category: 'beton-pierre',
    level: 'facile',
    team: '1 pers.',
    intro: 'Enlever et remplacer joints de carrelage et silicones.',
    items: [
      { slug: 'outil-multifonction', role: 'DÉGARNIR', why: 'Gratte et ouvre les vieux joints sans abîmer les carreaux.' },
      { slug: 'aspirateur-eau-et-poussieres-1000w-20-l', role: 'TRAVAILLER PROPREMENT', why: 'Aspirer la poussière de joint au fur et à mesure.' },
    ],
    consumables: [
      { label: 'Lot de lames de dégarnissage', detail: '3 largeurs', price: 12.9 },
      { label: 'Cartouche de silicone', detail: 'Sanitaire · translucide', price: 7.5 },
    ],
    related: ['poser-du-carrelage', 'nettoyage-apres-travaux'],
  },

  /* ─────────────── GROS ŒUVRE ─────────────── */
  {
    slug: 'demolir-une-cloison',
    name: 'Démolir une cloison',
    family: 'gros-oeuvre',
    category: 'forer-casser',
    level: 'intermédiaire',
    team: '1–2 pers.',
    intro: 'Démonter une cloison légère ou effectuer une petite démolition.',
    items: [
      { slug: 'marteau-piqueur-7-kg-10-j', role: 'DÉMOLIR', why: 'Ouvre briques et blocs légers efficacement.' },
      { slug: 'disqueuse-230-mm', role: 'DÉCOUPER', why: 'Traits de coupe nets pour maîtriser la ligne de démolition.' },
      { slug: 'detecteur-bois-metal', role: 'SÉCURISER', why: 'Localiser gaines et conduites avant de casser.' },
      { slug: 'aspirateur-eau-et-poussieres-industriel-1400-w-35-l', role: 'TRAVAILLER PROPREMENT', why: 'Contient la poussière de démolition.' },
    ],
    consumables: [C.sacs, C.masques, C.lunettes, C.gants],
    related: ['percer-du-beton', 'nettoyage-apres-travaux'],
  },
  {
    slug: 'percer-du-beton',
    name: 'Percer du béton',
    family: 'gros-oeuvre',
    category: 'forer-casser',
    level: 'facile',
    team: '1 pers.',
    intro: 'Réaliser des perçages sûrs dans le béton, la pierre ou la maçonnerie.',
    items: [
      { slug: 'marteau-perforateur', role: 'PERCER', why: 'Perce vite le béton armé sans forcer sur le poignet.' },
      { slug: 'carotteuse-diamant-a-eau-sec', role: 'PERCER', why: 'Grands diamètres nets : passages de tuyaux, ventilations.' },
      { slug: 'detecteur-bois-metal', role: 'SÉCURISER', why: 'Vérifier qu’aucun fer ou câble ne se trouve derrière.' },
    ],
    consumables: [
      { label: 'Jeu de forets SDS-plus', detail: '5 à 12 mm', price: 14.9 },
      C.masques,
      C.lunettes,
    ],
    related: ['faire-une-saignee', 'adapter-prises-cablage'],
  },
  {
    slug: 'realiser-une-dalle-ou-chape',
    name: 'Réaliser une dalle ou chape',
    family: 'gros-oeuvre',
    category: 'beton-pierre',
    level: 'technique',
    team: '2–3 pers.',
    intro: 'Préparer et couler une petite surface en béton, mortier ou chape.',
    items: [
      { slug: 'malaxeur-de-mortier', role: 'MÉLANGER', why: 'Gâchées régulières et rapides, sans bétonnière encombrante.' },
      { slug: 'loiselet-plaque-vibrante', role: 'COMPACTER', why: 'Serrer le support avant coulage pour éviter les tassements.' },
      { slug: 'brouette-de-jardinage150-l', role: 'APPROVISIONNER', why: 'Acheminer béton et matériaux jusqu’au point de coulage.' },
    ],
    consumables: [C.gants, C.sacs, { label: 'Règle de maçon alu', detail: '2 m', price: 12.9 }],
    related: ['monter-un-mur', 'preparer-un-terrain'],
  },
  {
    slug: 'monter-un-mur',
    name: 'Monter un mur',
    family: 'gros-oeuvre',
    category: 'beton-pierre',
    level: 'technique',
    team: '2 pers.',
    intro: 'Construire une petite maçonnerie en blocs ou briques.',
    items: [
      { slug: 'malaxeur-de-mortier', role: 'MÉLANGER', why: 'Mortier de montage homogène, tout au long du chantier.' },
      { slug: 'disqueuse-230-mm', role: 'DÉCOUPER', why: 'Ajuster blocs et briques aux extrémités et aux réservations.' },
      { slug: 'brouette-de-jardinage150-l', role: 'APPROVISIONNER', why: 'Amener blocs et mortier au pied du mur.' },
      { slug: 'etai-200-375', role: 'SÉCURISER', why: 'Étayer un linteau ou soutenir pendant la prise.' },
    ],
    consumables: [C.gants, C.masques, { label: 'Fil à maçon + cordeau', detail: '50 m', price: 5.9 }],
    related: ['realiser-une-dalle-ou-chape', 'demolir-une-cloison'],
  },
  {
    slug: 'faire-une-saignee',
    name: 'Faire une saignée',
    family: 'gros-oeuvre',
    category: 'forer-casser',
    level: 'intermédiaire',
    team: '1 pers.',
    intro: 'Encastrer des câbles ou conduites en limitant la poussière.',
    items: [
      { slug: 'rainureuse', role: 'RAINURER', why: 'Deux traits parallèles nets, à profondeur réglée, en un passage.' },
      { slug: 'marteau-perfo-piqueur-sans-poussieres-sans-fil', role: 'DÉGAGER', why: 'Casse la bande de matière entre les traits, avec aspiration.' },
      { slug: 'aspirateur-eau-et-poussieres-industriel-1250w-23-l', role: 'TRAVAILLER PROPREMENT', why: 'La rainureuse rejette énormément de poussière fine.' },
      { slug: 'detecteur-bois-metal', role: 'SÉCURISER', why: 'S’assurer du tracé avant d’entailler.' },
    ],
    consumables: [C.masques, C.lunettes, { label: 'Bande de fixation + plâtre', detail: 'Kit rebouchage saignée', price: 10.9 }],
    related: ['adapter-prises-cablage', 'percer-du-beton'],
  },

  /* ─────────────── PLOMBERIE ─────────────── */
  {
    slug: 'deboucher-inspecter',
    name: 'Déboucher & inspecter',
    family: 'plomberie',
    category: 'plomberie-electricite',
    level: 'facile',
    team: '1 pers.',
    popular: true,
    intro: 'Localiser puis traiter un bouchon dans une évacuation.',
    items: [
      { slug: 'camera-inspection', role: 'DIAGNOSTIQUER', why: 'Voir où est le bouchon et dans quel état est la canalisation.' },
      { slug: 'nettoyeur-haute-pression-eau-froide', role: 'DÉBOUCHER', why: 'Un jet haute pression décolle graisses et dépôts sans produit.' },
    ],
    consumables: [C.gants, { label: 'Furet manuel 10 m', detail: 'Complément pour coudes serrés', price: 9.9 }],
    related: ['reparer-une-fuite', 'evacuer-une-cave-inondee'],
  },
  {
    slug: 'installer-un-sanitaire',
    name: 'Installer un sanitaire',
    family: 'plomberie',
    category: 'plomberie-electricite',
    level: 'intermédiaire',
    team: '1 pers.',
    intro: 'Installer un évier, lavabo ou WC et réaliser ses raccordements.',
    items: [
      { slug: 'cintreuse-geberit-mepla-16-32-mm', role: 'FAÇONNER', why: 'Cintrer le tube multicouche proprement, sans raccord inutile.' },
      { slug: 'sertisseuse-radiale-electro-mecanique', role: 'RACCORDER', why: 'Sertissages étanches et durables, sans soudure ni flamme.' },
      { slug: 'marteau-perforateur', role: 'FIXER', why: 'Percer le mur pour les fixations et la platine WC.' },
    ],
    consumables: [C.colle, { label: 'Raccords multicouche', detail: 'Assortiment sertir', price: 24.9 }, { label: 'Filasse + pâte à joint', detail: 'Étanchéité filetages', price: 5.9 }],
    related: ['reparer-une-fuite', 'installer-une-cuisine'],
  },
  {
    slug: 'reparer-une-fuite',
    name: 'Réparer une fuite',
    family: 'plomberie',
    category: 'plomberie-electricite',
    level: 'facile',
    team: '1 pers.',
    intro: 'Remplacer un raccord accessible ou réparer une conduite.',
    items: [
      { slug: 'sertisseuse-radiale-electro-mecanique', role: 'RACCORDER', why: 'Refaire un raccord à froid, étanche immédiatement.' },
      { slug: 'camera-inspection', role: 'DIAGNOSTIQUER', why: 'Confirmer l’origine exacte de la fuite avant d’ouvrir.' },
      { slug: 'decapeur-thermique', role: 'PRÉPARER', why: 'Dégripper un raccord ou dégeler une conduite.' },
    ],
    consumables: [{ label: 'Kit de raccords de dépannage', detail: 'Cuivre / multicouche', price: 19.9 }, { label: 'Ruban de réparation', detail: 'Auto-amalgamant', price: 6.9 }],
    related: ['deboucher-inspecter', 'installer-un-sanitaire'],
  },

  /* ─────────────── ÉLECTRICITÉ ─────────────── */
  {
    slug: 'installer-un-luminaire',
    name: 'Installer un luminaire',
    family: 'electricite',
    category: 'plomberie-electricite',
    level: 'facile',
    team: '1 pers.',
    intro: 'Remplacer ou poser un luminaire sur une alimentation existante.',
    items: [
      { slug: 'perceuse-visseuse-sans-fil', role: 'FIXER', why: 'Percer le plafond et visser la platine à bonne hauteur.' },
      { slug: 'detecteur-bois-metal', role: 'SÉCURISER', why: 'Repérer solives et câbles avant de percer.' },
      { slug: 'echelle-de-toit-2-m', role: 'ACCÉDER', why: 'Travailler au plafond en position stable, mains libres.' },
    ],
    consumables: [{ label: 'Bornes de connexion', detail: 'Sachet mixte (2/3/5)', price: 7.9 }, { label: 'Chevilles à bascule', detail: 'Plaques de plâtre', price: 5.5 }],
    related: ['adapter-prises-cablage', 'diagnostiquer-une-installation'],
  },
  {
    slug: 'adapter-prises-cablage',
    name: 'Adapter prises & câblage',
    family: 'electricite',
    category: 'plomberie-electricite',
    level: 'intermédiaire',
    team: '1 pers.',
    intro: 'Ajouter une prise, un interrupteur ou faire passer des câbles.',
    items: [
      { slug: 'rainureuse', role: 'RAINURER', why: 'Ouvrir une saignée propre pour encastrer la gaine.' },
      { slug: 'marteau-perfo-piqueur-sans-fil', role: 'CREUSER', why: 'Percer les boîtiers d’encastrement à la scie-cloche.' },
      { slug: 'detecteur-bois-metal', role: 'SÉCURISER', why: 'Cartographier le mur avant d’entailler.' },
      { slug: 'aspirateur-eau-et-poussieres-1000w-20-l', role: 'TRAVAILLER PROPREMENT', why: 'Aspirer la poussière de rainurage.' },
    ],
    consumables: [{ label: 'Gaine ICTA + tire-fils', detail: '25 m', price: 16.9 }, { label: 'Boîtiers d’encastrement', detail: 'Lot de 5', price: 6.9 }, C.masques],
    related: ['faire-une-saignee', 'installer-un-luminaire'],
  },
  {
    slug: 'diagnostiquer-une-installation',
    name: 'Diagnostiquer une installation',
    family: 'electricite',
    category: 'plomberie-electricite',
    level: 'facile',
    team: '1 pers.',
    intro: 'Effectuer les premières vérifications avant intervention professionnelle.',
    items: [
      { slug: 'detecteur-bois-metal', role: 'REPÉRER', why: 'Suivre le cheminement des câbles dans les murs.' },
      { slug: 'camera-inspection', role: 'INSPECTER', why: 'Regarder derrière une plinthe, dans une gaine technique.' },
    ],
    consumables: [{ label: 'Testeur de tension', detail: 'Sans contact', price: 12.9 }],
    related: ['installer-un-luminaire', 'adapter-prises-cablage'],
  },

  /* ─────────────── JARDIN ─────────────── */
  {
    slug: 'entretenir-le-jardin',
    name: 'Entretenir le jardin',
    family: 'jardin',
    category: 'exterieur',
    level: 'facile',
    team: '1 pers.',
    intro: 'Assurer l’entretien courant : bordures, apports, ramassage.',
    items: [
      { slug: 'epandeur-dengrais-a-pousser', role: 'ENTRETENIR', why: 'Répartition régulière d’engrais, semences ou anti-mousse.' },
      { slug: 'brouette-de-jardinage150-l', role: 'ÉVACUER', why: 'Déplacer terre, tontes et déchets verts en un aller-retour.' },
      { slug: 'nettoyeur-haute-pression-eau-froide', role: 'NETTOYER', why: 'Redonner de l’éclat au mobilier et aux allées.' },
    ],
    consumables: [C.gants, { label: 'Sacs de déchets verts', detail: 'Lot de 5 · 100 L', price: 8.9 }],
    related: ['preparer-un-terrain', 'tailler-une-haie'],
  },
  {
    slug: 'tailler-une-haie',
    name: 'Tailler une haie',
    family: 'jardin',
    category: 'exterieur',
    level: 'facile',
    team: '1 pers.',
    intro: 'Tailler proprement une haie basse ou haute et récupérer les déchets.',
    items: [
      { slug: 'echelle-de-toit-2-m', role: 'ACCÉDER', why: 'Atteindre le haut d’une haie en appui stable.' },
      { slug: 'loiselet-broyeur-branches-6cm', role: 'ÉVACUER', why: 'Réduire les chutes de taille en broyat directement utilisable.' },
      { slug: 'brouette-de-jardinage150-l', role: 'ÉVACUER', why: 'Rassembler et transporter les branches.' },
    ],
    consumables: [C.gants, C.lunettes, { label: 'Bâche de ramassage', detail: '2,5 × 2,5 m', price: 9.9 }],
    related: ['debiter-un-petit-arbre', 'broyer-les-dechets-verts'],
  },
  {
    slug: 'debiter-un-petit-arbre',
    name: 'Débiter un petit arbre',
    family: 'jardin',
    category: 'exterieur',
    level: 'intermédiaire',
    team: '1–2 pers.',
    intro: 'Élaguer ou débiter un arbre compatible avec une intervention non professionnelle.',
    items: [
      { slug: 'loiselet-broyeur-branches-10cm', role: 'ÉVACUER', why: 'Transforme le branchage en broyat, sans allers-retours en déchèterie.' },
      { slug: 'echelle-de-toit-3-m', role: 'ACCÉDER', why: 'Atteindre les basses branches en sécurité.' },
      { slug: 'brouette-de-jardinage150-l', role: 'ÉVACUER', why: 'Sortir les billons et le bois débité.' },
    ],
    consumables: [C.gants, C.lunettes, { label: 'Coins de fendage + masse', detail: 'Kit', price: 14.9 }],
    related: ['tailler-une-haie', 'broyer-les-dechets-verts'],
  },
  {
    slug: 'preparer-un-terrain',
    name: 'Préparer un terrain',
    family: 'jardin',
    category: 'exterieur',
    level: 'intermédiaire',
    team: '1–2 pers.',
    intro: 'Préparer un potager, une pelouse ou une zone de plantation.',
    items: [
      { slug: 'loiselet-motoculteur-fraise', role: 'TRAVAILLER LE SOL', why: 'Ameublit et retourne la terre sur toute la surface, sans se casser le dos.' },
      { slug: 'epandeur-dengrais-a-pousser', role: 'AMENDER', why: 'Répartir compost, chaux ou semences de façon homogène.' },
      { slug: 'brouette-de-jardinage150-l', role: 'APPROVISIONNER', why: 'Amener terreau et amendements sur la zone.' },
    ],
    consumables: [C.gants, { label: 'Rouleau de gazon / semences', detail: 'À la demande', price: 0 }],
    related: ['entretenir-le-jardin', 'realiser-une-dalle-ou-chape'],
  },
  {
    slug: 'broyer-les-dechets-verts',
    name: 'Broyer les déchets verts',
    family: 'jardin',
    category: 'exterieur',
    level: 'facile',
    team: '1 pers.',
    intro: 'Réduire les branches et déchets issus d’une taille.',
    items: [
      { slug: 'loiselet-broyeur-branches-10cm', role: 'BROYER', why: 'Divise le volume par 5 à 10 et produit un paillage réutilisable.' },
      { slug: 'brouette-de-jardinage150-l', role: 'ALIMENTER', why: 'Rassembler les branches et récupérer le broyat.' },
    ],
    consumables: [C.gants, C.lunettes, C.masques],
    related: ['tailler-une-haie', 'debiter-un-petit-arbre'],
  },
  {
    slug: 'poser-une-cloture',
    name: 'Poser une clôture',
    family: 'jardin',
    category: 'exterieur',
    level: 'intermédiaire',
    team: '2 pers.',
    intro: 'Installer une clôture légère, des panneaux ou des poteaux alignés.',
    items: [
      { slug: 'marteau-perfo-piqueur-sans-fil', role: 'CREUSER', why: 'Ouvrir les trous de poteaux même en sol dur.' },
      { slug: 'malaxeur-de-mortier', role: 'SCELLER', why: 'Gâcher le béton de scellement des poteaux à la volée.' },
      { slug: 'disqueuse-sans-fil-125-mm', role: 'AJUSTER', why: 'Recouper poteaux et lisses à la bonne longueur.' },
      { slug: 'brouette-de-jardinage150-l', role: 'APPROVISIONNER', why: 'Transporter béton, poteaux et panneaux le long du tracé.' },
    ],
    consumables: [C.gants, { label: 'Cordeau + piquets d’alignement', detail: 'Kit 50 m', price: 6.9 }],
    related: ['monter-un-mur', 'preparer-un-terrain'],
  },

  /* ─────────────── NETTOYAGE ─────────────── */
  {
    slug: 'nettoyer-une-terrasse',
    name: 'Nettoyer une terrasse',
    family: 'nettoyage',
    category: 'nettoyage',
    level: 'facile',
    team: '1 pers.',
    popular: true,
    intro: 'Nettoyer dalles et pavés sans oublier les joints.',
    items: [
      { slug: 'nettoyeur-haute-pression-eau-froide', role: 'DÉCAPER', why: 'Décolle mousses et salissures incrustées en profondeur.' },
      { slug: 'aspirateur-eau-et-poussieres-1000w-20-l', role: 'ASSÉCHER', why: 'Aspirer l’eau et les résidus après lavage.' },
    ],
    consumables: [
      { label: 'Buse rotative (turbo)', detail: 'Complément haute pression', price: 9.9 },
      { label: 'Sable de jointoiement', detail: 'Sac 15 kg', price: 12.9 },
    ],
    related: ['nettoyer-une-facade', 'nettoyage-apres-travaux'],
  },
  {
    slug: 'nettoyer-tapis-canapes',
    name: 'Nettoyer tapis & canapés',
    family: 'nettoyage',
    category: 'nettoyage',
    level: 'facile',
    team: '1 pers.',
    intro: 'Nettoyer en profondeur tissus, moquettes, sièges et tapis.',
    items: [
      { slug: 'aspirateur-eau-et-poussieres-industriel-1250w-23-l', role: 'INJECTER-EXTRAIRE', why: 'Injecte la solution puis ré-aspire l’eau sale : le tissu ressort propre et presque sec.' },
    ],
    consumables: [{ label: 'Shampoing textile', detail: 'Concentré · 1 L', price: 12.9 }, { label: 'Suceur textile', detail: 'Accessoire injection', price: 6.9 }],
    related: ['nettoyage-apres-travaux', 'nettoyer-une-terrasse'],
  },
  {
    slug: 'nettoyage-apres-travaux',
    name: 'Nettoyage après travaux',
    family: 'nettoyage',
    category: 'nettoyage',
    level: 'facile',
    team: '1–2 pers.',
    intro: 'Éliminer poussières et traces après une rénovation.',
    items: [
      { slug: 'aspirateur-eau-et-poussieres-industriel-1400-w-35-l', role: 'ASPIRER', why: 'Grande cuve pour gravats fins, plâtre et poussière de ponçage.' },
      { slug: 'nettoyeur-haute-pression-eau-froide', role: 'LAVER', why: 'Décoller les projections de peinture, colle et enduit à l’extérieur.' },
      { slug: 'deshumidificateur-30-l', role: 'ASSÉCHER', why: 'Faire baisser l’humidité résiduelle avant remise en service.' },
    ],
    consumables: [C.sacs, C.masques, { label: 'Filtre plissé de rechange', detail: 'Aspi eau & poussière', price: 14.9 }],
    related: ['nettoyer-une-terrasse', 'peindre-une-piece'],
  },
  {
    slug: 'nettoyer-des-gouttieres',
    name: 'Nettoyer des gouttières',
    family: 'nettoyage',
    category: 'hauteur',
    level: 'intermédiaire',
    team: '1–2 pers.',
    intro: 'Retirer feuilles et dépôts depuis une position sécurisée.',
    items: [
      { slug: 'echafaudage-etroit-roulant-10-m', role: 'ACCÉDER', why: 'Plateforme stable le long de la façade, on déplace au lieu de bouger l’échelle.' },
      { slug: 'nettoyeur-haute-pression-eau-froide', role: 'RINCER', why: 'Chasser boues et dépôts vers les descentes.' },
      { slug: 'aspirateur-eau-et-poussieres-1000w-20-l', role: 'ASPIRER', why: 'Retirer les feuilles humides sans les faire tomber partout.' },
    ],
    consumables: [C.gants, { label: 'Crosse télescopique', detail: 'Rallonge haute pression', price: 14.9 }],
    related: ['nettoyer-une-facade', 'travailler-en-hauteur'],
  },
  {
    slug: 'evacuer-une-cave-inondee',
    name: 'Évacuer une cave inondée',
    family: 'nettoyage',
    category: 'nettoyage',
    level: 'intermédiaire',
    team: '1–2 pers.',
    intro: 'Pomper l’eau, aspirer les résidus et lancer le séchage.',
    items: [
      { slug: 'aspirateur-eau-et-poussieres-industriel-1400-w-35-l', role: 'ASPIRER', why: 'Retire l’eau résiduelle et les boues après pompage.' },
      { slug: 'deshumidificateur-80-l', role: 'ASSÉCHER', why: 'Fait chuter l’humidité de l’air et des murs, jour après jour.' },
      { slug: 'canon-a-chaleur-infrarouge', role: 'SÉCHER', why: 'Accélère le séchage des maçonneries et des sols.' },
    ],
    consumables: [C.gants, { label: 'Pompe vide-cave', detail: 'Complément si hauteur d’eau', price: 0 }],
    related: ['deboucher-inspecter', 'nettoyage-apres-travaux'],
  },

  /* ─────────────── HAUTEUR ─────────────── */
  {
    slug: 'travailler-en-hauteur',
    name: 'Travailler en hauteur',
    family: 'hauteur',
    category: 'echelles-echafaudages',
    level: 'intermédiaire',
    team: '1–2 pers.',
    intro: 'Intervenir en sécurité à l’intérieur ou à l’extérieur.',
    items: [
      { slug: 'echafaudage-etroit-roulant-10-m', role: 'ACCÉDER', why: 'Plateforme stable, garde-corps, on garde les deux mains libres.' },
      { slug: 'enrouleur-de-cable-40-m', role: 'ALIMENTER', why: 'Amener le courant sur la plateforme sans tension dans le vide.' },
    ],
    consumables: [C.gants, { label: 'Seau de chantier + poulie', detail: 'Monte-charge manuel', price: 12.9 }],
    related: ['nettoyer-une-facade', 'peindre-une-piece'],
  },
  {
    slug: 'nettoyer-une-facade',
    name: 'Nettoyer une façade',
    family: 'hauteur',
    category: 'echelles-echafaudages',
    level: 'technique',
    team: '2 pers.',
    intro: 'Nettoyer un mur extérieur depuis une plateforme adaptée.',
    items: [
      { slug: 'loiselet-nacelle-ciseaux-8m', role: 'ACCÉDER', why: 'Monter à hauteur de façade et se déplacer le long du mur.' },
      { slug: 'nettoyeur-haute-pression-eau-chaude', role: 'DÉCAPER', why: 'L’eau chaude décolle pollution, algues et traces tenaces.' },
      { slug: 'enrouleur-de-cable-40-m', role: 'ALIMENTER', why: 'Alimenter le nettoyeur en hauteur.' },
    ],
    consumables: [C.gants, C.lunettes, { label: 'Détergent façade', detail: 'Concentré biodégradable', price: 16.9 }],
    related: ['travailler-en-hauteur', 'nettoyer-une-terrasse'],
  },

  /* ─────────────── MANUTENTION ─────────────── */
  {
    slug: 'demenager-deplacer',
    name: 'Déménager & déplacer',
    family: 'manutention',
    category: 'forer-casser',
    level: 'facile',
    team: '2–3 pers.',
    intro: 'Déplacer cartons, électroménagers, meubles ou charges lourdes.',
    items: [
      { slug: 'chariot-elevateur-manuel', role: 'PORTER', why: 'Soulève palettes et charges lourdes à hauteur de manipulation.' },
      { slug: 'palan-electrique-400-kg', role: 'LEVER', why: 'Monte une charge par une fenêtre ou dans une cage d’escalier.' },
      { slug: 'brouette-de-jardinage150-l', role: 'ROULER', why: 'Transporter cartons et petits volumes sur terrain irrégulier.' },
    ],
    consumables: [
      C.gants,
      { label: 'Sangles de portage', detail: 'Jeu de 2 · dorsales', price: 14.9 },
      { label: 'Couverture de déménagement', detail: 'Protection meubles', price: 9.9 },
    ],
    related: ['travailler-en-hauteur', 'installer-une-cuisine'],
  },
];

/* ------------------------------------------------------------------ */

async function run() {
  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
  const prods = await prisma.product.findMany({
    where: { kind: { in: ['MACHINE', 'ACCESSORY', 'CONSUMABLE', 'PPE'] } },
    select: { slug: true, name: true, dailyPrice: true },
  });
  const priceBySlug = Object.fromEntries(prods.map((p) => [p.slug, p.dailyPrice]));
  const nameBySlug = Object.fromEntries(prods.map((p) => [p.slug, p.name]));

  const wantI18n = translationEnabled();
  let created = 0;
  let updated = 0;
  const missing = new Set<string>();

  for (const pk of PACKS) {
    const items = pk.items
      .filter((it) => {
        if (priceBySlug[it.slug] == null) {
          missing.add(`${pk.slug} → ${it.slug}`);
          return false;
        }
        return true;
      })
      .map((it) => ({ ...it, name: nameBySlug[it.slug], dailyPrice: priceBySlug[it.slug] }));

    const sepTotal = items.reduce((a, it) => a + it.dailyPrice, 0);
    const discount = pk.discount ?? 0.3;
    const packPrice = Math.max(1, Math.round(sepTotal * (1 - discount)));

    const packMeta = {
      family: pk.family,
      level: pk.level,
      teamSize: pk.team,
      popular: !!pk.popular,
      discountPct: discount,
      separateTotal: sepTotal,
      items,
      consumables: pk.consumables ?? [],
      related: pk.related ?? [],
    };

    const i18n = wantI18n
      ? {
          name: await buildI18nText(pk.name),
          shortDescription: await buildI18nText(pk.intro),
        }
      : undefined;

    const existing = await prisma.product.findUnique({ where: { slug: pk.slug } });
    const data = {
      name: pk.name,
      kind: 'PACK' as const,
      categoryId: catId[pk.category] ?? null,
      shortDescription: pk.intro,
      description: pk.intro,
      published: true,
      isDemo: false,
      supplier: 'BRICOLOC',
      availabilityMode: 'INSTANT',
      deliveryPolicy: 'STANDARD',
      dailyPrice: packPrice,
      weekPrice: Math.round(packPrice * 4),
      monthPrice: Math.round(packPrice * 12),
      deposit: 0,
      packMeta: packMeta as never,
      ...(i18n ? { i18n: i18n as never } : {}),
    };

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.product.create({ data: { slug: pk.slug, ...data } });
      created++;
    }
  }

  // Dépublie les anciens BricoPacks non repris dans la nouvelle gamme.
  const keepSlugs = PACKS.map((p) => p.slug);
  const stale = await prisma.product.updateMany({
    where: { kind: 'PACK', slug: { notIn: keepSlugs }, published: true },
    data: { published: false },
  });

  console.log(`BricoPacks : ${created} créés, ${updated} mis à jour. ${stale.count} ancien(s) dépublié(s).`);
  if (missing.size) {
    console.log(`\n⚠️ Outils introuvables au catalogue (ignorés) :`);
    for (const m of missing) console.log(`   ${m}`);
  }
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
