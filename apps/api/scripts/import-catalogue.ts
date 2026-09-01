/**
 * Import du catalogue RÉEL Bricoloc (remplace les produits de démonstration).
 *
 *   npx tsx scripts/import-catalogue.ts             # import complet
 *   npx tsx scripts/import-catalogue.ts --no-images # sans traiter les photos
 *   npx tsx scripts/import-catalogue.ts --no-i18n   # sans traduction DeepL
 *
 * Sources : docs/discovery/woo-products.json, tarif-bricoloc-2024.txt,
 *           liste-machines-sheet1.tsv, apps/api/uploads/*.
 */
import '../src/env.js';
import { readFileSync } from 'node:fs';
import { customAlphabet } from 'nanoid';
import { prisma } from '../src/db.js';
import { newQrToken } from '../src/lib/qr.js';
import { storeImage } from '../src/lib/media.js';
import { buildI18nText, translationEnabled } from '../src/lib/translate.js';
import {
  loadWoo,
  loadTarif,
  loadMachines,
  matchImages,
  categorize,
  similarity,
  defaultDeposit,
  REAL_CATEGORIES,
  TARIF_ALIAS,
  type TarifRow,
  type MachineRow,
} from './lib-catalogue.js';

const args = process.argv.slice(2);
const DO_IMAGES = !args.includes('--no-images');
const DO_I18N = !args.includes('--no-i18n') && translationEnabled();

const tag = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const CAT_LEAD: Record<string, string> = {
  'forer-casser': 'Pour percer, forer et démolir efficacement.',
  'beton-pierre': 'Pour travailler le béton, la pierre et le carrelage.',
  'travail-du-bois': 'Pour couper, poncer et façonner le bois.',
  'peintures-finitions': 'Pour préparer les surfaces et appliquer peintures et enduits.',
  'chauffage-deshumidification': 'Pour chauffer, sécher et assainir un chantier.',
  exterieur: 'Pour les travaux de jardin et d’extérieur.',
  'plomberie-electricite': 'Pour les installations sanitaires et électriques.',
  'echelles-echafaudages': 'Pour travailler en hauteur en toute sécurité.',
  nettoyage: 'Pour un nettoyage professionnel, intérieur comme extérieur.',
  bricopack: 'Tout le matériel réuni pour réaliser votre chantier.',
};

function describe(name: string, brand: string | null, model: string | null, cat: string): string {
  const marque =
    brand && brand !== 'BRICOLOC' ? ` Modèle ${brand}${model ? ` ${model}` : ''}.` : '';
  return (
    `Louez ${name.toLowerCase()} chez Bricoloc.${marque} ` +
    `Machine contrôlée et entretenue avant chaque location, fournie avec ses accessoires de base. ` +
    `Disponible à la journée, à la semaine (4× le tarif jour) ou au mois (12× le tarif jour), ` +
    `en retrait au dépôt de Ruisbroek ou en livraison sur chantier.`
  );
}

async function processImages(paths: string[]): Promise<string[]> {
  if (!DO_IMAGES) return [];
  const urls: string[] = [];
  for (const p of paths.slice(0, 3)) {
    try {
      const buf = readFileSync(p);
      const m = await storeImage({ buffer: buf, originalname: p, mimetype: 'image/*' }, { source: 'import' });
      urls.push(m.url);
    } catch (e) {
      console.warn('  image ignorée', p, (e as Error).message);
    }
  }
  return urls;
}

async function main() {
  const woo = loadWoo();
  const tarif = loadTarif();
  const machines = loadMachines();
  console.log(
    `Import : ${woo.length} produits WooCommerce · ${tarif.length} tarifs · ${machines.length} machines\n`,
  );

  // 1) Catégories réelles.
  const catId: Record<string, string> = {};
  for (let i = 0; i < REAL_CATEGORIES.length; i++) {
    const c = REAL_CATEGORIES[i]!;
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, bolt: c.bolt, position: i },
      update: { name: c.name, bolt: c.bolt, position: i },
    });
    catId[c.slug] = row.id;
  }
  // Supprime les anciennes catégories de démo (hors des 10 réelles).
  const realSlugs = REAL_CATEGORIES.map((c) => c.slug);
  const stale = await prisma.category.findMany({ where: { slug: { notIn: realSlugs } } });
  for (const c of stale) {
    await prisma.product.updateMany({ where: { categoryId: c.id }, data: { categoryId: null } });
    await prisma.category.delete({ where: { id: c.id } });
  }
  if (stale.length) console.log(`Catégories démo supprimées : ${stale.length}`);

  // 2) Nettoyage des produits de démonstration (sans réservation liée).
  const demo = await prisma.product.findMany({
    where: { isDemo: true },
    select: { id: true, slug: true, _count: { select: { reservationItems: true, cartItems: true } } },
  });
  let removed = 0;
  for (const d of demo) {
    if (d._count.reservationItems === 0) {
      await prisma.cartItem.deleteMany({ where: { productId: d.id } });
      await prisma.productLink.deleteMany({ where: { OR: [{ fromId: d.id }, { toId: d.id }] } });
      await prisma.productUnit.deleteMany({ where: { productId: d.id } });
      await prisma.review.deleteMany({ where: { productId: d.id } });
      await prisma.product.delete({ where: { id: d.id } });
      removed++;
    } else {
      await prisma.product.update({ where: { id: d.id }, data: { published: false } });
    }
  }
  console.log(`Démo : ${removed} produits supprimés, ${demo.length - removed} archivés.\n`);

  const slugById = new Map<string, string>();
  let priced = 0;

  // 3) Machines réelles.
  for (const w of woo) {
    if (w.isPack) continue;

    // tarif
    let price: TarifRow | null = null;
    const aliasName = TARIF_ALIAS[w.slug];
    if (aliasName) price = tarif.find((r) => r.name.toUpperCase().startsWith(aliasName.toUpperCase())) ?? null;
    if (!price) {
      let best = { row: null as TarifRow | null, score: 0 };
      for (const r of tarif) {
        const s = similarity(w.title, r.name);
        if (s > best.score) best = { row: r, score: s };
      }
      if (best.score >= 0.3) price = best.row;
    }

    // marque / modèle / prix d'achat
    let brand: MachineRow | null = null;
    {
      let best = { row: null as MachineRow | null, score: 0 };
      for (const m of machines) {
        const s = similarity(w.title, `${m.type} ${m.model}`);
        if (s > best.score) best = { row: m, score: s };
      }
      if (best.score >= 0.32) brand = best.row;
    }

    const cat = categorize(w.title);
    const dayHT = price?.dayHT ?? brand?.competitor1?.day ?? 0;
    const weekHT = price?.weekHT || (dayHT ? dayHT * 4 : 0);
    const monthHT = price?.monthHT || (dayHT ? dayHT * 12 : 0);
    const qty = price?.qty ?? brand?.qty ?? 1;
    const deposit = defaultDeposit(dayHT, price?.garantie);
    const published = dayHT > 0;
    if (published) priced++;

    const desc = describe(w.title, brand?.brand ?? null, brand?.model ?? null, cat);
    const shortDesc = CAT_LEAD[cat] ?? '';

    let i18n: Record<string, unknown> | undefined;
    if (DO_I18N) {
      const [nameI, shortI, descI] = await Promise.all([
        buildI18nText(w.title),
        shortDesc ? buildI18nText(shortDesc) : Promise.resolve({}),
        buildI18nText(desc),
      ]);
      i18n = { name: nameI, shortDescription: shortI, description: descI };
    }

    const images = await processImages(matchImages(w.slug, w.title));

    const data = {
      name: w.title,
      kind: 'MACHINE',
      categoryId: catId[cat],
      shortDescription: shortDesc || null,
      description: desc,
      images: images as never,
      i18n: (i18n ?? null) as never,
      brand: brand?.brand ?? null,
      model: brand?.model ?? null,
      purchasePrice: brand?.purchasePrice ?? null,
      competitorRefs: (brand?.competitor1?.url
        ? [{ url: brand.competitor1.url, day: brand.competitor1.day }]
        : null) as never,
      dailyPrice: dayHT,
      weekPrice: weekHT || null,
      monthPrice: monthHT || null,
      deposit,
      stockQty: null,
      supplier: 'BRICOLOC',
      isDemo: false,
      published,
    };

    const product = await prisma.product.upsert({
      where: { slug: w.slug },
      create: { slug: w.slug, ...data },
      update: data,
    });
    slugById.set(product.id, w.slug);

    // exemplaires
    const existingUnits = await prisma.productUnit.count({ where: { productId: product.id } });
    for (let k = existingUnits; k < qty; k++) {
      await prisma.productUnit.create({
        data: {
          productId: product.id,
          assetTag: `${w.slug.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '')}-${tag()}`,
          qrToken: newQrToken('U'),
          state: 'AVAILABLE',
        },
      });
    }

    process.stdout.write(published ? '.' : '·');
  }
  console.log(`\n\nMachines : ${priced} publiées (tarif trouvé), ${woo.filter((w) => !w.isPack).length - priced} en brouillon.`);

  // 4) BricoPacks.
  await importPacks(catId['bricopack']!);

  const counts = {
    produits: await prisma.product.count({ where: { published: true } }),
    exemplaires: await prisma.productUnit.count(),
    medias: await prisma.mediaAsset.count(),
  };
  console.log('\nImport terminé :', counts);
  await prisma.$disconnect();
}

/** Les 5 BricoPacks + contenu approximatif (David affine en admin). */
async function importPacks(bricopackCatId: string) {
  const PACKS: { slug: string; name: string; desc: string; items: string[] }[] = [
    {
      slug: 'bricopack-percement-mur-dur',
      name: 'BricoPack percement mur dur',
      desc: 'Tout pour percer un mur en béton ou en pierre : perforateur, forets adaptés et aspiration des poussières.',
      items: ['marteau-perforateur', 'aspirateur-eau-et-poussieres-1000w-20-l'],
    },
    {
      slug: 'bricopack-percement-mur-creux',
      name: 'BricoPack percement mur creux',
      desc: 'Pour percer une brique creuse ou un bloc : perceuse-visseuse, forets et petit aspirateur.',
      items: ['perceuse-visseuse-sans-fil', 'aspirateur-eau-et-poussieres-1000w-20-l'],
    },
    {
      slug: 'bricopack-enduisage-mur',
      name: 'BricoPack enduisage mur',
      desc: 'Pour enduire et lisser un mur : malaxeur, ponceuse girafe et aspirateur.',
      items: ['malaxeur-de-mortier', 'ponceuse-girafe', 'aspirateur-eau-et-poussieres-1000w-20-l'],
    },
    {
      slug: 'bricopack-pose-parquet-stratifie',
      name: 'BricoPack pose parquet / stratifié',
      desc: 'Pour poser un parquet ou un sol stratifié : scie à onglet, scie circulaire et outil multifonction.',
      items: ['scie-a-onglet', 'scie-circulaire', 'outil-multifonction'],
    },
    {
      slug: 'bricopack-pose-carrelage-45cm',
      name: 'BricoPack pose carrelage < 45 cm',
      desc: 'Pour carreler jusqu’au format 45 cm : coupe-carrelage, malaxeur et meuleuse d’angle.',
      items: ['coupe-carrelage-45-cm', 'malaxeur-de-mortier', 'meuleuse-a-beton-125-mm'],
    },
  ];

  for (const p of PACKS) {
    const members = await prisma.product.findMany({
      where: { slug: { in: p.items } },
      select: { id: true, dailyPrice: true, deposit: true },
    });
    const daily = Math.round(members.reduce((s, m) => s + m.dailyPrice, 0) * 0.85); // -15% pack
    const deposit = members.reduce((s, m) => s + m.deposit, 0);

    let i18n: Record<string, unknown> | undefined;
    if (DO_I18N) {
      i18n = {
        name: await buildI18nText(p.name),
        description: await buildI18nText(p.desc),
      };
    }

    const pack = await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        kind: 'PACK',
        categoryId: bricopackCatId,
        description: p.desc,
        shortDescription: 'Un chantier, un pack, un prix.',
        dailyPrice: daily || 30,
        weekPrice: (daily || 30) * 4,
        monthPrice: (daily || 30) * 12,
        deposit,
        i18n: (i18n ?? null) as never,
        isDemo: false,
        published: members.length > 0,
      },
      update: {
        name: p.name,
        description: p.desc,
        categoryId: bricopackCatId,
        dailyPrice: daily || 30,
        deposit,
        i18n: (i18n ?? null) as never,
        published: members.length > 0,
      },
    });

    await prisma.productLink.deleteMany({ where: { fromId: pack.id, type: 'PACK_ITEM' } });
    for (const m of members) {
      await prisma.productLink.create({
        data: { fromId: pack.id, toId: m.id, type: 'PACK_ITEM', quantity: 1 },
      });
    }
    console.log(`  Pack ${p.slug} : ${members.length} articles, ${daily || 30} €/j`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
