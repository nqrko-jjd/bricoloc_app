/**
 * Ajoute au catalogue les ACCESSOIRES / CONSOMMABLES / EPI du parc réel
 * (liste « Gestion Stock - Machines (2) », `data/park-machines-2026-09.json`).
 *
 * Décision David (sept. 2026) : les machines seront rapprochées plus tard sur
 * une nouvelle liste ; pour l'instant on ne traite QUE le non-machine, pour
 * qu'il n'apparaisse jamais mélangé aux machines (« ce que louent nos clients »).
 *
 *   npx tsx scripts/import-park-accessories.ts --dry   # rapport, rien écrit
 *   npx tsx scripts/import-park-accessories.ts         # applique
 *   npx tsx scripts/import-park-accessories.ts --undo  # supprime ce qui a été créé
 *
 * Deux volets :
 *  • CRÉER  → produits en brouillon (published:false, dailyPrice:0), kind correct,
 *    `supplierRef` = code O-XXXX. David complète prix/photo/catégorie ensuite.
 *  • RECLASSER → codes déjà importés en kind MACHINE mais qui sont en fait des
 *    accessoires (rails, chargeurs, sets) : on bascule juste `kind`.
 *
 * Idempotent : relancer ne recrée pas (clé = supplierRef).
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

const DRY = process.argv.includes('--dry');
const UNDO = process.argv.includes('--undo');

/** À créer : code → { name, kind, category? } */
const CREATE: { code: string; name: string; kind: 'ACCESSORY' | 'CONSUMABLE' | 'PPE'; cat?: string }[] = [
  { code: 'O-0017', name: 'Rail de guidage Eibenstock 1,5 m', kind: 'ACCESSORY', cat: 'beton-pierre' },
  { code: 'O-0038', name: 'Chariot Makpac (trolley)', kind: 'ACCESSORY' },
  { code: 'O-0087', name: 'Harnais de sécurité Securx', kind: 'PPE', cat: 'echelles-echafaudages' },
  { code: 'O-0095', name: 'Règle de coupe pour papier peint Superkante', kind: 'ACCESSORY', cat: 'peintures-finitions' },
  { code: 'O-0108', name: 'Foret diamant Ø 90 mm', kind: 'CONSUMABLE', cat: 'beton-pierre' },
  { code: 'O-0151', name: 'Batterie Makita 18 V BL1850B (5,0 Ah)', kind: 'ACCESSORY' },
  { code: 'O-0152', name: 'Batterie Makita 40 V BL8060B (6,0 Ah)', kind: 'ACCESSORY' },
  { code: 'O-0194', name: 'Coffret de douilles Mitools (30 pièces)', kind: 'ACCESSORY' },
  { code: 'O-0195', name: 'Coffret de douilles Proxxon (27 pièces)', kind: 'ACCESSORY' },
  { code: 'O-0205', name: 'Chargeur rapide Milwaukee M12-M18', kind: 'ACCESSORY' },
  { code: 'O-0206', name: 'Batterie Milwaukee M18 (5,0 Ah)', kind: 'ACCESSORY' },
  { code: 'O-0207', name: 'Batterie Milwaukee M12 (2,0 Ah)', kind: 'ACCESSORY' },
];

/** Déjà en base (kind MACHINE) mais ce sont des accessoires/consommables : code → nouveau kind. */
const RECLASS: { code: string; kind: 'ACCESSORY' | 'CONSUMABLE' }[] = [
  { code: 'O-0032', kind: 'ACCESSORY' }, // MAFFEL RAIL 30M (pour MT55CC)
  { code: 'O-0163', kind: 'ACCESSORY' }, // REMS EVA SET 520015 (jeu de segments cintreuse)
  { code: 'O-0169', kind: 'CONSUMABLE' }, // SET SCIE CLOCHE BLU9599
  { code: 'O-0172', kind: 'ACCESSORY' }, // RAIL MAKITA 3M
  { code: 'O-0173', kind: 'ACCESSORY' }, // CHARGEUR MAKITA DC18RC
];

const BRANDS = ['Makita', 'Milwaukee', 'Eibenstock', 'Proxxon', 'Mitools', 'Securx', 'Superkante', 'Mafell', 'Rems'];
function brandOf(name: string): string | null {
  const low = name.toLowerCase();
  return BRANDS.find((b) => low.includes(b.toLowerCase())) ?? null;
}
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

async function uniqueSlug(base: string): Promise<string> {
  for (let i = 0; ; i++) {
    const cand = i ? `${base}-${i + 1}` : base || 'accessoire';
    if (!(await prisma.product.findUnique({ where: { slug: cand } }))) return cand;
  }
}

async function undo() {
  const codes = CREATE.map((c) => c.code);
  const prods = await prisma.product.findMany({
    where: { supplierRef: { in: codes }, published: false, dailyPrice: 0, kind: { in: ['ACCESSORY', 'CONSUMABLE', 'PPE'] } },
    include: { _count: { select: { reservationItems: true, cartItems: true } } },
  });
  let del = 0;
  for (const p of prods) {
    if (p._count.reservationItems || p._count.cartItems) {
      console.log(`  ! ${p.slug} — utilisé, conservé`);
      continue;
    }
    if (!DRY) await prisma.product.delete({ where: { id: p.id } });
    del++;
  }
  console.log(`${DRY ? '[DRY] ' : ''}Annulé : ${del} produit(s).`);
}

async function run() {
  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  let created = 0;
  let skipped = 0;
  for (const item of CREATE) {
    const existing = await prisma.product.findFirst({ where: { supplierRef: item.code } });
    if (existing) {
      // déjà là (peut-être en kind MACHINE) — on n'écrase pas un produit déjà travaillé,
      // on signale seulement.
      skipped++;
      console.log(`  = ${item.code} déjà en base : « ${existing.name} » (kind ${existing.kind}, ${existing.published ? 'publié' : 'brouillon'})`);
      continue;
    }
    const slug = await uniqueSlug(norm(item.name));
    if (!DRY) {
      await prisma.product.create({
        data: {
          slug,
          name: item.name,
          kind: item.kind,
          brand: brandOf(item.name),
          supplier: 'BRICOLOC',
          supplierRef: item.code,
          categoryId: item.cat ? catId[item.cat] ?? null : null,
          dailyPrice: 0,
          deposit: 0,
          isConsumable: item.kind === 'CONSUMABLE',
          availabilityMode: 'INSTANT',
          deliveryPolicy: 'STANDARD',
          isDemo: false,
          published: false,
        },
      });
    }
    created++;
    console.log(`  + ${item.code}  ${item.kind.padEnd(10)} ${slug}`);
  }

  let reclassed = 0;
  const reclassMissing: string[] = [];
  for (const r of RECLASS) {
    const p = await prisma.product.findFirst({ where: { supplierRef: r.code } });
    if (!p) {
      reclassMissing.push(r.code);
      continue;
    }
    if (p.kind === r.kind) continue;
    if (!DRY) {
      await prisma.product.update({
        where: { id: p.id },
        data: { kind: r.kind, isConsumable: r.kind === 'CONSUMABLE' ? true : p.isConsumable },
      });
    }
    reclassed++;
    console.log(`  ~ ${r.code}  ${p.kind} → ${r.kind}  (« ${p.name} »)`);
  }

  console.log(`\n${DRY ? '[DRY RUN — rien écrit]  ' : ''}Créés : ${created} · déjà présents : ${skipped} · reclassés : ${reclassed}`);
  if (reclassMissing.length) console.log(`⚠️  codes à reclasser introuvables : ${reclassMissing.join(', ')}`);
  console.log(`\nÀ compléter en admin (produits → brouillons) : prix, photo, catégorie, puis publier.`);
}

// Pas d'exemplaire (ProductUnit) créé ici : les accessoires ne sont pas suivis
// à l'unité par défaut (capacité via stockQty, à définir en admin).

(UNDO ? undo() : run())
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
