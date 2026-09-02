/**
 * Donnees de DEMONSTRATION BRICOLOC (toutes FICTIVES, editables en admin).
 * Lancer : npm run seed  (ou npm run db:reset)
 */
import '../src/env.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';
import { CATEGORIES, DEFAULT_SETTINGS, STAFF_ROLES } from '@bricoloc/shared';
import { translationEnabled } from '../src/lib/translate.js';
import { syncContentTranslations } from '../src/lib/i18n-content.js';
import { geocode } from '../src/lib/geo.js';
import { setSetting } from '../src/lib/settings.js';

const prisma = new PrismaClient();
const qr = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);
const hash = (p: string) => bcrypt.hashSync(p, 10);

interface SeedProduct {
  slug: string;
  name: string;
  kind: 'MACHINE' | 'ACCESSORY' | 'CONSUMABLE' | 'PPE' | 'PACK';
  category?: string;
  shortDescription: string;
  description?: string;
  recommendedUses?: string[];
  specs?: Record<string, string>;
  includedAccessories?: string[];
  dailyPrice: number;
  weekendPrice?: number;
  weekPrice?: number;
  monthPrice?: number;
  tiers?: { minDays: number; perDay: number }[];
  deposit?: number;
  stockQty?: number;
  units?: number;
  accessories?: string[];
  consumables?: string[];
  ppe?: string[];
  complementary?: string[];
  packItems?: { slug: string; quantity: number }[];
}

/**
 * Emplacement d'image temporaire : SVG en data-URI aux couleurs BRICOLOC.
 * Toujours affiché (aucune dependance reseau). A remplacer par de vraies photos
 * en deposant les URLs dans le champ "images" du produit (admin).
 */
const IMG = (label: string) => {
  const safe = label.replace(/[<>&]/g, '').slice(0, 22);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450"><rect width="600" height="450" fill="#0B1D3A"/><rect x="0" y="0" width="600" height="10" fill="#E52421"/><text x="40" y="230" font-family="Segoe UI,Arial,sans-serif" font-size="34" font-weight="800" fill="#FFFFFF">${safe}</text><text x="40" y="280" font-family="Segoe UI,Arial,sans-serif" font-size="20" fill="#A7A9AC">BRICOLOC — photo de démo</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const PRODUCTS: SeedProduct[] = [
  // -------- Machines --------
  {
    slug: 'marteau-piqueur-electrique',
    name: 'Marteau-piqueur électrique 1500 W',
    kind: 'MACHINE',
    category: 'percage-demolition',
    shortDescription: 'Démolition de dalles, chapes et cloisons.',
    description:
      'Marteau-piqueur professionnel pour travaux de démolition légère à moyenne. Poignée anti-vibration.',
    recommendedUses: ['Casser une dalle béton', 'Déposer un carrelage sur chape', 'Ouvrir une saignée'],
    specs: { Puissance: '1500 W', Frappe: '25 J', Poids: '16 kg', Emmanchement: 'SDS-Max' },
    includedAccessories: ['1 burin plat', '1 pointerolle', 'Mallette de transport'],
    dailyPrice: 39,
    weekendPrice: 55,
    weekPrice: 195,
    tiers: [
      { minDays: 1, perDay: 39 },
      { minDays: 4, perDay: 32 },
      { minDays: 8, perDay: 25 },
    ],
    deposit: 300,
    units: 4,
    accessories: ['jeu-burins-sds-max'],
    consumables: ['sac-gravats'],
    ppe: ['casque-anti-bruit', 'lunettes-protection', 'gants-chantier'],
    complementary: ['aspirateur-chantier'],
  },
  {
    slug: 'perforateur-sds-plus',
    name: 'Perforateur burineur SDS-Plus 900 W',
    kind: 'MACHINE',
    category: 'percage-demolition',
    shortDescription: 'Perçage béton et petits travaux de burinage.',
    specs: { Puissance: '900 W', Frappe: '3.5 J', Poids: '3.4 kg' },
    dailyPrice: 22,
    weekendPrice: 32,
    weekPrice: 110,
    deposit: 150,
    units: 5,
    consumables: ['forets-beton-set'],
    ppe: ['lunettes-protection', 'gants-chantier'],
  },
  {
    slug: 'scie-circulaire-190',
    name: 'Scie circulaire 190 mm 1600 W',
    kind: 'MACHINE',
    category: 'sciage-decoupe',
    shortDescription: 'Coupes droites dans le bois et les panneaux.',
    specs: { Lame: '190 mm', 'Prof. de coupe': '66 mm', Puissance: '1600 W' },
    dailyPrice: 19,
    weekendPrice: 28,
    weekPrice: 95,
    deposit: 120,
    units: 4,
    consumables: ['lame-scie-circ-bois'],
    ppe: ['lunettes-protection', 'casque-anti-bruit'],
    complementary: ['aspirateur-chantier'],
  },
  {
    slug: 'decoupeuse-thermique-350',
    name: 'Découpeuse thermique 350 mm',
    kind: 'MACHINE',
    category: 'sciage-decoupe',
    shortDescription: 'Découpe béton, pierre, métal sur chantier.',
    specs: { Disque: '350 mm', Moteur: '2 temps 74 cc', Poids: '10 kg' },
    dailyPrice: 45,
    weekendPrice: 65,
    weekPrice: 225,
    deposit: 350,
    units: 2,
    consumables: ['disque-diamant-350'],
    ppe: ['casque-anti-bruit', 'lunettes-protection', 'masque-ffp3', 'gants-chantier'],
  },
  {
    slug: 'ponceuse-parquet-tambour',
    name: 'Ponceuse à parquet à bande',
    kind: 'MACHINE',
    category: 'poncage',
    shortDescription: 'Rénovation de planchers et parquets massifs.',
    specs: { Bande: '200 x 750 mm', Puissance: '2200 W', Aspiration: 'Sac intégré' },
    dailyPrice: 48,
    weekendPrice: 69,
    weekPrice: 240,
    deposit: 400,
    units: 3,
    accessories: ['ponceuse-bordure'],
    consumables: ['abrasifs-parquet-set'],
    ppe: ['masque-ffp3', 'casque-anti-bruit'],
  },
  {
    slug: 'ponceuse-girafe-led',
    name: 'Ponceuse girafe murs & plafonds',
    kind: 'MACHINE',
    category: 'poncage',
    shortDescription: 'Ponçage d’enduits sur grandes surfaces.',
    specs: { Plateau: '225 mm', Puissance: '750 W', Éclairage: 'LED' },
    dailyPrice: 29,
    weekendPrice: 42,
    weekPrice: 145,
    deposit: 200,
    units: 3,
    consumables: ['abrasifs-girafe-set'],
    ppe: ['masque-ffp3', 'lunettes-protection'],
    complementary: ['aspirateur-chantier'],
  },
  {
    slug: 'station-peinture-airless',
    name: 'Station de peinture Airless',
    kind: 'MACHINE',
    category: 'peinture',
    shortDescription: 'Application rapide de peinture sur murs et façades.',
    specs: { Débit: '2 L/min', 'Pression max': '210 bar', Tuyau: '15 m' },
    dailyPrice: 42,
    weekendPrice: 60,
    weekPrice: 210,
    deposit: 350,
    units: 2,
    consumables: ['buse-airless-515', 'ruban-masquage'],
    ppe: ['masque-ffp3', 'combinaison-jetable'],
  },
  {
    slug: 'nettoyeur-haute-pression-200',
    name: 'Nettoyeur haute pression 200 bar',
    kind: 'MACHINE',
    category: 'nettoyage',
    shortDescription: 'Terrasses, façades, véhicules et matériel.',
    specs: { Pression: '200 bar', Débit: '600 L/h', Puissance: '3000 W' },
    dailyPrice: 26,
    weekendPrice: 38,
    weekPrice: 130,
    deposit: 150,
    units: 4,
    accessories: ['rotabuse-terrasse', 'kit-nettoyeur-facade'],
    consumables: ['detergent-terrasse'],
    ppe: ['bottes-caoutchouc'],
  },
  {
    slug: 'aspirateur-chantier',
    name: 'Aspirateur de chantier eau & poussière 60 L',
    kind: 'MACHINE',
    category: 'nettoyage',
    shortDescription: 'Aspiration classe M pour poussières fines.',
    specs: { Cuve: '60 L', Classe: 'M', Puissance: '1400 W', Prise: 'Synchronisée' },
    dailyPrice: 16,
    weekendPrice: 24,
    weekPrice: 80,
    deposit: 100,
    units: 6,
    consumables: ['sac-filtre-aspirateur'],
  },
  {
    slug: 'taille-haie-thermique',
    name: 'Taille-haie thermique 60 cm',
    kind: 'MACHINE',
    category: 'jardin',
    shortDescription: 'Entretien de haies denses et hautes.',
    specs: { Lame: '60 cm', Moteur: '25 cc', Poids: '5.8 kg' },
    dailyPrice: 24,
    weekendPrice: 34,
    weekPrice: 120,
    deposit: 150,
    units: 4,
    accessories: ['rallonge-electrique-25m'],
    ppe: ['gants-chantier', 'lunettes-protection', 'casque-anti-bruit'],
  },
  {
    slug: 'broyeur-vegetaux-thermique',
    name: 'Broyeur de végétaux thermique',
    kind: 'MACHINE',
    category: 'jardin',
    shortDescription: 'Broyage de branches jusqu’à 45 mm.',
    specs: { 'Ø branches': '45 mm', Moteur: '6.5 CV', Poids: '60 kg' },
    dailyPrice: 55,
    weekendPrice: 79,
    weekPrice: 275,
    deposit: 400,
    units: 2,
    ppe: ['gants-chantier', 'lunettes-protection', 'casque-anti-bruit'],
  },
  {
    slug: 'plaque-vibrante-90kg',
    name: 'Plaque vibrante 90 kg',
    kind: 'MACHINE',
    category: 'terrassement',
    shortDescription: 'Compactage de sols et pavés.',
    specs: { 'Force centrifuge': '15 kN', Plaque: '500 mm', Poids: '90 kg' },
    dailyPrice: 38,
    weekendPrice: 55,
    weekPrice: 190,
    deposit: 300,
    units: 3,
    accessories: ['tapis-pave'],
    ppe: ['bottes-securite', 'casque-anti-bruit'],
  },
  {
    slug: 'mini-pelle-1-5t',
    name: 'Mini-pelle 1,5 tonne',
    kind: 'MACHINE',
    category: 'terrassement',
    shortDescription: 'Petits terrassements, tranchées, fondations.',
    specs: { Poids: '1500 kg', 'Prof. de creusement': '2.3 m', 'Godets inclus': '3' },
    dailyPrice: 145,
    weekendPrice: 210,
    weekPrice: 720,
    deposit: 1000,
    units: 2,
    ppe: ['casque-chantier', 'gilet-haute-visibilite', 'bottes-securite'],
  },
  {
    slug: 'coupe-carrelage-electrique',
    name: 'Coupe-carrelage électrique à eau 800 mm',
    kind: 'MACHINE',
    category: 'carrelage',
    shortDescription: 'Coupes nettes de carrelage et faïence.',
    specs: { 'Longueur de coupe': '800 mm', Disque: '250 mm', Puissance: '1200 W' },
    dailyPrice: 34,
    weekendPrice: 49,
    weekPrice: 170,
    deposit: 200,
    units: 3,
    consumables: ['disque-diamant-250'],
    ppe: ['lunettes-protection', 'gants-chantier'],
    complementary: ['aspirateur-chantier'],
  },
  {
    slug: 'furet-deboucheur-electrique',
    name: 'Furet déboucheur électrique 16 m',
    kind: 'MACHINE',
    category: 'plomberie',
    shortDescription: 'Débouchage de canalisations Ø 40 à 100 mm.',
    specs: { Longueur: '16 m', 'Ø flexible': '16 mm', Puissance: '400 W' },
    dailyPrice: 28,
    weekendPrice: 40,
    weekPrice: 140,
    deposit: 150,
    units: 3,
    ppe: ['gants-chantier', 'combinaison-jetable'],
  },
  {
    slug: 'detecteur-multi-materiaux',
    name: 'Détecteur multi-matériaux',
    kind: 'MACHINE',
    category: 'electricite',
    shortDescription: 'Repérage câbles, métaux et bois dans les murs.',
    specs: { 'Détection métal': '120 mm', 'Détection câble': '60 mm' },
    dailyPrice: 12,
    weekendPrice: 18,
    weekPrice: 60,
    deposit: 80,
    units: 4,
  },
  {
    slug: 'diable-monte-escalier',
    name: 'Diable monte-escalier électrique 170 kg',
    kind: 'MACHINE',
    category: 'levage-manutention',
    shortDescription: 'Manutention d’électroménager et charges lourdes.',
    specs: { Capacité: '170 kg', Autonomie: '~300 étages', Poids: '32 kg' },
    dailyPrice: 40,
    weekendPrice: 58,
    weekPrice: 200,
    deposit: 300,
    units: 2,
    ppe: ['gants-chantier', 'chaussures-securite'],
  },
  {
    slug: 'echafaudage-roulant-6m',
    name: 'Échafaudage roulant aluminium 6 m',
    kind: 'MACHINE',
    category: 'equipement-chantier',
    shortDescription: 'Travaux en hauteur intérieurs et extérieurs.',
    specs: { 'Hauteur travail': '6 m', Plateforme: '1.8 x 0.7 m', Norme: 'EN 1004' },
    dailyPrice: 32,
    weekendPrice: 46,
    weekPrice: 160,
    deposit: 250,
    units: 3,
    ppe: ['casque-chantier'],
  },
  {
    slug: 'chauffage-chantier-gaz',
    name: 'Chauffage de chantier gaz 30 kW',
    kind: 'MACHINE',
    category: 'equipement-chantier',
    shortDescription: 'Séchage et mise hors gel de locaux.',
    specs: { Puissance: '30 kW', 'Débit air': '850 m³/h' },
    dailyPrice: 21,
    weekendPrice: 30,
    weekPrice: 105,
    deposit: 120,
    units: 4,
  },
  {
    slug: 'generateur-3000w',
    name: 'Groupe électrogène 3000 W',
    kind: 'MACHINE',
    category: 'electricite',
    shortDescription: 'Alimentation de chantier sans réseau.',
    specs: { Puissance: '3000 W', Réservoir: '15 L', Autonomie: '~10 h' },
    dailyPrice: 30,
    weekendPrice: 43,
    weekPrice: 150,
    deposit: 200,
    units: 3,
  },

  // -------- Accessoires --------
  {
    slug: 'jeu-burins-sds-max',
    name: 'Jeu de burins SDS-Max (3 pièces)',
    kind: 'ACCESSORY',
    category: 'percage-demolition',
    shortDescription: 'Burin plat, pointerolle, burin bêche.',
    dailyPrice: 6,
    deposit: 40,
    units: 8,
  },
  {
    slug: 'ponceuse-bordure',
    name: 'Ponceuse de bordure pour parquet',
    kind: 'ACCESSORY',
    category: 'poncage',
    shortDescription: 'Finition des angles et plinthes.',
    dailyPrice: 18,
    deposit: 120,
    units: 3,
  },
  {
    slug: 'rotabuse-terrasse',
    name: 'Rotabuse (turbo) pour nettoyeur',
    kind: 'ACCESSORY',
    category: 'nettoyage',
    shortDescription: 'Décapage puissant béton et pierre.',
    dailyPrice: 5,
    deposit: 30,
    units: 6,
  },
  {
    slug: 'kit-nettoyeur-facade',
    name: 'Kit brosse rotative façade',
    kind: 'ACCESSORY',
    category: 'nettoyage',
    shortDescription: 'Nettoyage doux des surfaces fragiles.',
    dailyPrice: 9,
    deposit: 60,
    units: 4,
  },
  {
    slug: 'rallonge-electrique-25m',
    name: 'Rallonge électrique 25 m (bobine)',
    kind: 'ACCESSORY',
    category: 'electricite',
    shortDescription: 'Enrouleur 230 V 16 A, IP44.',
    dailyPrice: 4,
    deposit: 20,
    units: 10,
  },
  {
    slug: 'tapis-pave',
    name: 'Tapis de protection pour pavés',
    kind: 'ACCESSORY',
    category: 'terrassement',
    shortDescription: 'Évite le marquage des pavés au compactage.',
    dailyPrice: 6,
    deposit: 30,
    units: 4,
  },
  {
    slug: 'aspirateur-appoint-20l',
    name: 'Aspirateur d’appoint 20 L',
    kind: 'ACCESSORY',
    category: 'nettoyage',
    shortDescription: 'Complément d’aspiration pour finitions.',
    dailyPrice: 10,
    deposit: 60,
    units: 3,
  },

  // -------- Consommables --------
  {
    slug: 'sac-gravats',
    name: 'Sac à gravats renforcé (lot de 10)',
    kind: 'CONSUMABLE',
    category: 'percage-demolition',
    shortDescription: '50 L, jusqu’à 40 kg par sac.',
    dailyPrice: 9,
    stockQty: 200,
  },
  {
    slug: 'forets-beton-set',
    name: 'Coffret forets béton SDS-Plus (5 pièces)',
    kind: 'CONSUMABLE',
    category: 'percage-demolition',
    shortDescription: 'Ø 6 à 12 mm.',
    dailyPrice: 15,
    stockQty: 60,
  },
  {
    slug: 'lame-scie-circ-bois',
    name: 'Lame carbure 190 mm 48 dents',
    kind: 'CONSUMABLE',
    category: 'sciage-decoupe',
    shortDescription: 'Coupe fine du bois.',
    dailyPrice: 12,
    stockQty: 40,
  },
  {
    slug: 'disque-diamant-350',
    name: 'Disque diamant 350 mm béton',
    kind: 'CONSUMABLE',
    category: 'sciage-decoupe',
    shortDescription: 'Segmenté, jante laser.',
    dailyPrice: 39,
    stockQty: 25,
  },
  {
    slug: 'disque-diamant-250',
    name: 'Disque diamant 250 mm carrelage',
    kind: 'CONSUMABLE',
    category: 'carrelage',
    shortDescription: 'Jante continue pour coupe à eau.',
    dailyPrice: 19,
    stockQty: 30,
  },
  {
    slug: 'abrasifs-parquet-set',
    name: 'Assortiment abrasifs parquet (grains 24/40/80)',
    kind: 'CONSUMABLE',
    category: 'poncage',
    shortDescription: 'Bandes 200 x 750 mm, lot de 9.',
    dailyPrice: 24,
    stockQty: 50,
  },
  {
    slug: 'abrasifs-girafe-set',
    name: 'Disques abrasifs girafe Ø225 (lot de 25)',
    kind: 'CONSUMABLE',
    category: 'poncage',
    shortDescription: 'Grains assortis 80 à 180.',
    dailyPrice: 18,
    stockQty: 60,
  },
  {
    slug: 'buse-airless-515',
    name: 'Buse Airless 515',
    kind: 'CONSUMABLE',
    category: 'peinture',
    shortDescription: 'Murs et plafonds, peinture mate.',
    dailyPrice: 14,
    stockQty: 40,
  },
  {
    slug: 'ruban-masquage',
    name: 'Ruban de masquage pro (lot de 4)',
    kind: 'CONSUMABLE',
    category: 'peinture',
    shortDescription: '48 mm x 50 m, dépose propre.',
    dailyPrice: 8,
    stockQty: 120,
  },
  {
    slug: 'detergent-terrasse',
    name: 'Détergent terrasse & façade 5 L',
    kind: 'CONSUMABLE',
    category: 'nettoyage',
    shortDescription: 'Concentré biodégradable.',
    dailyPrice: 12,
    stockQty: 80,
  },
  {
    slug: 'sac-filtre-aspirateur',
    name: 'Sacs filtres aspirateur 60 L (lot de 5)',
    kind: 'CONSUMABLE',
    category: 'nettoyage',
    shortDescription: 'Fleece classe M.',
    dailyPrice: 10,
    stockQty: 90,
  },

  // -------- EPI --------
  { slug: 'casque-anti-bruit', name: 'Casque anti-bruit SNR 30 dB', kind: 'PPE', shortDescription: 'Confort longue durée.', dailyPrice: 2, stockQty: 60 },
  { slug: 'lunettes-protection', name: 'Lunettes de protection anti-buée', kind: 'PPE', shortDescription: 'EN 166.', dailyPrice: 1.5, stockQty: 100 },
  { slug: 'gants-chantier', name: 'Paire de gants de manutention', kind: 'PPE', shortDescription: 'Enduction nitrile.', dailyPrice: 1.5, stockQty: 120 },
  { slug: 'masque-ffp3', name: 'Masque FFP3 (lot de 3)', kind: 'PPE', shortDescription: 'Poussières fines et silice.', dailyPrice: 4, stockQty: 80 },
  { slug: 'combinaison-jetable', name: 'Combinaison de protection jetable', kind: 'PPE', shortDescription: 'Type 5/6, capuche.', dailyPrice: 5, stockQty: 70 },
  { slug: 'casque-chantier', name: 'Casque de chantier', kind: 'PPE', shortDescription: 'EN 397, jugulaire.', dailyPrice: 2, stockQty: 50 },
  { slug: 'bouchons-anti-bruit', name: 'Bouchons anti-bruit (boîte)', kind: 'PPE', shortDescription: 'À usage unique.', dailyPrice: 1, stockQty: 100 },
  { slug: 'gilet-haute-visibilite', name: 'Gilet haute visibilité', kind: 'PPE', shortDescription: 'EN ISO 20471.', dailyPrice: 1.5, stockQty: 60 },
  { slug: 'bottes-securite', name: 'Bottes de sécurité S5', kind: 'PPE', shortDescription: 'Embout et semelle anti-perforation.', dailyPrice: 3, stockQty: 40 },
  { slug: 'bottes-caoutchouc', name: 'Bottes caoutchouc', kind: 'PPE', shortDescription: 'Travaux humides.', dailyPrice: 2, stockQty: 40 },
  { slug: 'chaussures-securite', name: 'Chaussures de sécurité S3', kind: 'PPE', shortDescription: 'Montantes, anti-perforation.', dailyPrice: 3, stockQty: 40 },

  // -------- Packs --------
  {
    slug: 'pack-demolition-carrelage',
    name: 'Pack démolition carrelage',
    kind: 'PACK',
    category: 'percage-demolition',
    shortDescription: 'Marteau-piqueur + aspirateur + protections.',
    description: 'Tout le nécessaire pour déposer un carrelage sur chape proprement.',
    dailyPrice: 52,
    weekendPrice: 75,
    weekPrice: 260,
    deposit: 400,
    stockQty: 3,
    packItems: [
      { slug: 'marteau-piqueur-electrique', quantity: 1 },
      { slug: 'aspirateur-chantier', quantity: 1 },
      { slug: 'jeu-burins-sds-max', quantity: 1 },
    ],
  },
  {
    slug: 'pack-renovation-parquet',
    name: 'Pack rénovation parquet',
    kind: 'PACK',
    category: 'poncage',
    shortDescription: 'Ponceuse à bande + bordureuse + abrasifs.',
    dailyPrice: 62,
    weekendPrice: 89,
    weekPrice: 310,
    deposit: 500,
    stockQty: 2,
    packItems: [
      { slug: 'ponceuse-parquet-tambour', quantity: 1 },
      { slug: 'ponceuse-bordure', quantity: 1 },
      { slug: 'abrasifs-parquet-set', quantity: 1 },
    ],
  },
  {
    slug: 'pack-terrasse-propre',
    name: 'Pack terrasse propre',
    kind: 'PACK',
    category: 'nettoyage',
    shortDescription: 'Nettoyeur HP + rotabuse + détergent.',
    dailyPrice: 34,
    weekendPrice: 49,
    weekPrice: 170,
    deposit: 180,
    stockQty: 3,
    packItems: [
      { slug: 'nettoyeur-haute-pression-200', quantity: 1 },
      { slug: 'rotabuse-terrasse', quantity: 1 },
    ],
  },
];

const CONTENT: { key: string; title: string; body: string }[] = [
  {
    key: 'how-it-works',
    title: 'Comment ça marche',
    body: [
      'Louer chez BRICOLOC, c’est cinq minutes en ligne et un passage au comptoir.',
      '',
      '1. **Choisissez vos dates** une seule fois, pour tout le matériel de la commande.',
      '2. **Ajoutez vos machines, accessoires et consommables** au panier.',
      '3. Choisissez le **retrait en Click & Collect** au dépôt ou la **livraison sur chantier**.',
      '4. **Réservez et payez en ligne.** Une empreinte de caution est prise, jamais débitée si tout est rendu en ordre.',
      '5. Au retrait, **présentez votre QR code** au comptoir : le matériel est déjà préparé.',
      '6. **Rapportez le matériel** nettoyé et complet. La caution est libérée sous 48 h.',
      '',
      '## Une seule date pour toute la commande',
      'Pas besoin de réserver machine par machine : vous indiquez une période et on vérifie la disponibilité de tout le matériel en même temps.',
    ].join('\n'),
  },
  {
    key: 'click-collect',
    title: 'Click & Collect',
    body: [
      'Réservez en ligne, votre matériel vous attend au comptoir.',
      '',
      '- Commande validée avant 15 h : souvent **prête en 2 heures** selon la disponibilité.',
      '- Vous recevez un **e-mail de confirmation** dès que la commande est préparée.',
      '- Au comptoir, **présentez le QR code** de votre réservation. Une pièce d’identité est demandée pour le retrait.',
      '- Retrait au dépôt : **Gieterijstraat 49, 1601 Ruisbroek**, du lundi au samedi.',
      '',
      '## Et au retour ?',
      'Rapportez le matériel nettoyé et complet aux horaires d’ouverture. Le contrôle se fait avec vous ; la caution est libérée juste après.',
    ].join('\n'),
  },
  {
    key: 'delivery',
    title: 'Livraison',
    body: [
      'On livre le matériel directement sur votre chantier ou à votre domicile.',
      '',
      '## Zone desservie',
      'Bruxelles, Brabant wallon et Brabant flamand. Au-delà, contactez-nous pour un devis.',
      '',
      '## Frais et créneaux',
      '- Frais calculés selon la **distance depuis le dépôt** et affichés avant le paiement.',
      '- Livraison possible **dès le lendemain** pour toute commande validée avant 15 h.',
      '- Un créneau de passage vous est communiqué la veille.',
      '',
      '## Reprise',
      'L’enlèvement du matériel est organisé à la fin de la location, au même endroit. Vous n’avez rien à ramener.',
    ].join('\n'),
  },
  {
    key: 'pro',
    title: 'BRICOLOC Pro',
    body: [
      'Le compte Pro est fait pour les artisans, entreprises et indépendants qui louent régulièrement.',
      '',
      '## Ce que ça change',
      '- **Tarifs dégressifs** et remises négociées selon vos volumes.',
      '- **Facturation mensuelle** groupée, TVA récupérable (21 %).',
      '- **Devis rapides** pour vos appels d’offres.',
      '- Un interlocuteur dédié pour les grosses commandes.',
      '',
      '## Ouvrir un compte',
      'Créez un compte, ajoutez votre **numéro de TVA** et votre adresse de facturation. La validation prend un jour ouvrable.',
      '',
      '[Créer mon compte Pro](/inscription)',
    ].join('\n'),
  },
  {
    key: 'faq',
    title: 'Questions fréquentes',
    body: [
      '## Réservation & paiement',
      '### Quand suis-je débité ?',
      'La location est payée en ligne à la réservation. La caution est une simple empreinte : elle n’est jamais débitée si le matériel est rendu en ordre.',
      '### Puis-je annuler ?',
      'Oui, gratuitement jusqu’à 24 h avant le retrait.',
      '',
      '## Au comptoir',
      '### Que dois-je apporter ?',
      'Le QR code de votre réservation et une pièce d’identité.',
      '### Le matériel est-il prêt ?',
      'Oui : il est préparé, contrôlé et entretenu avant votre passage.',
      '',
      '## Retour',
      '### Et si je rends en retard ?',
      'Chaque jour de retard est facturé au tarif journalier, majoré.',
      '### Dois-je nettoyer le matériel ?',
      'Oui, rendez-le nettoyé et complet. Un forfait de nettoyage s’applique sinon.',
    ].join('\n'),
  },
  {
    key: 'legal',
    title: 'Mentions légales',
    body: 'BRICOLOC — société de démonstration. Coordonnées, TVA et conditions générales fictives, à compléter dans l’administration. Contexte : Belgique, prix en euros, TVA 21 %.',
  },
  {
    key: 'terms',
    title: 'Conditions générales de location (extrait démo)',
    body: 'Le locataire s’engage à restituer le matériel dans l’état où il l’a reçu, nettoyé, avec tous les accessoires. Toute détérioration ou pièce manquante est facturée. Document de démonstration.',
  },

  /* ---- Blocs éditables de la page d'accueil (auto-traduits NL/EN) ---- */
  { key: 'home.hero.title', title: '', body: 'Le bon outil.' },
  { key: 'home.hero.accent', title: '', body: 'Juste le temps qu’il faut.' },
  {
    key: 'home.hero.subtitle',
    title: '',
    body: 'Du matériel pro, vérifié et disponible aujourd’hui. Réservez en quelques clics, retirez en 2h ou faites-vous livrer partout en Belgique.',
  },
  { key: 'home.help.subtitle', title: '', body: 'Choisissez votre chantier, on vous montre le bon matériel.' },
  {
    key: 'home.weekend.text',
    title: '',
    body: 'Retrait le vendredi ou samedi, retour le lundi matin : vous ne payez qu’une journée.',
  },
  {
    key: 'home.step1.text',
    title: '',
    body: 'Une seule fois, pour toute la commande. On vérifie la disponibilité de tout le matériel en même temps.',
  },
  {
    key: 'home.step2.text',
    title: '',
    body: 'Machines, accessoires et consommables adaptés. Retrait au dépôt ou livraison sur chantier.',
  },
  {
    key: 'home.step3.text',
    title: '',
    body: 'En ligne ou à l’enlèvement pour un Click & Collect. Votre matériel est prêt, contrôlé et entretenu.',
  },
  {
    key: 'home.packs.text',
    title: '',
    body: 'Des ensembles prêts à l’emploi, pensés pour les particuliers : une tâche, un pack, un prix.',
  },
  { key: 'home.advice.title', title: 'Une question ? Une panne ?', body: 'Notre équipe vous répond et vous conseille sur le bon outil.' },
  {
    key: 'home.advice.text',
    title: 'Une question ? Une panne ?',
    body: 'Une question sur le bon outil, une panne pendant la location, un accessoire manquant ? Notre équipe technique répond vite.',
  },
  { key: 'home.strength.1', title: '', body: 'Réservation en ligne, à toute heure' },
  { key: 'home.strength.2', title: '', body: 'Langues : français, néerlandais, anglais' },
  { key: 'home.strength.3', title: '', body: 'Une seule date de location pour toute la commande' },
  { key: 'home.strength.4', title: '', body: 'Matériel suivi à l’exemplaire, entretenu et contrôlé' },
  { key: 'home.cta.title', title: 'Prêt à démarrer votre chantier ?', body: 'Réservez le bon matériel en quelques minutes.' },
  {
    key: 'home.cta.text',
    title: 'Prêt à démarrer votre chantier ?',
    body: 'Des centaines de machines professionnelles, réservables en ligne 24h/24, en Click & Collect ou en livraison.',
  },
  { key: 'home.task.demolir', title: '', body: 'Démolir, percer' },
  { key: 'home.task.beton', title: '', body: 'Béton & pierre' },
  { key: 'home.task.bois', title: '', body: 'Travailler le bois' },
  { key: 'home.task.peindre', title: '', body: 'Peindre & enduire' },
  { key: 'home.task.poncer', title: '', body: 'Poncer' },
  { key: 'home.task.chauffer', title: '', body: 'Chauffer & assécher' },
  { key: 'home.task.jardin', title: '', body: 'Jardin & extérieur' },
  { key: 'home.task.nettoyer', title: '', body: 'Nettoyer' },
];

async function main() {
  console.log('Seed BRICOLOC (donnees de demonstration)...');

  await prisma.setting.upsert({
    where: { key: 'vatRate' },
    create: { key: 'vatRate', value: DEFAULT_SETTINGS.vatRate },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: 'company' },
    create: { key: 'company', value: DEFAULT_SETTINGS.company as never },
    update: {},
  });
  for (const [k, v] of Object.entries({
    sameDayCutoffHour: DEFAULT_SETTINGS.sameDayCutoffHour,
    weekendRuleEnabled: DEFAULT_SETTINGS.weekendRuleEnabled,
    minLeadTimeHours: DEFAULT_SETTINGS.minLeadTimeHours,
    deliveryBaseFee: DEFAULT_SETTINGS.deliveryBaseFee,
    deliveryFreeThreshold: DEFAULT_SETTINGS.deliveryFreeThreshold,
    lateFeeMultiplier: DEFAULT_SETTINGS.lateFeeMultiplier,
    cleaningFeeDefault: DEFAULT_SETTINGS.cleaningFeeDefault,
    proDiscountPctDefault: DEFAULT_SETTINGS.proDiscountPctDefault,
  })) {
    await prisma.setting.upsert({
      where: { key: k },
      create: { key: k, value: v as never },
      update: {},
    });
  }

  const catMap = new Map<string, string>();
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i]!;
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, bolt: c.bolt, position: i },
      update: { name: c.name, bolt: c.bolt, position: i },
    });
    catMap.set(c.slug, row.id);
  }

  const prodMap = new Map<string, string>();
  for (const p of PRODUCTS) {
    const row = await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        kind: p.kind,
        categoryId: p.category ? catMap.get(p.category) ?? null : null,
        shortDescription: p.shortDescription,
        description: p.description ?? p.shortDescription,
        recommendedUses: (p.recommendedUses ?? []) as never,
        specs: (p.specs ?? {}) as never,
        includedAccessories: (p.includedAccessories ?? []) as never,
        images: [IMG(p.name.slice(0, 18)), IMG('BRICOLOC')] as never,
        dailyPrice: p.dailyPrice,
        weekendPrice: p.weekendPrice ?? null,
        weekPrice: p.weekPrice ?? null,
        monthPrice: p.monthPrice ?? null,
        tiers: (p.tiers ?? []) as never,
        deposit: p.deposit ?? 0,
        stockQty: p.stockQty ?? null,
        isConsumable: p.kind === 'CONSUMABLE',
        isDemo: true,
        published: true,
      },
      update: {},
    });
    prodMap.set(p.slug, row.id);

    const unitCount = p.units ?? 0;
    for (let i = 1; i <= unitCount; i++) {
      // Prefixe court mais UNIQUE par produit (evite les collisions d'asset tags).
      const words = p.slug.split('-');
      const prefix = (
        words.map((w) => w.slice(0, 3)).join('').toUpperCase() +
        String(Math.abs([...p.slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 1000).padStart(3, '0')
      ).replace(/[^A-Z0-9]/g, '');
      const assetTag = `${prefix}-${String(i).padStart(2, '0')}`;
      await prisma.productUnit.upsert({
        where: { assetTag },
        create: {
          productId: row.id,
          assetTag,
          serialNumber: `SN-${qr()}`,
          qrToken: `U-${qr()}`,
          state: 'AVAILABLE',
          nextMaintenanceAt: new Date(Date.now() + (60 + i * 10) * 86400000),
        },
        update: {},
      });
    }
  }

  // Liens produits.
  for (const p of PRODUCTS) {
    const fromId = prodMap.get(p.slug)!;
    const linkList: { toId?: string; type: string; quantity: number }[] = [];
    for (const s of p.accessories ?? []) linkList.push({ toId: prodMap.get(s), type: 'ACCESSORY', quantity: 1 });
    for (const s of p.consumables ?? []) linkList.push({ toId: prodMap.get(s), type: 'CONSUMABLE', quantity: 1 });
    for (const s of p.ppe ?? []) linkList.push({ toId: prodMap.get(s), type: 'PPE', quantity: 1 });
    for (const s of p.complementary ?? []) linkList.push({ toId: prodMap.get(s), type: 'COMPLEMENTARY', quantity: 1 });
    for (const pi of p.packItems ?? []) linkList.push({ toId: prodMap.get(pi.slug), type: 'PACK_ITEM', quantity: pi.quantity });
    for (const l of linkList) {
      if (!l.toId) continue;
      await prisma.productLink.upsert({
        where: { fromId_toId_type: { fromId, toId: l.toId, type: l.type } },
        create: { fromId, toId: l.toId, type: l.type, quantity: l.quantity },
        update: { quantity: l.quantity },
      });
    }
  }

  // Equipe : un compte par role. Mot de passe commun de demo.
  const staffSeed: { email: string; name: string; role: string }[] = [
    { email: 'admin@bricoloc.example', name: 'Alex Admin', role: 'ADMIN' },
    { email: 'responsable@bricoloc.example', name: 'Rachid Responsable', role: 'RESPONSABLE' },
    { email: 'comptoir@bricoloc.example', name: 'Camille Comptoir', role: 'COMPTOIR' },
    { email: 'preparateur@bricoloc.example', name: 'Pauline Préparation', role: 'PREPARATEUR' },
    { email: 'livreur@bricoloc.example', name: 'Ludo Livreur', role: 'LIVREUR' },
    { email: 'technicien@bricoloc.example', name: 'Théo Technicien', role: 'TECHNICIEN' },
    { email: 'compta@bricoloc.example', name: 'Colette Comptabilité', role: 'COMPTABILITE' },
  ];
  for (const s of staffSeed) {
    await prisma.staffUser.upsert({
      where: { email: s.email },
      create: { ...s, passwordHash: hash('bricoloc') },
      update: { role: s.role, name: s.name },
    });
  }
  void STAFF_ROLES;

  // Client de demo (particulier) + client pro.
  await prisma.user.upsert({
    where: { email: 'client@bricoloc.example' },
    create: {
      email: 'client@bricoloc.example',
      passwordHash: hash('bricoloc'),
      firstName: 'Chris',
      lastName: 'Client',
      phone: '+32 470 00 00 00',
      customerType: 'PARTICULIER',
      addresses: {
        create: {
          label: 'Domicile',
          line1: 'Avenue de la Démo 12',
          postalCode: '1050',
          city: 'Ixelles',
          country: 'BE',
        },
      },
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: 'pro@bricoloc.example' },
    create: {
      email: 'pro@bricoloc.example',
      passwordHash: hash('bricoloc'),
      firstName: 'Patricia',
      lastName: 'Pro',
      phone: '+32 475 11 22 33',
      customerType: 'PRO',
      companyName: 'Rénov Demo SRL',
      vatNumber: 'BE 0999.888.777 (demo)',
      negotiatedDiscountPct: 0.15,
    },
    update: {},
  });

  // Avis clients de démonstration (publiés).
  const reviewableSlugs = (
    await prisma.product.findMany({
      where: { published: true, kind: 'MACHINE' },
      select: { id: true, slug: true },
      take: 14,
    })
  );
  const DEMO_REVIEWS = [
    { name: 'Julien D.', rating: 5, title: 'Nickel', body: 'Machine propre, bien entretenue, prête à l’heure. Retrait au comptoir en 5 minutes.' },
    { name: 'Sophie M.', rating: 4, title: 'Bon rapport qualité/prix', body: 'Un peu d’attente au comptoir un samedi matin, mais le matériel était parfait pour mon chantier.' },
    { name: 'Karim B.', rating: 5, title: 'Parfait pour un week-end', body: 'Pris le vendredi soir, rendu le lundi, facturé une journée. Exactement ce qu’il me fallait.' },
    { name: 'Nathalie V.', rating: 5, title: 'Équipe de bon conseil', body: 'On m’a orienté vers le bon modèle et les bons consommables. Résultat au top.' },
    { name: 'Marc L.', rating: 4, title: 'Fiable', body: 'Rien à redire, la caution a été libérée le jour même du retour.' },
    { name: 'Émilie R.', rating: 5, title: 'Je recommande', body: 'Réservation en ligne simple, matériel conforme à la description.' },
  ];
  let ri = 0;
  for (const p of reviewableSlugs) {
    const n = 2 + (ri % 3); // 2 à 4 avis par produit
    for (let k = 0; k < n; k++) {
      const src = DEMO_REVIEWS[(ri + k) % DEMO_REVIEWS.length]!;
      const exists = await prisma.review.findFirst({
        where: { productId: p.id, authorName: src.name },
      });
      if (!exists) {
        await prisma.review.create({
          data: {
            productId: p.id,
            authorName: src.name,
            rating: src.rating,
            title: src.title,
            body: src.body,
            status: 'PUBLISHED',
            publishedAt: new Date(Date.now() - (ri * 3 + k) * 86_400_000),
          },
        });
      }
    }
    ri++;
  }

  // Promotions.
  for (const promo of [
    { code: 'BIENVENUE10', kind: 'PERCENT', value: 10, minTotalHT: 50 },
    { code: 'CHANTIER25', kind: 'AMOUNT', value: 25, minTotalHT: 150 },
  ]) {
    await prisma.promotion.upsert({
      where: { code: promo.code },
      create: promo,
      update: {},
    });
  }

  // Dépôt Bricoloc : géocodage unique -> Setting delivery.depotLat/Lng.
  {
    const depotAddr = {
      line1: 'Gieterijstraat 49',
      postalCode: '1601',
      city: 'Ruisbroek',
      country: 'Belgium',
    };
    const g = await geocode(depotAddr).catch(() => null);
    await setSetting('delivery', {
      ...DEFAULT_SETTINGS.delivery,
      depotLat: g?.lat ?? DEFAULT_SETTINGS.delivery.depotLat,
      depotLng: g?.lng ?? DEFAULT_SETTINGS.delivery.depotLng,
    });
    console.log(
      g ? `Dépôt géocodé : ${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}` : 'Dépôt : coords de repli',
    );
  }

  // Zones de livraison (prefixes de codes postaux belges - demo).
  for (const z of [
    { name: 'Bruxelles', postalPrefixes: ['10', '11', '12'], baseFee: 25, perKm: 0 },
    { name: 'Brabant wallon', postalPrefixes: ['13', '14'], baseFee: 35, perKm: 0 },
    { name: 'Brabant flamand', postalPrefixes: ['15', '16', '17', '18', '19', '30', '31'], baseFee: 35, perKm: 0 },
  ]) {
    const exists = await prisma.deliveryZone.findFirst({ where: { name: z.name } });
    if (!exists)
      await prisma.deliveryZone.create({
        data: { ...z, postalPrefixes: z.postalPrefixes as never },
      });
  }

  for (const c of CONTENT) {
    await prisma.content.upsert({
      where: { key_locale: { key: c.key, locale: 'fr' } },
      create: { key: c.key, locale: 'fr', title: c.title || null, body: c.body },
      update: { title: c.title || null, body: c.body },
    });
  }

  // Traduction auto NL/EN des contenus (si DEEPL_API_KEY présente).
  if (translationEnabled()) {
    process.stdout.write('Traduction DeepL des contenus (NL/EN)...');
    for (const c of CONTENT) {
      await syncContentTranslations({ key: c.key, title: c.title || null, body: c.body });
    }
    console.log(' ok');
  }

  const counts = {
    produits: await prisma.product.count(),
    exemplaires: await prisma.productUnit.count(),
    equipe: await prisma.staffUser.count(),
  };
  console.log('Seed termine :', counts);
  console.log('Comptes de demo (mot de passe : "bricoloc") :');
  console.log('  Client   : client@bricoloc.example / pro@bricoloc.example');
  console.log('  Equipe   : admin@bricoloc.example, comptoir@bricoloc.example, ...');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
