import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativizeMedia } from './media-url.js';

test('relativizeMedia : URL upload absolue -> chemin relatif', () => {
  assert.equal(
    relativizeMedia('http://localhost:4000/uploads/media/2026/09/x.webp'),
    '/uploads/media/2026/09/x.webp',
  );
  assert.equal(
    relativizeMedia('https://api.bricoloc.be/uploads/media/2026/09/y.thumb.webp'),
    '/uploads/media/2026/09/y.thumb.webp',
  );
});

test('relativizeMedia : laisse les autres valeurs intactes', () => {
  assert.equal(relativizeMedia('/uploads/media/x.webp'), '/uploads/media/x.webp');
  assert.equal(relativizeMedia('https://placehold.co/600x400.png'), 'https://placehold.co/600x400.png');
  assert.equal(relativizeMedia('data:image/svg+xml;utf8,<svg/>'), 'data:image/svg+xml;utf8,<svg/>');
  assert.equal(relativizeMedia(42), 42);
  assert.equal(relativizeMedia(null), null);
});

test('relativizeMedia : traverse objets et tableaux imbriqués', () => {
  const input = {
    image: 'http://localhost:4000/uploads/media/a.webp',
    images: ['http://localhost:4000/uploads/media/a.webp', 'http://localhost:4000/uploads/media/b.webp'],
    nested: { accessory: { image: 'http://192.168.1.27:4000/uploads/media/c.webp' } },
    price: 40,
  };
  assert.deepEqual(relativizeMedia(input), {
    image: '/uploads/media/a.webp',
    images: ['/uploads/media/a.webp', '/uploads/media/b.webp'],
    nested: { accessory: { image: '/uploads/media/c.webp' } },
    price: 40,
  });
});
