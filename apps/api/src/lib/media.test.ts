import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../env.js';
import { prisma } from '../db.js';
import { storeImage } from './media.js';

test('storeImage : convertit en WebP + vignette + MediaAsset', async () => {
  const png = await sharp({
    create: { width: 2000, height: 1200, channels: 3, background: '#EE2C24' },
  })
    .png()
    .toBuffer();

  const stored = await storeImage({ buffer: png, mimetype: 'image/png', originalname: 'test.png' });

  assert.ok(stored.id);
  assert.match(stored.url, /\/uploads\/media\/\d{4}\/\d{2}\/[\w-]+\.webp$/);
  assert.equal(stored.mime, 'image/webp');
  // redimensionné à 1600 px max sur le grand côté
  assert.equal(stored.width, 1600);
  assert.equal(stored.height, 960);

  const main = await readFile(path.join(env.uploadsDir, stored.path));
  assert.equal((await sharp(main).metadata()).format, 'webp');
  const thumb = await readFile(
    path.join(env.uploadsDir, stored.path.replace(/\.webp$/, '.thumb.webp')),
  );
  assert.ok((await sharp(thumb).metadata()).width! <= 400);

  after(async () => {
    await rm(path.join(env.uploadsDir, stored.path)).catch(() => {});
    await rm(path.join(env.uploadsDir, stored.path.replace(/\.webp$/, '.thumb.webp'))).catch(() => {});
    await prisma.mediaAsset.delete({ where: { id: stored.id } }).catch(() => {});
  });
});

test('storeImage : rejette un fichier non-image', async () => {
  await assert.rejects(
    storeImage({ buffer: Buffer.from('pas une image'), originalname: 'x.txt' }),
    /illisible|non support/i,
  );
});
