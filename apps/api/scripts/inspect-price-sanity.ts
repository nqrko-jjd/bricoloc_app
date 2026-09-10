/** Diagnostic ponctuel : vérifie qu'aucun prix n'est aberrant (import CSV
 * corrompu appliqué par erreur — virgule/point décimal disparu). */
import '../src/env.js';
import { prisma } from '../src/db.js';

async function main() {
  const rows = await prisma.product.findMany({
    where: { dailyPrice: { gt: 1000 } },
    select: { slug: true, name: true, kind: true, dailyPrice: true, weekPrice: true, monthPrice: true },
    orderBy: { dailyPrice: 'desc' },
    take: 20,
  });
  if (rows.length === 0) {
    console.log('Aucun prix aberrant (>1000/jour) — rien n’a été appliqué.');
  } else {
    for (const r of rows) console.log(`  ⚠ ${r.slug} (${r.kind}) : ${r.dailyPrice}/j`);
  }
  const sample = await prisma.product.findUnique({
    where: { slug: 'adapter-prises-cablage' },
    select: { dailyPrice: true, weekPrice: true, monthPrice: true },
  });
  console.log('adapter-prises-cablage (référence) :', sample);
  await prisma.$disconnect();
}
main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
