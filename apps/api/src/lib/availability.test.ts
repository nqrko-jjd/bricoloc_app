import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../db.js';
import { newQrToken } from './qr.js';
import { availabilityFor, resolveUnitProductIds } from './availability.js';

/**
 * Fiche vitrine + fiches techniques rattachées : le client réserve la
 * vitrine, mais les exemplaires vivent sur les fiches techniques (marque
 * précise). La dispo de la vitrine doit agréger les exemplaires des deux
 * fiches techniques.
 */
test('availabilityFor : agrège le stock des fiches techniques rattachées', async () => {
  const stamp = Date.now();
  const vitrine = await prisma.product.create({
    data: {
      slug: `test-vitrine-${stamp}`,
      name: 'Ponceuse girafe (test)',
      kind: 'MACHINE',
      dailyPrice: 20,
      deposit: 50,
      isDemo: true,
      published: true,
    },
  });
  const makita = await prisma.product.create({
    data: {
      slug: `test-variant-makita-${stamp}`,
      name: 'Makita 9741S (test)',
      kind: 'MACHINE',
      brand: 'Makita',
      dailyPrice: 20,
      deposit: 50,
      isDemo: true,
      published: false,
      parentProductId: vitrine.id,
    },
  });
  const festool = await prisma.product.create({
    data: {
      slug: `test-variant-festool-${stamp}`,
      name: 'Festool Planex (test)',
      kind: 'MACHINE',
      brand: 'Festool',
      dailyPrice: 20,
      deposit: 50,
      isDemo: true,
      published: false,
      parentProductId: vitrine.id,
    },
  });

  // 2 exemplaires Makita + 1 Festool, aucun sur la vitrine elle-même.
  await prisma.productUnit.createMany({
    data: [
      { productId: makita.id, assetTag: `TU-${stamp}-1`, qrToken: newQrToken('U'), state: 'AVAILABLE' },
      { productId: makita.id, assetTag: `TU-${stamp}-2`, qrToken: newQrToken('U'), state: 'AVAILABLE' },
      { productId: festool.id, assetTag: `TU-${stamp}-3`, qrToken: newQrToken('U'), state: 'AVAILABLE' },
    ],
  });

  after(async () => {
    await prisma.productUnit.deleteMany({ where: { productId: { in: [makita.id, festool.id] } } });
    await prisma.product.deleteMany({ where: { id: { in: [makita.id, festool.id, vitrine.id] } } });
  });

  const ids = await resolveUnitProductIds(vitrine.id);
  assert.deepEqual(new Set(ids), new Set([vitrine.id, makita.id, festool.id]));

  const start = new Date(Date.now() + 3 * 86_400_000);
  const end = new Date(start.getTime() + 86_400_000);
  const a = await availabilityFor(vitrine.id, start, end, 3);
  assert.equal(a.totalUnits, 3, 'stock de la vitrine = somme des 2 fiches techniques');
  assert.equal(a.availableQty, 3);
  assert.equal(a.status, 'AVAILABLE');

  // Un produit sans fiche technique se comporte exactement comme avant.
  const soloIds = await resolveUnitProductIds(makita.id);
  assert.deepEqual(soloIds, [makita.id]);
});
