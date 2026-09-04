/**
 * Publie les consommables / accessoires / EPI reliés aux machines pour que les
 * recommandations « Complétez votre location » apparaissent (borne + web + appli).
 *
 * Prix de vente = prix d'achat Cipac HT × 1,4 (marge revente standard), arrondi.
 * Là où aucun prix d'achat n'est connu, on garde le `dailyPrice` déjà saisi.
 * ⚠️ Prix indicatifs — David les ajuste ensuite dans Admin → Produits.
 *
 *   npx tsx scripts/publish-consumables.ts            (local)
 *   node dist/scripts/publish-consumables.js          (conteneur prod)
 *
 * Options : --dry (n'écrit rien) · --undo (repasse en non publié)
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

const MARKUP = 1.4;
const dry = process.argv.includes('--dry');
const undo = process.argv.includes('--undo');

function salePrice(listHT: number | null, current: number): number {
  if (listHT && listHT > 0) return Math.max(2, Math.round(listHT * MARKUP));
  return current > 0 ? current : 5;
}

async function main() {
  const rows = await prisma.product.findMany({
    where: { kind: { in: ['CONSUMABLE', 'ACCESSORY', 'PPE'] } },
    select: {
      id: true,
      name: true,
      kind: true,
      slug: true,
      published: true,
      dailyPrice: true,
      supplierListPrice: true,
      stockQty: true,
    },
  });

  // On ne publie que ceux réellement reliés à au moins une machine.
  const linked = new Set(
    (
      await prisma.productLink.findMany({
        where: { toId: { in: rows.map((r) => r.id) } },
        select: { toId: true },
      })
    ).map((l) => l.toId),
  );

  let changed = 0;
  for (const r of rows) {
    if (undo) {
      if (r.published) {
        if (!dry) await prisma.product.update({ where: { id: r.id }, data: { published: false } });
        changed++;
        console.log(`  ✗ dépublié  ${r.name}`);
      }
      continue;
    }
    if (!linked.has(r.id)) continue;
    const price = salePrice(r.supplierListPrice, r.dailyPrice);
    // Consommable = pièce achetée à la demande chez Cipac → stock "infini".
    const stock = r.kind === 'ACCESSORY' ? r.stockQty : (r.stockQty ?? 100);
    const needs = !r.published || r.dailyPrice !== price || r.stockQty !== stock;
    if (!needs) continue;
    if (!dry) {
      await prisma.product.update({
        where: { id: r.id },
        data: {
          published: true,
          dailyPrice: price,
          isConsumable: r.kind !== 'ACCESSORY',
          ...(r.kind !== 'ACCESSORY'
            ? { stockQty: stock, availabilityMode: 'INSTANT' }
            : {}),
        },
      });
    }
    changed++;
    console.log(`  ✓ ${r.kind.padEnd(9)} ${String(price).padStart(4)} €  ${r.name}`);
  }

  console.log(`${dry ? '[dry] ' : ''}${changed} produit(s) ${undo ? 'dépubliés' : 'publiés / repricés'}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
