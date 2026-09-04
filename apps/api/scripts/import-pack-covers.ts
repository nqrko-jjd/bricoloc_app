/**
 * Affecte une image de garde à chaque BricoPack à partir d'un dossier d'images
 * dont le nom de fichier reprend le slug (ou le nom) du pack.
 *
 *   npx tsx scripts/import-pack-covers.ts [--dir uploads] [--dry]
 *   node dist/scripts/import-pack-covers.js --dir /repo/apps/api/uploads   (prod)
 *
 * Chaque image est convertie en WebP + vignette (storeImage) et placée en 1re
 * position des `images` du produit PACK correspondant.
 */
import '../src/env.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/db.js';
import { storeImage } from '../src/lib/media.js';

const dryIdx = process.argv.indexOf('--dry');
const dry = dryIdx !== -1;
const dirIdx = process.argv.indexOf('--dir');
const DIR = dirIdx !== -1 ? process.argv[dirIdx + 1]! : 'uploads';

const IMG_RE = /\.(jpe?g|png|webp)$/i;

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreMatch(fileBase: string, pack: { slug: string; name: string }): number {
  const f = norm(fileBase);
  const slugN = norm(pack.slug.replace(/-/g, ' '));
  const nameN = norm(pack.name);
  if (f === slugN || f === nameN) return 100;
  const fTok = new Set(f.split(' ').filter(Boolean));
  const pTok = new Set([...slugN.split(' '), ...nameN.split(' ')].filter(Boolean));
  // On ignore les mots outils fréquents pour ne pas sur-matcher.
  for (const stop of ['un', 'une', 'des', 'de', 'du', 'la', 'le', 'les', 'a']) {
    fTok.delete(stop);
    pTok.delete(stop);
  }
  let hit = 0;
  for (const tk of fTok) if (pTok.has(tk)) hit++;
  const ratio = fTok.size ? hit / fTok.size : 0;
  // Il faut au moins 2 mots significatifs en commun (ou 1 si le fichier n'en a qu'un).
  if (hit < Math.min(2, fTok.size)) return ratio * 40;
  return 60 + ratio * 40;
}

async function main() {
  const packs = await prisma.product.findMany({
    where: { kind: 'PACK', published: true },
    select: { id: true, slug: true, name: true, images: true },
  });

  const entries = (await readdir(DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && IMG_RE.test(e.name))
    .map((e) => e.name);

  // Toutes les correspondances plausibles, triées par score : la meilleure gagne.
  const cands: { file: string; packId: string; score: number }[] = [];
  for (const file of entries) {
    const base = file.replace(IMG_RE, '');
    for (const pack of packs) {
      const score = scoreMatch(base, pack);
      if (score >= 65) cands.push({ file, packId: pack.id, score });
    }
  }
  cands.sort((a, b) => b.score - a.score);

  const packById = new Map(packs.map((p) => [p.id, p]));
  const usedPack = new Set<string>();
  const usedFile = new Set<string>();
  const chosen: { file: string; packId: string; score: number }[] = [];
  for (const c of cands) {
    if (usedPack.has(c.packId) || usedFile.has(c.file)) continue;
    usedPack.add(c.packId);
    usedFile.add(c.file);
    chosen.push(c);
  }

  let assigned = 0;
  for (const c of chosen) {
    const pack = packById.get(c.packId)!;
    console.log(`  ${c.file}  →  ${pack.name}  (${Math.round(c.score)})`);
    if (dry) {
      assigned++;
      continue;
    }
    const buffer = await readFile(path.join(DIR, c.file));
    const stored = await storeImage(
      { buffer, originalname: c.file, mimetype: 'image/jpeg' },
      { source: 'bricopack-cover' },
    );
    const cur = Array.isArray(pack.images) ? (pack.images as string[]) : [];
    await prisma.product.update({
      where: { id: pack.id },
      data: { images: [stored.url, ...cur.filter((u) => u !== stored.url)].slice(0, 12) as never },
    });
    assigned++;
  }
  const used = usedPack;
  const unmatched = entries.filter((f) => !usedFile.has(f));

  console.log(`\n${dry ? '[dry] ' : ''}${assigned} pack(s) avec image de garde.`);
  if (unmatched.length) {
    console.log(`\nNon rapprochés (${unmatched.length}) :`);
    unmatched.forEach((f) => console.log(`  ${f}`));
  }
  const without = packs.filter((p) => !used.has(p.id));
  if (without.length && !dry) {
    console.log(`\nPacks encore sans visuel dédié (${without.length}) :`);
    without.forEach((p) => console.log(`  ${p.slug}`));
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
