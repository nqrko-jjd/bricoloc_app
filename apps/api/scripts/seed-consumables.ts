/**
 * Sème des consommables / accessoires « adaptés » et les rattache aux machines.
 *
 * Références RÉELLES relevées sur cipac.be (revendeur partenaire Bricoloc pour
 * l'équipement, avec Lecot / Sanimat Wavre / BMK). Prix = prix indicatif HTVA
 * Cipac au moment du relevé (2026-09) — à rafraîchir périodiquement.
 *
 * Chaque entrée devient un Product (kind CONSUMABLE, non publié au catalogue de
 * location) + un ProductLink CONSUMABLE depuis chaque machine dont le slug
 * contient un des `machineKeywords`.
 *
 *   npx tsx scripts/seed-consumables.ts
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

/** Rayon Cipac où trouver la pièce (slugs relevés sur cipac.be). */
const CIPAC = 'https://www.cipac.be';
const RAYON = {
  disqueDiamant: `${CIPAC}/disque-diamant?`,
  mecheSds: `${CIPAC}/meche-sds?`,
  burinSds: `${CIPAC}/burin-sds?`,
  abrasifExcentrique: `${CIPAC}/abrasif-excentrique?`,
  abrasifBande: `${CIPAC}/abrasif-a-bande?`,
  lameCirculaire: `${CIPAC}/lame-circulaire?`,
  lameRecipro: `${CIPAC}/lame-de-scie-recipro?`,
  lameSauteuse: `${CIPAC}/lame-de-scie-sauteuse?`,
  peinture: `${CIPAC}/peinture`,
  nettoyage: `${CIPAC}/nettoyage-fr-3821?`,
  jardinage: `${CIPAC}/jardinage-fr-3868?`,
};

interface PartSeed {
  slug: string;
  name: string;
  brand: string;
  ref: string; // référence article fournisseur
  priceHT: number; // prix indicatif HTVA
  url?: string; // rayon Cipac (sinon déduit du slug)
  supplier?: string; // revendeur (défaut Cipac)
  short?: string;
  /** rattache la pièce à toute machine dont le slug contient un de ces fragments */
  machineKeywords: string[];
}

const PARTS: PartSeed[] = [
  // ---- Disques (meuleuses / disqueuses / découpeuses) ----
  {
    slug: 'disque-diamant-beton-230',
    name: 'Disque diamant à tronçonner béton Ø230 mm',
    brand: 'Bosch',
    ref: '2608602655',
    priceHT: 123.92,
    short: 'Best for Concrete, alésage 22,23 mm — béton, matériaux de maçonnerie.',
    machineKeywords: ['disqueuse', 'decoupeuse', 'meuleuse', 'tronconneuse', 'rainureuse'],
  },
  {
    slug: 'disque-diamant-universel-230',
    name: 'Disque diamant universel Ø230 mm',
    brand: 'Bosch',
    ref: '2608615065',
    priceHT: 30.99,
    short: 'Standard for Universal — usage général chantier.',
    machineKeywords: ['disqueuse', 'decoupeuse', 'meuleuse', 'tronconneuse'],
  },
  {
    slug: 'disque-diamant-125',
    name: 'Disque diamant Ø125 mm (X-LOCK)',
    brand: 'Bosch',
    ref: '2608900533',
    priceHT: 37.47,
    short: 'Ø125 mm, alésage 22,23 mm — meuleuse d’angle.',
    machineKeywords: ['meuleuse', 'disqueuse-125'],
  },
  {
    slug: 'disque-diamant-husqvarna-125',
    name: 'Disque diamant Husqvarna G65 Ø125 mm',
    brand: 'Husqvarna',
    ref: '579821540',
    priceHT: 76.67,
    short: 'Double rangée, béton et matériaux durs.',
    machineKeywords: ['meuleuse', 'disqueuse-125', 'decoupeuse'],
  },
  // ---- Mèches / forets (perforateurs, perceuses) ----
  {
    slug: 'jeu-meches-sds-plus',
    name: 'Jeu de 5 mèches béton SDS+ (5-10 mm)',
    brand: 'Bosch',
    ref: '2608900197',
    priceHT: 42.18,
    short: 'SDS plus-7X, cassette Robustline — béton armé.',
    machineKeywords: ['perforateur', 'perfo', 'burineur', 'marteau-perforateur', 'perceuse-a-percussion'],
  },
  {
    slug: 'coffret-meches-sds-plus-10',
    name: 'Coffret 10 mèches béton SDS+',
    brand: 'Ironside',
    ref: '12168091',
    priceHT: 19.77,
    short: 'Coffret métallique, diamètres courants.',
    machineKeywords: ['perforateur', 'perfo', 'marteau-perforateur'],
  },
  {
    slug: 'meche-beton-sds-plus-10x200',
    name: 'Mèche béton SDS+ Ø10 × 200 mm',
    brand: 'Ironside',
    ref: '12328293',
    priceHT: 5.04,
    short: 'À l’unité, béton / pierre.',
    machineKeywords: ['perforateur', 'perfo', 'marteau-perforateur'],
  },
  {
    slug: 'burin-plat-sds-plus',
    name: 'Burin plat SDS+ 250 mm',
    brand: 'Bosch',
    ref: '2608690101',
    priceHT: 11.5,
    short: 'Burin plat 20 mm pour perforateur-burineur SDS+.',
    machineKeywords: ['perforateur', 'burineur', 'perfo'],
  },
  // ---- Abrasifs (ponceuses) ----
  {
    slug: 'abrasif-excentrique-125-g120',
    name: 'Abrasifs Ø125 mm grain 120 (lot de 50)',
    brand: 'Bosch',
    ref: '2608900912',
    priceHT: 30.82,
    short: 'C470 Best for Wood and Paint, 8 trous — ponceuse excentrique.',
    machineKeywords: ['ponceuse-excentrique', 'ponceuse-orbitale', 'ponceuse'],
  },
  {
    slug: 'abrasif-excentrique-125-assortiment',
    name: 'Abrasifs Ø125 mm grains 80/120/180 (assortiment)',
    brand: 'Bosch',
    ref: '2608900806',
    priceHT: 6.16,
    short: 'Petit lot de dépannage, 8 trous.',
    machineKeywords: ['ponceuse-excentrique', 'ponceuse-orbitale', 'ponceuse'],
  },
  {
    slug: 'bande-abrasive-ponceuse',
    name: 'Bandes abrasives 75 × 533 mm (lot de 3)',
    brand: 'Bosch',
    ref: '2608606072',
    priceHT: 9.9,
    short: 'Grain 80 — ponceuse à bande.',
    machineKeywords: ['ponceuse-a-bande', 'ponceuse-bande'],
  },
  // ---- Lames de scie ----
  {
    slug: 'lame-scie-circulaire-190',
    name: 'Lame scie circulaire Ø190 mm 24 dents',
    brand: 'Bosch',
    ref: '2608644365',
    priceHT: 65.97,
    short: 'Coupe rapide bois de construction.',
    machineKeywords: ['scie-circulaire', 'scie-plongeante'],
  },
  {
    slug: 'lames-scie-sabre-bois-metal',
    name: 'Lames scie sabre bois + métal (jeu de 5)',
    brand: 'Bosch',
    ref: '2607010901',
    priceHT: 18.5,
    short: 'Démolition — bois avec clous, métal.',
    machineKeywords: ['scie-sabre', 'scie-recipro'],
  },
  {
    slug: 'lames-scie-sauteuse-assortiment',
    name: 'Lames scie sauteuse (assortiment 10 pièces)',
    brand: 'Bosch',
    ref: '2607011171',
    priceHT: 21.9,
    short: 'Bois, panneaux, métal, PVC.',
    machineKeywords: ['scie-sauteuse'],
  },
  // ---- Peinture / pulvérisation ----
  {
    slug: 'buse-station-airless',
    name: 'Buse airless réversible 517',
    brand: 'Wagner',
    ref: '0554517',
    priceHT: 42.0,
    short: 'Buse standard murs/plafonds pour station airless.',
    machineKeywords: ['airless', 'station-de-peinture', 'pistolet-a-peinture', 'peinture'],
  },
  {
    slug: 'manchons-rouleau-lot',
    name: 'Manchons de rouleau anti-goutte 25 cm (lot de 3)',
    brand: 'Anza',
    ref: '571582',
    priceHT: 12.5,
    short: 'Poil moyen, peintures murales.',
    machineKeywords: ['airless', 'station-de-peinture', 'peinture'],
  },
  // ---- Filtres aspirateurs ----
  {
    slug: 'filtre-aspirateur-chantier',
    name: 'Filtre plissé aspirateur eau & poussières',
    brand: 'Kärcher',
    ref: '64145520',
    priceHT: 24.9,
    short: 'Cartouche filtrante compatible aspirateurs de chantier.',
    machineKeywords: ['aspirateur'],
  },
  // ---- Divers ----
  {
    slug: 'huile-chaine-tronconneuse-1l',
    name: 'Huile de chaîne tronçonneuse 1 L',
    brand: 'Husqvarna',
    ref: '5878085-01',
    priceHT: 8.9,
    short: 'Lubrification chaîne — biodégradable.',
    machineKeywords: ['tronconneuse', 'elagueuse', 'perche-elagueuse'],
  },
  {
    slug: 'fil-nylon-debroussailleuse',
    name: 'Fil nylon débroussailleuse Ø2,4 mm (bobine 90 m)',
    brand: 'Oregon',
    ref: '69-462',
    priceHT: 16.9,
    short: 'Fil rond co-polymère — tête à fil.',
    machineKeywords: ['debroussailleuse', 'coupe-bordure'],
  },
];

async function main() {
  const machines = await prisma.product.findMany({
    where: { kind: 'MACHINE' },
    select: { id: true, slug: true },
  });

  let created = 0;
  let linked = 0;

  // Déduit le rayon Cipac du slug si `url` n'est pas fourni.
  const rayonFor = (slug: string): string => {
    if (slug.startsWith('disque-diamant')) return RAYON.disqueDiamant;
    if (slug.includes('meche') && slug.includes('sds')) return RAYON.mecheSds;
    if (slug.startsWith('burin')) return RAYON.burinSds;
    if (slug.startsWith('abrasif-excentrique')) return RAYON.abrasifExcentrique;
    if (slug.startsWith('bande-abrasive')) return RAYON.abrasifBande;
    if (slug.includes('scie-circulaire')) return RAYON.lameCirculaire;
    if (slug.includes('scie-sabre')) return RAYON.lameRecipro;
    if (slug.includes('scie-sauteuse')) return RAYON.lameSauteuse;
    if (slug.includes('airless') || slug.includes('rouleau')) return RAYON.peinture;
    if (slug.includes('filtre-aspirateur')) return RAYON.nettoyage;
    if (slug.includes('chaine') || slug.includes('nylon')) return RAYON.jardinage;
    return `${CIPAC}/consommable-accessoire`;
  };

  for (const part of PARTS) {
    const url = part.url ?? rayonFor(part.slug);
    const consumable = await prisma.product.upsert({
      where: { slug: part.slug },
      update: {
        name: part.name,
        brand: part.brand,
        supplierRef: part.ref,
        supplierUrl: url,
        supplierListPrice: part.priceHT,
        partSupplier: part.supplier ?? 'Cipac',
        shortDescription: part.short ?? null,
      },
      create: {
        slug: part.slug,
        name: part.name,
        kind: 'CONSUMABLE',
        brand: part.brand,
        shortDescription: part.short ?? null,
        supplierRef: part.ref,
        supplierUrl: url,
        supplierListPrice: part.priceHT,
        partSupplier: part.supplier ?? 'Cipac',
        isConsumable: true,
        published: false, // pièce à acheter, pas un article de location
        isDemo: false,
        dailyPrice: 0,
      },
    });
    created++;

    const targets = machines.filter((m) =>
      part.machineKeywords.some((k) => m.slug.includes(k)),
    );
    for (const m of targets) {
      await prisma.productLink.upsert({
        where: { fromId_toId_type: { fromId: m.id, toId: consumable.id, type: 'CONSUMABLE' } },
        update: {},
        create: { fromId: m.id, toId: consumable.id, type: 'CONSUMABLE', quantity: 1 },
      });
      linked++;
    }
  }

  console.log(`${created} consommables · ${linked} liens machine→consommable.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
