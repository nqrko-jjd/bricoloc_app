/**
 * Lot 4 : éditeur de réservation + maintenance qui bloque la disponibilité.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

let server: Server;
let base: string;
let token: string;
const cleanup: (() => Promise<unknown>)[] = [];

async function api(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const txt = await res.text();
  return { status: res.status, body: txt ? JSON.parse(txt) : null };
}

before(async () => {
  await new Promise<void>((r) => {
    server = createApp().listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      r();
    });
  });
  token = (
    await api('/api/auth/staff/login', {
      method: 'POST',
      body: { email: 'admin@bricoloc.example', password: 'bricoloc' },
    })
  ).body.token;
});

after(async () => {
  for (const fn of cleanup.reverse()) await fn().catch(() => {});
  server.close();
});

test('éditeur de réservation : ajout de ligne → totaux recalculés', async () => {
  // machine
  const p = await api('/api/admin/products', {
    method: 'POST',
    token,
    body: { slug: `edit-${Date.now()}`, name: 'Machine édit', kind: 'MACHINE', dailyPrice: 50, deposit: 200 },
  });
  const productId = p.body.product.id as string;
  cleanup.push(() => prisma.product.delete({ where: { id: productId } }));
  await api('/api/admin/units', {
    method: 'POST',
    token,
    body: { productId, assetTag: `EDIT-${Date.now()}` },
  });

  // réservation directe en base (DRAFT)
  const now = Date.now();
  const r = await prisma.reservation.create({
    data: {
      number: `R-EDIT-${now}`,
      qrToken: `qr-edit-${now}`,
      status: 'DRAFT',
      periodStart: new Date(now + 2 * 86400000),
      periodEnd: new Date(now + 5 * 86400000),
      totals: {},
    },
  });
  cleanup.push(() => prisma.reservation.delete({ where: { id: r.id } }));

  const add = await api(`/api/admin/reservations/${r.id}/items`, {
    method: 'POST',
    token,
    body: { productId, quantity: 2 },
  });
  assert.equal(add.status, 201);

  const detail = await api(`/api/admin/reservations/${r.id}`, { token });
  assert.equal(detail.body.reservation.items.length, 1);
  assert.equal(detail.body.reservation.items[0].quantity, 2);
  assert.ok(detail.body.reservation.totals.rentalHT > 0, 'totaux recalculés');
  assert.ok(detail.body.reservation.totals.depositsTotal >= 400);
});

test('maintenance planifiée retire l’exemplaire des disponibilités', async () => {
  const slug = `maint-${Date.now()}`;
  const p = await api('/api/admin/products', {
    method: 'POST',
    token,
    body: { slug, name: 'Machine maintenance', kind: 'MACHINE', dailyPrice: 30, deposit: 150 },
  });
  const productId = p.body.product.id as string;
  cleanup.push(() => prisma.product.delete({ where: { id: productId } }));
  const u = await api('/api/admin/units', {
    method: 'POST',
    token,
    body: { productId, assetTag: `MAINT-${Date.now()}` },
  });
  const unitId = u.body.unit.id as string;

  const start = new Date();
  const end = new Date(Date.now() + 10 * 86400000);

  // dispo AVANT : 1
  const before1 = await api(
    `/api/availability/check`,
    {
      method: 'POST',
      body: {
        period: { start: start.toISOString(), end: new Date(Date.now() + 3 * 86400000).toISOString() },
        items: [{ productId, quantity: 1 }],
      },
    },
  );
  assert.equal(before1.body.results[0].availableQty, 1);

  await api(`/api/admin/units/${unitId}/maintenance`, {
    method: 'POST',
    token,
    body: {
      type: 'REPARATION',
      description: 'Test',
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      blocksAvailability: true,
    },
  });

  const after1 = await api(`/api/availability/check`, {
    method: 'POST',
    body: {
      period: { start: start.toISOString(), end: new Date(Date.now() + 3 * 86400000).toISOString() },
      items: [{ productId, quantity: 1 }],
    },
  });
  assert.equal(after1.body.results[0].availableQty, 0, 'exemplaire immobilisé → 0 dispo');
});
