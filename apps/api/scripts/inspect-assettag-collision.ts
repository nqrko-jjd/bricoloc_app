/** Diagnostic ponctuel : quel produit possède déjà cet assetTag ? */
import '../src/env.js';
import { prisma } from '../src/db.js';

const tags = process.argv.slice(2).filter((a) => !a.startsWith('--'));

async function main() {
  for (const tag of tags) {
    const unit = await prisma.productUnit.findUnique({
      where: { assetTag: tag },
      include: { product: { select: { id: true, slug: true, name: true, internalRef: true, supplierRef: true, technical: true, parentProductId: true } } },
    });
    console.log(tag, '->', unit ? JSON.stringify(unit.product) : 'introuvable');
  }
  await prisma.$disconnect();
}
main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
