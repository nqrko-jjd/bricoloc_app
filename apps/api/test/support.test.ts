/**
 * Prolongation + tickets :
 * - une demande de prolongation ne crée JAMAIS de nouvelle réservation ni de doublon ;
 * - les dates de la MÊME réservation ne changent qu'à l'acceptation par l'équipe ;
 * - un problème signalé ouvre un ticket avec fil de discussion visible des deux côtés.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

let server: Server;
let base: string;
const stamp = Date.now();

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
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

before(async () => {
  await new Promise<void>((resolve) => {
    server = createApp().listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      resolve();
    });
  });
});

after(async () => {
  try {
    const users = await prisma.user.findMany({ where: { email: { startsWith: `e2e-support-${stamp}` } } });
    const uids = users.map((u) => u.id);
    await prisma.reservation.deleteMany({ where: { userId: { in: uids } } });
    await prisma.supportTicket.deleteMany({ where: { userId: { in: uids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
    const products = await prisma.product.findMany({ where: { slug: `test-support-${stamp}` } });
    const pids = products.map((p) => p.id);
    await prisma.productUnit.deleteMany({ where: { productId: { in: pids } } });
    await prisma.product.deleteMany({ where: { id: { in: pids } } });
  } catch (e) {
    console.warn('[cleanup]', (e as Error).message);
  }
  server?.close();
  await prisma.$disconnect();
});

test('prolongation : même réservation, sans doublon, acceptée par l’équipe + fil de discussion', async () => {
  const staff = await api('/api/auth/staff/login', {
    method: 'POST',
    body: { email: 'admin@bricoloc.example', password: 'bricoloc' },
  });
  assert.equal(staff.status, 200);
  const adminToken = staff.json.token as string;

  // Une machine avec 2 exemplaires, une réservation CONFIRMED déjà en base.
  const slug = `test-support-${stamp}`;
  const product = await api('/api/admin/products', {
    method: 'POST',
    token: adminToken,
    body: {
      slug,
      name: 'Machine support test',
      kind: 'MACHINE',
      categorySlug: 'percage-demolition',
      shortDescription: 'Test prolongation',
      dailyPrice: 30,
      weekendPrice: 45,
      deposit: 100,
      tiers: [{ minDays: 1, perDay: 30 }],
    },
  });
  assert.equal(product.status, 200);
  const productId = product.json.product.id as string;
  for (let i = 1; i <= 2; i++) {
    const u = await api('/api/admin/units', {
      method: 'POST',
      token: adminToken,
      body: { productId, assetTag: `SUP-${stamp}-${i}`, serialNumber: `SNSUP${i}` },
    });
    assert.equal(u.status, 200);
  }

  const email = `e2e-support-${stamp}@bricoloc.example`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'motdepasse123',
      firstName: 'Sam',
      lastName: 'Support',
      phone: '+32470111222',
      customerType: 'PARTICULIER',
    },
  });
  assert.equal(reg.status, 201);
  const token = reg.json.token as string;
  const user = await prisma.user.findUnique({ where: { email } });

  const start = new Date(Date.now() + 2 * 86400000);
  const end = new Date(start.getTime() + 2 * 86400000);
  const resv = await prisma.reservation.create({
    data: {
      number: `E2E-SUP-${stamp}`,
      qrToken: `qr-sup-${stamp}`,
      userId: user!.id,
      status: 'CONFIRMED',
      periodStart: start,
      periodEnd: end,
      totals: {},
      items: {
        create: {
          productId,
          nameSnapshot: 'Machine support test',
          kind: 'MACHINE',
          quantity: 1,
          unitPriceHT: 30,
          lineHT: 60,
          billedDays: 2,
        },
      },
    },
  });
  const newEnd = new Date(end.getTime() + 2 * 86400000);

  // Aperçu : chiffre le supplément sans rien enregistrer.
  const preview = await api(`/api/reservations/${resv.id}/extend`, {
    method: 'POST',
    token,
    body: { newEnd: newEnd.toISOString(), preview: true },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.json.status, 'PREVIEW');
  assert.ok(preview.json.estimatedExtraTVAC > 0);
  assert.equal(await prisma.reservationExtension.count({ where: { reservationId: resv.id } }), 0);

  // Trois clics SIMULTANÉS (double-clic nerveux) => UNE seule demande et UN seul ticket, dates inchangées.
  const burst = await Promise.all(
    [0, 1, 2].map(() =>
      api(`/api/reservations/${resv.id}/extend`, {
        method: 'POST',
        token,
        body: { newEnd: newEnd.toISOString() },
      }),
    ),
  );
  for (const r of burst) {
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.status, 'PENDING_APPROVAL');
  }
  assert.equal(await prisma.reservationExtension.count({ where: { reservationId: resv.id } }), 1);
  assert.equal(await prisma.supportTicket.count({ where: { reservationId: resv.id, kind: 'EXTENSION' } }), 1);
  assert.equal(await prisma.reservation.count({ where: { userId: user!.id } }), 1, 'aucune nouvelle commande');
  const untouched = await prisma.reservation.findUnique({ where: { id: resv.id } });
  assert.equal(untouched!.periodEnd.getTime(), end.getTime());

  // Le client voit sa demande en attente sur SA réservation.
  const detail = await api(`/api/reservations/${resv.id}`, { token });
  assert.equal(detail.json.reservation.extensions[0].status, 'PENDING');
  assert.equal(detail.json.reservation.tickets.length, 1);

  // L'équipe retrouve la demande dans les tickets et l'accepte.
  const list = await api('/api/admin/tickets', { token: adminToken });
  assert.equal(list.status, 200);
  const ticketRow = list.json.tickets.find((t: { reservation?: { number: string } }) => t.reservation?.number === resv.number);
  assert.ok(ticketRow, 'ticket visible côté admin');
  assert.equal(ticketRow.kind, 'EXTENSION');

  const adminThread = await api(`/api/admin/tickets/${ticketRow.id}`, { token: adminToken });
  const extensionId = adminThread.json.ticket.extension.id as string;
  const approve = await api(`/api/admin/extensions/${extensionId}/approve`, { method: 'POST', token: adminToken });
  assert.equal(approve.status, 200, JSON.stringify(approve.json));
  assert.equal(approve.json.extension.status, 'APPROVED');

  // Les dates de la MÊME réservation ont bougé ; le client peut le lire.
  const after = await api(`/api/reservations/${resv.id}`, { token });
  assert.equal(new Date(after.json.reservation.periodEnd).getTime(), newEnd.getTime());
  assert.equal(after.json.reservation.extensions[0].status, 'APPROVED');

  // Le client lit la réponse dans le fil et répond.
  const thread = await api(`/api/account/tickets/${ticketRow.id}`, { token });
  assert.equal(thread.status, 200);
  assert.ok(thread.json.messages.some((m: { authorType: string; body: string }) => m.authorType === 'STAFF' && /acceptée/i.test(m.body)));
  const reply = await api(`/api/account/tickets/${ticketRow.id}/messages`, {
    method: 'POST',
    token,
    body: { body: 'Merci !' },
  });
  assert.equal(reply.status, 201);
});

test('signalement d’un problème : ticket + fil client ↔ équipe + notification', async () => {
  const staff = await api('/api/auth/staff/login', {
    method: 'POST',
    body: { email: 'admin@bricoloc.example', password: 'bricoloc' },
  });
  const adminToken = staff.json.token as string;
  const user = await prisma.user.findFirst({ where: { email: { startsWith: `e2e-support-${stamp}` } } });
  const resv = await prisma.reservation.findFirst({ where: { userId: user!.id } });
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: user!.email, password: 'motdepasse123' },
  });
  const token = login.json.token as string;

  const problem = await api(`/api/reservations/${resv!.id}/problem`, {
    method: 'POST',
    token,
    body: { subject: 'La perceuse chauffe', message: 'Elle s’arrête après 5 minutes.' },
  });
  assert.equal(problem.status, 201);
  const ticketId = problem.json.ticketId as string;

  // Visible dans « mes tickets » et côté équipe (non lu).
  const mine = await api('/api/account/tickets', { token });
  assert.ok(mine.json.tickets.some((t: { id: string }) => t.id === ticketId));
  const admin = await api('/api/admin/tickets?status=ACTIVE', { token: adminToken });
  const row = admin.json.tickets.find((t: { id: string }) => t.id === ticketId);
  assert.ok(row);
  assert.equal(row.staffUnread, true);

  // L'équipe répond : le client est notifié et voit un non-lu.
  const answer = await api(`/api/admin/tickets/${ticketId}/messages`, {
    method: 'POST',
    token: adminToken,
    body: { body: 'On vous apporte une machine de remplacement demain.' },
  });
  assert.equal(answer.status, 201);
  const mine2 = await api('/api/account/tickets', { token });
  assert.equal(mine2.json.unread, 1);
  assert.equal(await prisma.notification.count({ where: { userId: user!.id, title: 'Réponse de BRICOLOC' } }), 1);

  const thread = await api(`/api/account/tickets/${ticketId}`, { token });
  assert.equal(thread.json.messages.length, 2);
  assert.equal(thread.json.ticket.status, 'IN_PROGRESS');
  assert.equal((await api('/api/account/tickets', { token })).json.unread, 0);

  // Clôture puis réponse du client => le ticket se rouvre.
  await api(`/api/admin/tickets/${ticketId}`, { method: 'PATCH', token: adminToken, body: { status: 'CLOSED' } });
  await api(`/api/account/tickets/${ticketId}/messages`, { method: 'POST', token, body: { body: 'Toujours en panne.' } });
  const reopened = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  assert.equal(reopened!.status, 'OPEN');

  // Un autre client ne peut pas lire ce ticket.
  const other = await api('/api/auth/register', {
    method: 'POST',
    body: {
      email: `e2e-support-${stamp}-b@bricoloc.example`,
      password: 'motdepasse123',
      firstName: 'Autre',
      lastName: 'Client',
      phone: '+32470999888',
      customerType: 'PARTICULIER',
    },
  });
  const forbidden = await api(`/api/account/tickets/${ticketId}`, { token: other.json.token });
  assert.equal(forbidden.status, 404);
});
