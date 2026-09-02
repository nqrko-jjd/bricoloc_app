/**
 * Machines du partenaire Loiselet (parc « lourd » que Bricoloc ne stocke pas).
 *   npx tsx scripts/seed-loiselet.ts
 *
 * Source : tarif de location Loiselet 2026 (PDF). Prix « 1 jour » relevés à la main
 * → À VÉRIFIER avec Loiselet / un export officiel.
 *   supplierListPrice = prix Loiselet 1 j
 *   dailyPrice        = prix client = supplierListPrice + marge (settings.loiselet.marginPct)
 *
 * Ces produits :
 *   supplier = 'LOISELET'  ·  availabilityMode = 'ON_REQUEST'  ·  deliveryPolicy = 'QUOTE_ONLY'
 *   -> le client voit « via notre partenaire — confirmation sous 1 h », livraison sur devis.
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

const MARGIN = 0.25; // = DEFAULT_SETTINGS.loiselet.marginPct

type L = {
  slug: string;
  name: string;
  category: string;
  loiseletDaily: number; // prix Loiselet 1 j (HTVA)
  loiseletWeek?: number; // prix Loiselet > 5 j (par jour)
  deposit: number;
  short: string;
  specs?: Record<string, string>;
};

const MACHINES: L[] = [
  // ── Nacelles / travail en hauteur ──
  {
    slug: 'loiselet-nacelle-ciseaux-8m',
    name: 'Nacelle ciseaux électrique 8 m',
    category: 'echelles-echafaudages',
    loiseletDaily: 95,
    loiseletWeek: 72,
    deposit: 1500,
    short: 'Plateforme élévatrice à ciseaux, 8 m de hauteur de travail, sur roues, intérieur/extérieur stabilisé.',
    specs: { 'Hauteur de travail': '8 m', 'Charge panier': '363 kg', Largeur: '0,81 m', Énergie: 'Électrique' },
  },
  {
    slug: 'loiselet-nacelle-ciseaux-10m',
    name: 'Nacelle ciseaux électrique 10 m',
    category: 'echelles-echafaudages',
    loiseletDaily: 115,
    loiseletWeek: 87,
    deposit: 1800,
    short: 'Plateforme à ciseaux 10 m, électrique, pour chantiers de façade et intérieur.',
    specs: { 'Hauteur de travail': '10 m', 'Charge panier': '230 kg', Énergie: 'Électrique' },
  },
  {
    slug: 'loiselet-nacelle-ciseaux-12m',
    name: 'Nacelle ciseaux électrique 12 m',
    category: 'echelles-echafaudages',
    loiseletDaily: 160,
    loiseletWeek: 120,
    deposit: 2000,
    short: 'Plateforme à ciseaux 12 m avec stabilisateurs, électrique.',
    specs: { 'Hauteur de travail': '12 m', 'Charge panier': '227 kg', Énergie: 'Électrique' },
  },
  {
    slug: 'loiselet-nacelle-mat-vertical-8m',
    name: 'Nacelle mât vertical 8 m',
    category: 'echelles-echafaudages',
    loiseletDaily: 80,
    loiseletWeek: 50,
    deposit: 1200,
    short: 'Nacelle à mât vertical (type Toucan), compacte, idéale en intérieur (couloirs, magasins).',
    specs: { 'Hauteur de travail': '8 m', 'Charge panier': '159 kg', Largeur: '0,74 m' },
  },

  // ── Compactage ──
  {
    slug: 'loiselet-plaque-vibrante',
    name: 'Plaque vibrante',
    category: 'beton-pierre',
    loiseletDaily: 50,
    loiseletWeek: 38,
    deposit: 400,
    short: 'Plaque vibrante pour compactage de sols, sable stabilisé et pavés.',
  },
  {
    slug: 'loiselet-plaque-vibrante-reversible',
    name: 'Plaque vibrante réversible',
    category: 'beton-pierre',
    loiseletDaily: 70,
    loiseletWeek: 53,
    deposit: 600,
    short: 'Plaque vibrante réversible, compactage en marche avant et arrière, tranchées.',
  },
  {
    slug: 'loiselet-pilonneuse',
    name: 'Pilonneuse (dame sauteuse) 75 kg',
    category: 'beton-pierre',
    loiseletDaily: 50,
    loiseletWeek: 38,
    deposit: 500,
    short: 'Dame sauteuse pour compactage de tranchées étroites et remblais.',
    specs: { Poids: '75 kg' },
  },
  {
    slug: 'loiselet-rouleau-compacteur-650kg',
    name: 'Rouleau compacteur à billes 650 kg',
    category: 'beton-pierre',
    loiseletDaily: 65,
    loiseletWeek: 53,
    deposit: 600,
    short: 'Petit rouleau tandem à billes, allées, terrasses et sous-couches.',
    specs: { Poids: '650 kg', Largeur: '0,80 m' },
  },

  // ── Terrassement ──
  {
    slug: 'loiselet-minipelle-1-6t',
    name: 'Mini-pelle 1,6 T',
    category: 'exterieur',
    loiseletDaily: 125,
    loiseletWeek: 88,
    deposit: 1500,
    short: 'Mini-pelle sur chenilles 1,6 T sans cabine, 3 godets fournis. Permis non requis.',
    specs: { Poids: '1,6 T', 'Largeur chenilles': '1,00 – 1,20 m', Godets: '3' },
  },
  {
    slug: 'loiselet-minipelle-2-6t',
    name: 'Mini-pelle 2,6 T',
    category: 'exterieur',
    loiseletDaily: 145,
    loiseletWeek: 102,
    deposit: 1800,
    short: 'Mini-pelle sur chenilles 2,6 T, 3 godets, pour terrassement, drainage, plantations.',
    specs: { Poids: '2,6 T', 'Largeur chenilles': '1,50 m', Godets: '3' },
  },
  {
    slug: 'loiselet-minipelle-3-5t',
    name: 'Mini-pelle 3,5 T',
    category: 'exterieur',
    loiseletDaily: 170,
    loiseletWeek: 119,
    deposit: 2000,
    short: 'Mini-pelle 3,5 T sur chenilles, chantiers de terrassement plus lourds.',
    specs: { Poids: '3,5 T', 'Largeur chenilles': '1,75 m' },
  },
  {
    slug: 'loiselet-mini-dumper-400kg',
    name: 'Mini-dumper sur pneus 400 kg',
    category: 'exterieur',
    loiseletDaily: 80,
    loiseletWeek: 75,
    deposit: 700,
    short: 'Mini-transporteur à benne, 400 kg, évacuation de gravats et terre.',
    specs: { Charge: '400 kg', Largeur: '0,85 m' },
  },
  {
    slug: 'loiselet-dumper-4x4-1t',
    name: 'Dumper 4×4 1 T',
    category: 'exterieur',
    loiseletDaily: 115,
    loiseletWeek: 87,
    deposit: 1000,
    short: 'Dumper articulé 4×4, benne 1 T haut déversement, terrains difficiles.',
    specs: { Charge: '1 T', Largeur: '1,10 m' },
  },

  // ── Extérieur & jardin ──
  {
    slug: 'loiselet-broyeur-branches-6cm',
    name: 'Broyeur de branches Ø6 cm',
    category: 'exterieur',
    loiseletDaily: 70,
    loiseletWeek: 56,
    deposit: 500,
    short: 'Broyeur de végétaux jusqu’à Ø6 cm (Eliet Major / Jobeau), tractable.',
    specs: { 'Ø broyage max': '6 cm' },
  },
  {
    slug: 'loiselet-broyeur-branches-10cm',
    name: 'Broyeur de branches Ø10 cm',
    category: 'exterieur',
    loiseletDaily: 90,
    loiseletWeek: 72,
    deposit: 800,
    short: 'Broyeur de branches jusqu’à Ø10 cm, pour élagage et débroussaillage.',
    specs: { 'Ø broyage max': '10 cm' },
  },
  {
    slug: 'loiselet-rogneuse-souches',
    name: 'Rogneuse de souches autotractée',
    category: 'exterieur',
    loiseletDaily: 150,
    loiseletWeek: 120,
    deposit: 900,
    short: 'Rogneuse de souches autotractée (FSI B23), suppression de souches jusqu’à 25 cm sous le sol.',
    specs: { 'Profondeur de coupe': '25 cm' },
  },
  {
    slug: 'loiselet-fendeur-buches-5t',
    name: 'Fendeur de bûches électrique 5 T',
    category: 'exterieur',
    loiseletDaily: 40,
    loiseletWeek: 32,
    deposit: 300,
    short: 'Fendeur de bûches vertical/horizontal électrique, force 5 T, course 52 cm.',
    specs: { Force: '5 T', Course: '0,52 m', Alimentation: '230 V' },
  },
  {
    slug: 'loiselet-fendeur-buches-13t',
    name: 'Fendeur de bûches tractable 13 T',
    category: 'exterieur',
    loiseletDaily: 75,
    loiseletWeek: 60,
    deposit: 500,
    short: 'Fendeur de bûches sur prise de force / tractable, force 13 T pour gros diamètres.',
    specs: { Force: '13 T', Course: '1,08 m' },
  },
  {
    slug: 'loiselet-motoculteur-fraise',
    name: 'Motoculteur / fraise à bêcher',
    category: 'exterieur',
    loiseletDaily: 75,
    loiseletWeek: 60,
    deposit: 400,
    short: 'Motoculteur thermique à fraise avant (80–90 cm), préparation de potager et gazon.',
    specs: { 'Largeur de travail': '80 – 90 cm' },
  },

  // ── Énergie & éclairage ──
  {
    slug: 'loiselet-groupe-electrogene-5kva',
    name: 'Groupe électrogène 5 KVA (essence)',
    category: 'plomberie-electricite',
    loiseletDaily: 30,
    loiseletWeek: 24,
    deposit: 300,
    short: 'Groupe électrogène essence 5 KVA, chantier sans raccordement réseau.',
    specs: { Puissance: '5 KVA', Carburant: 'Essence' },
  },
  {
    slug: 'loiselet-groupe-electrogene-13kva',
    name: 'Groupe électrogène 13 KVA (diesel)',
    category: 'plomberie-electricite',
    loiseletDaily: 40,
    loiseletWeek: 32,
    deposit: 600,
    short: 'Groupe électrogène diesel 13 KVA, alimentation d’un chantier ou d’un événement.',
    specs: { Puissance: '13 KVA', Carburant: 'Diesel' },
  },
  {
    slug: 'loiselet-mat-eclairage-led-8m',
    name: 'Mât d’éclairage LED 8 m',
    category: 'plomberie-electricite',
    loiseletDaily: 85,
    loiseletWeek: 64,
    deposit: 800,
    short: 'Mât d’éclairage LED télescopique 8 m, éclairage de chantier ou d’événement nocturne.',
    specs: { Hauteur: '8 m', Source: 'LED' },
  },

  // ── Chauffage & assèchement ──
  {
    slug: 'loiselet-canon-chaleur-45kw',
    name: 'Canon à chaleur mazout 45 kW',
    category: 'chauffage-deshumidification',
    loiseletDaily: 45,
    loiseletWeek: 36,
    deposit: 300,
    short: 'Canon à air pulsé combustion directe, 45 kW, séchage et chauffage de chantier.',
    specs: { Puissance: '45 kW', Carburant: 'Mazout' },
  },
  {
    slug: 'loiselet-canon-chaleur-indirect-55kw',
    name: 'Canon à chaleur indirect 55 kW',
    category: 'chauffage-deshumidification',
    loiseletDaily: 90,
    loiseletWeek: 40,
    deposit: 500,
    short: 'Canon à chaleur à combustion indirecte 55 kW, air propre évacué des fumées, locaux occupés.',
    specs: { Puissance: '55 kW', Carburant: 'Mazout' },
  },
  {
    slug: 'loiselet-deshumidificateur-80l',
    name: 'Déshumidificateur 80 L/24 h',
    category: 'chauffage-deshumidification',
    loiseletDaily: 40,
    loiseletWeek: 29,
    deposit: 300,
    short: 'Déshumidificateur mobile 80 L/24 h, assèchement après dégât des eaux ou avant peinture.',
    specs: { Capacité: '80 L / 24 h', Alimentation: 'Monophasé' },
  },
];

async function main() {
  const cats = new Map(
    (await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );

  let done = 0;
  for (const m of MACHINES) {
    const categoryId = cats.get(m.category);
    if (!categoryId) {
      console.warn(`⚠ catégorie inconnue: ${m.category} (${m.slug})`);
      continue;
    }
    const dailyPrice = Math.round(m.loiseletDaily * (1 + MARGIN));
    const weekPrice = m.loiseletWeek
      ? Math.round(m.loiseletWeek * (1 + MARGIN) * 7)
      : null;

    const base = {
      name: m.name,
      kind: 'MACHINE',
      categoryId,
      shortDescription: m.short,
      specs: (m.specs ?? {}) as never,
      dailyPrice,
      weekPrice,
      deposit: m.deposit,
      supplier: 'LOISELET',
      supplierListPrice: m.loiseletDaily,
      availabilityMode: 'ON_REQUEST',
      deliveryPolicy: 'QUOTE_ONLY',
      isConsumable: false,
      isDemo: false,
      published: true,
    };
    await prisma.product.upsert({
      where: { slug: m.slug },
      create: { slug: m.slug, ...base },
      update: base,
    });
    done++;
  }
  console.log(`${done} machines Loiselet importées (supplier=LOISELET, sur demande).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
