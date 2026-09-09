/**
 * Inspection ponctuelle : pour chaque fiche produit (kind=MACHINE, non
 * technical), combien de machines rattachées (variants) et combien
 * d'exemplaires (ProductUnit) directement sur la fiche elle-même ?
 * Sert à diagnostiquer pourquoi des fiches produits apparaissent encore
 * dans Admin -> Stock & exemplaires après le filtre variants.length>0.
 *
 *   npx tsx scripts/inspect-fiche-produit-stock.ts
 */
import '../src/env.js';
import { prisma } from '../src/db.js';

async function main() {
  const rows = await prisma.product.findMany({
    where: { kind: 'MACHINE', technical: false, published: true },
    select: {
      slug: true,
      name: true,
      variants: { select: { id: true } },
      units: { select: { id: true } },
    },
    orderBy: { name: 'asc' },
  });

  let withVariants = 0;
  let withOwnUnits = 0;
  let withBoth = 0;
  let withNeither = 0;

  for (const p of rows) {
    const v = p.variants.length;
    const u = p.units.length;
    if (v > 0) withVariants++;
    if (u > 0) withOwnUnits++;
    if (v > 0 && u > 0) withBoth++;
    if (v === 0 && u === 0) withNeither++;
    if (v > 0 || u > 0) {
      console.log(`  ${p.name} (${p.slug}) : ${v} machine(s) rattachée(s), ${u} exemplaire(s) propre(s)`);
    }
  }

  console.log(
    `\n${rows.length} fiches produits publiées au total.\n` +
      `${withVariants} avec machine(s) rattachée(s) · ${withOwnUnits} avec exemplaire(s) propre(s) · ` +
      `${withBoth} avec les deux · ${withNeither} avec ni l'un ni l'autre (0 stock).`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
