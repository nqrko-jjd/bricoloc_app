/**
 * Bascule les machines (kind=MACHINE) de l'ancien schéma « un seul
 * fournisseur » (supplierRef confondu avec la réf. interne, partSupplier/
 * supplierUrl/supplierListPrice/purchasePrice = un seul fournisseur) vers le
 * nouveau : `internalRef` (notre réf., ex. O-0042) + `suppliers[]` (plusieurs
 * fournisseurs possibles, chacun sa réf./lien/prix).
 *
 * - supplierRef -> internalRef (c'est déjà ce qu'il contenait : le code parc)
 * - partSupplier/supplierUrl/supplierListPrice/purchasePrice, si l'un est
 *   rempli -> un premier élément de suppliers[] (rien n'est perdu)
 * Les anciens champs scalaires sont vidés après recopie (remplacés par les
 * nouveaux). Sans effet sur accessoires/consommables/EPI (schéma inchangé).
 *
 *   npx tsx scripts/migrate-machine-supplier-fields.ts --dry   # rapport
 *   npx tsx scripts/migrate-machine-supplier-fields.ts         # applique
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

const DRY = process.argv.includes('--dry');

async function main() {
  const rows = await prisma.product.findMany({
    where: {
      kind: 'MACHINE',
      OR: [
        { supplierRef: { not: null } },
        { partSupplier: { not: null } },
        { supplierUrl: { not: null } },
        { supplierListPrice: { not: null } },
        { purchasePrice: { not: null } },
      ],
    },
    select: {
      id: true, slug: true, name: true, supplierRef: true,
      partSupplier: true, supplierUrl: true, supplierListPrice: true, purchasePrice: true,
    },
  });

  if (rows.length === 0) {
    console.log('Rien à migrer.');
    await prisma.$disconnect();
    return;
  }

  for (const p of rows) {
    const suppliers = [];
    if (p.partSupplier || p.supplierUrl || p.supplierListPrice != null || p.purchasePrice != null) {
      suppliers.push({
        name: p.partSupplier ?? '',
        ref: '',
        url: p.supplierUrl ?? '',
        listPrice: p.supplierListPrice ?? null,
        purchasePrice: p.purchasePrice ?? null,
      });
    }
    console.log(
      `  → ${p.name} (${p.slug}) : internalRef="${p.supplierRef ?? ''}"` +
        (suppliers.length ? `  fournisseur="${suppliers[0].name}" prix=${suppliers[0].purchasePrice ?? ''}` : ''),
    );
    if (!DRY) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          internalRef: p.supplierRef,
          suppliers: suppliers as never,
          supplierRef: null,
          partSupplier: null,
          supplierUrl: null,
          supplierListPrice: null,
          purchasePrice: null,
        },
      });
    }
  }

  console.log(`\n${DRY ? '[DRY RUN — rien écrit]  ' : ''}${rows.length} machine(s) migrée(s).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
