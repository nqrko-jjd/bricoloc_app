/**
 * Test de bout en bout du CYCLE COMPLET BRICOLOC (exigence section 16).
 * Boot de l'API en memoire sur un port ephemere, puis parcours :
 * admin cree une machine -> visible catalogue -> panier multi-articles ->
 * dates une seule fois -> verif dispo -> retrait/livraison -> compte -> paiement test ->
 * QR -> preparation -> retrait -> location -> retour -> controle -> caution -> facture finale.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

let server: Server;
let base: string;

async function api(
  path: string,
  opts: { method?: string; body?: unknown; token?: string; cartKey?: string } = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.cartKey) headers['x-cart-key'] = opts.cartKey;
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  return { status: res.status, json };
}

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  // Nettoyage : retire tout ce que le test a cree, y compris les dependances,
  // pour ne jamais polluer le catalogue de demonstration.
  try {
    const testProducts = await prisma.product.findMany({
      where: { OR: [{ slug: { startsWith: 'test-' } }, { slug: { startsWith: 'edit-' } }, { slug: { startsWith: 'maint-' } }, { name: { startsWith: 'Machine test' } }] },
      select: { id: true },
    });
    const pids = testProducts.map((p) => p.id);
    const testRes = await prisma.reservation.findMany({
      where: { OR: [{ items: { some: { productId: { in: pids } } } }, { number: { contains: 'E2E' } }, { number: { contains: 'EDIT' } }, { user: { email: { startsWith: 'e2e-' } } }] },
      select: { id: true },
    });
    const rids = testRes.map((r) => r.id);
    await prisma.reservation.deleteMany({ where: { id: { in: rids } } });
    await prisma.cartItem.deleteMany({ where: { productId: { in: pids } } });
    await prisma.review.deleteMany({ where: { productId: { in: pids } } });
    await prisma.productLink.deleteMany({ where: { OR: [{ fromId: { in: pids } }, { toId: { in: pids } }] } });
    await prisma.productUnit.deleteMany({ where: { productId: { in: pids } } });
    await prisma.product.deleteMany({ where: { id: { in: pids } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
  } catch (e) {
    console.warn('[cleanup]', (e as Error).message);
  }
  server?.close();
  await prisma.$disconnect();
});

test('cycle complet : de la creation machine a la facture finale', async () => {
  // 1. Un administrateur se connecte et cree une machine.
  const staffLogin = await api('/api/auth/staff/login', {
    method: 'POST',
    body: { email: 'admin@bricoloc.example', password: 'bricoloc' },
  });
  assert.equal(staffLogin.status, 200);
  const adminToken = staffLogin.json.token as string;

  const slug = `test-machine-${Date.now()}`;
  const created = await api('/api/admin/products', {
    method: 'POST',
    token: adminToken,
    body: {
      slug,
      name: 'Machine de test E2E',
      kind: 'MACHINE',
      categorySlug: 'percage-demolition',
      shortDescription: 'Creee par le test de cycle complet',
      dailyPrice: 30,
      weekendPrice: 45,
      deposit: 200,
      tiers: [
        { minDays: 1, perDay: 30 },
        { minDays: 4, perDay: 24 },
      ],
    },
  });
  assert.equal(created.status, 200);
  const productId = created.json.product.id as string;

  // Ajout de 2 exemplaires physiques.
  for (let i = 1; i <= 2; i++) {
    const u = await api('/api/admin/units', {
      method: 'POST',
      token: adminToken,
      body: { productId, assetTag: `E2E-${Date.now()}-${i}`, serialNumber: `SNE2E${i}` },
    });
    assert.equal(u.status, 200);
  }

  // 2. La machine apparait au catalogue public.
  const catalog = await api(`/api/catalog/products?q=Machine de test E2E`);
  assert.equal(catalog.status, 200);
  assert.ok(catalog.json.products.some((p: { id: string }) => p.id === productId));

  // Une 2e machine existante pour un panier multi-articles.
  const other = await api('/api/catalog/products?category=nettoyage&pageSize=1');
  const otherId = other.json.products[0].id as string;

  // 3. Le client cree un panier et ajoute plusieurs outils (sans dates).
  const cartNew = await api('/api/cart/new', { method: 'POST' });
  const cartKey = cartNew.json.cartKey as string;
  await api('/api/cart/items', { method: 'POST', cartKey, body: { productId, quantity: 2 } });
  await api('/api/cart/items', { method: 'POST', cartKey, body: { productId: otherId, quantity: 1 } });
  const cartWithItems = await api('/api/cart', { cartKey });
  assert.equal(cartWithItems.json.itemCount, 3);

  // 4. Le client saisit ses dates UNE SEULE FOIS (periode globale du panier).
  const start = new Date(Date.now() + 3 * 86400000);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 86400000);
  const period = { start: start.toISOString(), end: end.toISOString() };
  const withPeriod = await api('/api/cart/period', {
    method: 'PUT',
    cartKey,
    body: { period },
  });
  assert.equal(withPeriod.status, 200);
  assert.ok(withPeriod.json.quote, 'un devis doit etre calcule des que la periode est connue');
  assert.equal(withPeriod.json.quote.lines.length, 2);

  // 5. Le systeme verifie TOUTES les disponibilites en une passe.
  const check = await api('/api/availability/check', {
    method: 'POST',
    body: {
      period,
      items: [
        { productId, quantity: 2 },
        { productId: otherId, quantity: 1 },
      ],
    },
  });
  assert.equal(check.status, 200);
  assert.equal(check.json.ok, true);
  assert.equal(check.json.results.length, 2);

  // 6. Retrait (Click & Collect).
  await api('/api/cart/fulfilment', { method: 'PUT', cartKey, body: { mode: 'PICKUP' } });

  // 7. + 8. Le client cree son compte pendant le checkout et paie en mode test.
  const email = `e2e-${Date.now()}@bricoloc.example`;
  const checkout = await api('/api/checkout', {
    method: 'POST',
    cartKey,
    body: {
      period,
      fulfilment: { mode: 'PICKUP' },
      contact: { firstName: 'Eve', lastName: 'End2End', email, phone: '+32470111222' },
      account: { password: 'motdepasse123' },
      acceptTerms: true,
      channel: 'WEB',
    },
  });
  assert.equal(checkout.status, 201, JSON.stringify(checkout.json));
  const reservationId = checkout.json.reservation.id as string;
  const userToken = checkout.json.token as string;
  assert.ok(userToken, 'un token de compte doit etre emis');
  assert.ok(checkout.json.payment.testMode, 'le paiement doit etre en mode demonstration');

  const pay = await api('/api/checkout/pay', {
    method: 'POST',
    token: userToken,
    body: { reservationId, outcome: 'success' },
  });
  assert.equal(pay.status, 200, JSON.stringify(pay.json));
  assert.equal(pay.json.status, 'CONFIRMED');

  // 9. Le client recoit son QR code.
  assert.ok(pay.json.qrToken);
  assert.ok(pay.json.qrDataUrl.startsWith('data:image/png;base64,'));
  assert.ok(pay.json.invoiceNumber, 'facture de reservation emise');

  // La reservation apparait dans l'espace client.
  const mine = await api('/api/reservations', { token: userToken });
  assert.ok(mine.json.reservations.some((r: { id: string }) => r.id === reservationId));

  // Notification de confirmation recue.
  const notifs = await api('/api/account/notifications', { token: userToken });
  assert.ok(
    notifs.json.notifications.some((n: { type: string }) => n.type === 'RESERVATION_CONFIRMED'),
  );

  // 10. L'equipe prepare la commande.
  const prep = await api('/api/auth/staff/login', {
    method: 'POST',
    body: { email: 'preparateur@bricoloc.example', password: 'bricoloc' },
  });
  const prepToken = prep.json.token as string;
  await api(`/api/ops/reservations/${reservationId}/status`, {
    method: 'POST',
    token: prepToken,
    body: { status: 'PREPARING' },
  });
  const ready = await api(`/api/ops/reservations/${reservationId}/status`, {
    method: 'POST',
    token: prepToken,
    body: { status: 'READY' },
  });
  assert.equal(ready.json.reservation.status, 'READY');

  // 11. + 12. Retrait : scan QR, affectation des exemplaires, checklist, signature -> location active.
  const comptoir = await api('/api/auth/staff/login', {
    method: 'POST',
    body: { email: 'comptoir@bricoloc.example', password: 'bricoloc' },
  });
  const comptoirToken = comptoir.json.token as string;

  const scan = await api(`/api/ops/scan/${pay.json.qrToken}`, { token: comptoirToken });
  assert.equal(scan.json.paid, true);
  const machineUnits: string[] = [];
  for (const item of scan.json.reservation.items) {
    if (item.kind !== 'MACHINE') continue;
    for (const u of item.product.units.slice(0, item.quantity)) machineUnits.push(u.id);
  }
  assert.ok(machineUnits.length >= 1);

  const pickup = await api('/api/ops/pickup', {
    method: 'POST',
    token: comptoirToken,
    body: {
      reservationId,
      unitIds: machineUnits,
      checklist: { etat_general: true, accessoires_complets: true, carburant: true },
      photos: [],
      customerSignature: 'data:image/png;base64,SIGNATURE_DEMO',
      note: 'Retrait E2E',
    },
  });
  assert.equal(pickup.status, 200, JSON.stringify(pickup.json));
  assert.equal(pickup.json.reservation.status, 'OUT');

  // 13. + 14. + 15. Retour : controle, retard, caution.
  const returnAt = new Date(end.getTime() + 26 * 3600000); // 26h de retard -> 2 jours
  const ret = await api('/api/ops/return', {
    method: 'POST',
    token: comptoirToken,
    body: {
      reservationId,
      actualReturnAt: returnAt.toISOString(),
      checklist: { nettoye: true, complet: true },
      photos: [],
      damages: [],
      missingAccessories: [],
      cleaningFeeHT: 0,
      otherFeeHT: 0,
      depositAction: 'RELEASE',
    },
  });
  assert.equal(ret.status, 200, JSON.stringify(ret.json));
  assert.equal(ret.json.status, 'CLOSED');
  assert.ok(ret.json.lateFeeHT > 0, 'des frais de retard doivent etre calcules');
  assert.equal(ret.json.lateDays, 2);
  assert.equal(ret.json.deposit.status, 'RELEASED');

  // 16. La facture finale est disponible et telechargeable en PDF.
  assert.ok(ret.json.finalInvoice);
  const detail = await api(`/api/reservations/${reservationId}`, { token: userToken });
  const finalInvoice = detail.json.reservation.invoices.find(
    (i: { kind: string }) => i.kind === 'FINAL',
  );
  assert.ok(finalInvoice, 'facture FINAL enregistree');
  const pdf = await fetch(
    `${base}/api/reservations/${reservationId}/invoices/${finalInvoice.id}/pdf`,
    { headers: { authorization: `Bearer ${userToken}` } },
  );
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');

  // Les exemplaires sont revenus en stock.
  const units = await prisma.productUnit.findMany({ where: { productId } });
  assert.ok(units.every((u) => u.state === 'AVAILABLE'));
});

test('parcours B : dates demandees seulement avant validation, avec conflit de dispo', async () => {
  // Machine dédiée à 2 exemplaires.
  const login = await api('/api/auth/staff/login', {
    method: 'POST',
    body: { email: 'admin@bricoloc.example', password: 'bricoloc' },
  });
  const adminToken = login.json.token as string;
  const slug = `test-dispo-${Date.now()}`;
  const created = await api('/api/admin/products', {
    method: 'POST',
    token: adminToken,
    body: { slug, name: 'Machine test dispo', kind: 'MACHINE', dailyPrice: 40, deposit: 300 },
  });
  const miniId = created.json.product.id as string;
  for (let i = 1; i <= 2; i++) {
    await api('/api/admin/units', {
      method: 'POST',
      token: adminToken,
      body: { productId: miniId, assetTag: `DISPO-${Date.now()}-${i}` },
    });
  }

  const cartNew = await api('/api/cart/new', { method: 'POST' });
  const cartKey = cartNew.json.cartKey as string;

  // On en demande 5 -> PARTIAL/UNAVAILABLE attendu.
  await api('/api/cart/items', { method: 'POST', cartKey, body: { productId: miniId, quantity: 5 } });

  const start = new Date(Date.now() + 2 * 86400000).toISOString();
  const end = new Date(Date.now() + 5 * 86400000).toISOString();
  const res = await api('/api/cart/period', {
    method: 'PUT',
    cartKey,
    body: { period: { start, end } },
  });
  assert.ok(res.json.availabilityAlerts.length >= 1, 'une alerte de dispo doit remonter');
  const alert = res.json.availabilityAlerts[0];
  assert.ok(['PARTIAL', 'UNAVAILABLE', 'NEARBY'].includes(alert.status));
  assert.ok(alert.availableQty < 5);

  // Correction du panier sans tout recommencer : on reduit la quantite.
  const fixed = await api(`/api/cart/items/${miniId}`, {
    method: 'PATCH',
    cartKey,
    body: { quantity: 1 },
  });
  assert.equal(fixed.json.availabilityAlerts.length, 0);
  assert.equal(fixed.json.hasBlockingIssue, false);
});
