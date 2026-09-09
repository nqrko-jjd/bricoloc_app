/**
 * Recharge la liste définitive du parc (« Gestion Stock - Machines (2).xlsx »,
 * onglet Inventaire Machines, 210 codes O-XXXX uniques — décision David,
 * 6 sept. 2026 — extraite dans data/park-machines-2026-09.json) et crée les
 * MACHINES manquantes : les codes qui ne correspondent encore à AUCUN produit
 * (ni internalRef sur une machine, ni supplierRef sur un accessoire/
 * consommable/EPI déjà reclassé par import-park-accessories.ts).
 *
 * Les machines créées sont des fiches techniques LIBRES (technical:true,
 * parentProductId:null, published:false, kind:MACHINE, sans marque/modèle) —
 * pas encore rattachées à une fiche produit : le nom brut du parc ne dit pas
 * à quelle vitrine générique chacune correspond, ça reste un rattachement
 * manuel en admin (comme pour les lots précédents). Chaque machine reçoit
 * ses exemplaires (ProductUnit) selon le nombre "exemplaires" du fichier.
 *
 *   npx tsx scripts/sync-park-machines.ts --dry   # rapport, rien écrit
 *   npx tsx scripts/sync-park-machines.ts         # applique
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '../src/env.js';
import { prisma } from '../src/db.js';
import { newQrToken } from '../src/lib/qr.js';

const DRY = process.argv.includes('--dry');

interface ParkEntry {
  code: string;
  name: string;
  exemplaires: number;
}
interface ParkData {
  machines: ParkEntry[];
}

const dataPath = join(process.cwd(), 'scripts/data/park-machines-2026-09.json');
const park = JSON.parse(readFileSync(dataPath, 'utf8')) as ParkData;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

async function uniqueSlug(base: string): Promise<string> {
  for (let i = 0; ; i++) {
    const cand = i ? `${base}-${i + 1}` : base || 'machine';
    if (!(await prisma.product.findUnique({ where: { slug: cand } }))) return cand;
  }
}

async function main() {
  const existing = await prisma.product.findMany({
    where: { OR: [{ internalRef: { not: null } }, { supplierRef: { not: null } }] },
    select: { internalRef: true, supplierRef: true },
  });
  const known = new Set<string>();
  for (const p of existing) {
    if (p.internalRef) known.add(p.internalRef);
    if (p.supplierRef) known.add(p.supplierRef);
  }

  let created = 0;
  let unitsCreated = 0;
  for (const item of park.machines) {
    if (known.has(item.code)) continue;
    const slug = await uniqueSlug(norm(item.name));
    const qty = Math.max(1, item.exemplaires || 1);
    console.log(`  + ${item.code}  ${item.name}  (${qty} exemplaire${qty > 1 ? 's' : ''})  → ${slug}`);
    if (!DRY) {
      const product = await prisma.product.create({
        data: {
          slug,
          name: item.name,
          kind: 'MACHINE',
          technical: true,
          published: false,
          dailyPrice: 0,
          deposit: 0,
          isDemo: false,
          isConsumable: false,
          internalRef: item.code,
          supplier: 'BRICOLOC',
          availabilityMode: 'INSTANT',
          deliveryPolicy: 'STANDARD',
        },
      });
      const units = Array.from({ length: qty }, (_, i) => ({
        productId: product.id,
        assetTag: qty > 1 ? `${item.code}-${i + 1}` : item.code,
        qrToken: newQrToken('U'),
        state: 'AVAILABLE',
      }));
      await prisma.productUnit.createMany({ data: units });
      unitsCreated += units.length;
    }
    created++;
  }

  console.log(
    `\n${DRY ? '[DRY RUN — rien écrit]  ' : ''}${created} machine(s) créée(s) sur ${park.machines.length} code(s) de la liste` +
      ` (${park.machines.length - created} déjà en base) · ${unitsCreated} exemplaire(s) créé(s).`,
  );
  if (created > 0) {
    console.log(
      `\nCréées sans marque/modèle ni fiche produit rattachée — à compléter et rattacher en admin ` +
        `(filtre « Machines », badge « MACHINE (libre) »).`,
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
