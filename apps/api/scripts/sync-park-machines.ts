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
 * Complète aussi les exemplaires manquants sur une machine déjà en base pour
 * un code du fichier (ex. run précédent interrompu en cours de route) —
 * idempotent, sûr à relancer.
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

/** assetTag = code du parc si libre (cas normal) ; sinon désambiguïsé — un
 * exemplaire porte parfois déjà ce tag pour une autre raison (saisie manuelle,
 * lot précédent). */
async function uniqueAssetTag(base: string): Promise<string> {
  if (!(await prisma.productUnit.findUnique({ where: { assetTag: base } }))) return base;
  for (let i = 2; ; i++) {
    const cand = `${base}-b${i}`;
    if (!(await prisma.productUnit.findUnique({ where: { assetTag: cand } }))) return cand;
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
  const failed: { code: string; error: string }[] = [];

  for (const item of park.machines) {
    if (known.has(item.code)) continue;
    const slug = await uniqueSlug(norm(item.name));
    const qty = Math.max(1, item.exemplaires || 1);
    console.log(`  + ${item.code}  ${item.name}  (${qty} exemplaire${qty > 1 ? 's' : ''})  → ${slug}`);
    if (!DRY) {
      try {
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
        for (let i = 0; i < qty; i++) {
          const base = qty > 1 ? `${item.code}-${i + 1}` : item.code;
          const assetTag = await uniqueAssetTag(base);
          await prisma.productUnit.create({
            data: { productId: product.id, assetTag, qrToken: newQrToken('U'), state: 'AVAILABLE' },
          });
          unitsCreated++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
        failed.push({ code: item.code, error: msg });
        console.log(`    ! échec : ${msg}`);
        continue;
      }
    }
    created++;
  }

  // Complète les exemplaires manquants sur une machine déjà en base pour un
  // code du fichier (ex. produit créé mais unités échouées lors d'un run
  // précédent).
  const machinesForTopUp = await prisma.product.findMany({
    where: { internalRef: { in: park.machines.map((m) => m.code) } },
    select: { id: true, internalRef: true, name: true, units: { select: { id: true } } },
  });
  let toppedUp = 0;
  for (const p of machinesForTopUp) {
    const item = park.machines.find((m) => m.code === p.internalRef);
    if (!item) continue;
    const qty = Math.max(1, item.exemplaires || 1);
    const missing = qty - p.units.length;
    if (missing <= 0) continue;
    console.log(`  ~ ${p.internalRef} « ${p.name} » : ${p.units.length}/${qty} exemplaire(s) — ${missing} à ajouter`);
    if (!DRY) {
      for (let i = 0; i < missing; i++) {
        const base = qty > 1 ? `${p.internalRef}-${p.units.length + i + 1}` : p.internalRef!;
        const assetTag = await uniqueAssetTag(base);
        await prisma.productUnit.create({
          data: { productId: p.id, assetTag, qrToken: newQrToken('U'), state: 'AVAILABLE' },
        });
      }
    }
    toppedUp += missing;
  }

  console.log(
    `\n${DRY ? '[DRY RUN — rien écrit]  ' : ''}${created} machine(s) créée(s) sur ${park.machines.length} code(s) de la liste` +
      ` (${park.machines.length - created} déjà en base) · ${unitsCreated} exemplaire(s) créé(s)` +
      (toppedUp ? ` · ${toppedUp} exemplaire(s) complété(s) sur des machines déjà en base` : '') +
      '.',
  );
  if (failed.length) {
    console.log(`\n⚠️  ${failed.length} échec(s) : ${failed.map((f) => `${f.code} (${f.error})`).join(' · ')}`);
  }
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
