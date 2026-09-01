/**
 * Avis clients : dépôt anonyme → modération → publication → note agrégée.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

let server: Server;
let base: string;
let slug: string;
const created: string[] = [];

async function api(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  await new Promise<void>((r) => {
    server = createApp().listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      r();
    });
  });
  const p = await prisma.product.findFirst({ where: { published: true, kind: 'MACHINE' } });
  slug = p!.slug;
});

after(async () => {
  await prisma.review.deleteMany({ where: { id: { in: created } } });
  server.close();
});

test('avis anonyme → mis en modération, absent du public', async () => {
  const res = await api('/api/reviews', {
    method: 'POST',
    body: { productSlug: slug, rating: 5, title: 'Test', body: 'Excellent matériel de test, rien à redire.', authorName: 'Testeur T.' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'PENDING');

  const row = await prisma.review.findFirst({ where: { authorName: 'Testeur T.', status: 'PENDING' } });
  assert.ok(row);
  created.push(row!.id);

  const pub = await api(`/api/products/${slug}/reviews`);
  assert.ok(!pub.body.reviews.some((r: { title: string }) => r.title === 'Test'));
});

test('staff publie l’avis → visible + compté dans la moyenne', async () => {
  const login = await api('/api/auth/staff/login', {
    method: 'POST',
    body: { email: 'admin@bricoloc.example', password: 'bricoloc' },
  });
  const token = login.body.token as string;
  const id = created[0]!;

  const mod = await api(`/api/admin/reviews/${id}`, {
    method: 'PATCH',
    token,
    body: { status: 'PUBLISHED', reply: 'Merci pour votre retour !' },
  });
  assert.equal(mod.status, 200);
  assert.equal(mod.body.review.status, 'PUBLISHED');

  const pub = await api(`/api/products/${slug}/reviews`);
  const mine = pub.body.reviews.find((r: { title: string }) => r.title === 'Test');
  assert.ok(mine, 'avis publié visible');
  assert.equal(mine.reply, 'Merci pour votre retour !');
  assert.ok(pub.body.summary.count >= 1);
  assert.ok(pub.body.summary.avg > 0);

  const detail = await api(`/api/catalog/products/${slug}`);
  assert.ok(detail.body.product.rating.count >= 1);
});
