/**
 * Attache des images (fichiers locaux) aux consommables.
 *   node --import tsx scripts/attach-consumable-images.mjs <dossier>
 * Chaque fichier <slug>.(png|jpg|webp) est redimensionné (storeImage) et
 * défini comme image principale du produit dont le slug correspond.
 * Ne touche pas aux produits déjà pourvus d'une image, sauf --force.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import '../src/env.js';
import { prisma } from '../src/db.js';
import { storeImage } from '../src/lib/media.js';

const dir = process.argv[2];
const force = process.argv.includes('--force');
if (!dir) {
  console.error('Usage: node --import tsx scripts/attach-consumable-images.mjs <dossier> [--force]');
  process.exit(1);
}

const files = (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
let done = 0;
let skipped = 0;

for (const f of files) {
  const slug = f.replace(/\.(png|jpe?g|webp)$/i, '');
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) {
    console.warn(`⚠ pas de produit pour « ${slug} »`);
    continue;
  }
  const current = (product.images ?? []);
  if (Array.isArray(current) && current.length > 0 && !force) {
    skipped++;
    continue;
  }
  const buffer = await readFile(path.join(dir, f));
  const stored = await storeImage({ buffer, originalname: f }, { source: 'manufacturer' });
  await prisma.product.update({
    where: { id: product.id },
    data: { images: [stored.url] },
  });
  console.log(`✓ ${slug} ← ${stored.url}`);
  done++;
}

console.log(`\n${done} image(s) attachée(s), ${skipped} déjà pourvu(s).`);
await prisma.$disconnect();
