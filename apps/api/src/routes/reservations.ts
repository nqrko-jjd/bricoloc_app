import { Router } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { extendReservationSchema, reportProblemSchema, formatDateTimeBE, formatEUR } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { badRequest, conflict, forbidden, h, notFound } from '../lib/http.js';
import { attachPrincipal, requireUser } from '../lib/auth.js';
import { EXTENDABLE_STATUSES, quoteExtension } from '../lib/extensions.js';
import { createTicket, postMessage } from '../lib/tickets.js';
import { qrDataUrl } from '../lib/qr.js';

export const reservationsRouter = Router();
reservationsRouter.use(attachPrincipal);

const reservationInclude = {
  items: { include: { product: true, units: { include: { unit: true } } } },
  payments: true,
  deposit: true,
  deliveries: true,
  pickup: true,
  return: true,
  invoices: true,
  damages: true,
  extensions: { orderBy: { createdAt: 'desc' as const } },
  tickets: {
    orderBy: { lastMessageAt: 'desc' as const },
    select: { id: true, subject: true, status: true, kind: true, lastMessageAt: true, clientUnread: true },
  },
};

reservationsRouter.get(
  '/',
  requireUser,
  h(async (req, res) => {
    const rows = await prisma.reservation.findMany({
      where: { userId: req.principal!.id },
      include: reservationInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ reservations: rows });
  }),
);

reservationsRouter.get(
  '/:id',
  requireUser,
  h(async (req, res) => {
    const r = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: reservationInclude,
    });
    if (!r) throw notFound();
    if (r.userId !== req.principal!.id) throw forbidden();
    res.json({
      reservation: r,
      qrDataUrl: await qrDataUrl(r.qrToken),
    });
  }),
);

/**
 * Demande de prolongation de LA MÊME réservation.
 * - `preview: true` : chiffre seulement le supplément (aucune demande créée).
 * - Une seule demande en attente par réservation : un nouveau clic la met à jour
 *   (jamais de doublon, jamais de nouvelle commande).
 * - Les dates de la réservation ne changent qu'à l'acceptation par l'équipe.
 */
reservationsRouter.post(
  '/:id/extend',
  requireUser,
  h(async (req, res) => {
    const { newEnd, preview } = extendReservationSchema.parse(req.body);
    const r = await prisma.reservation.findUnique({ where: { id: req.params.id } });
    if (!r) throw notFound();
    if (r.userId !== req.principal!.id) throw forbidden();
    if (!EXTENDABLE_STATUSES.includes(r.status)) {
      throw badRequest('Cette réservation ne peut pas être prolongée');
    }
    const end = new Date(newEnd);
    const q = await quoteExtension(r.id, end);

    if (q.conflicts.length > 0) {
      return res.status(409).json({
        error: { code: 'AVAILABILITY', message: 'Prolongation impossible : matériel déjà réservé sur cette période.' },
        conflicts: q.conflicts,
      });
    }
    const estimate = { estimatedExtraHT: q.extraHT, estimatedExtraTVAC: q.extraTVAC };
    if (preview) return res.json({ status: 'PREVIEW', requestedEnd: end.toISOString(), ...estimate });

    const message = `Nouvelle date de retour souhaitée : ${formatDateTimeBE(end)} (actuellement ${formatDateTimeBE(
      r.periodEnd,
    )}). Supplément estimé : ${formatEUR(q.extraTVAC)} TVAC.`;

    // `pendingKey` (unique) : deux requêtes simultanées (double-clic) ne peuvent pas créer 2 demandes.
    const fields = { requestedEnd: end, previousEnd: r.periodEnd, extraHT: q.extraHT, extraTVAC: q.extraTVAC };
    const updatePending = async () => {
      const pending = await prisma.reservationExtension.findUnique({ where: { pendingKey: r.id } });
      if (!pending) throw conflict('Une demande vient d’être traitée, réessayez.');
      const unchanged = pending.requestedEnd.getTime() === end.getTime();
      const updated = await prisma.reservationExtension.update({ where: { id: pending.id }, data: fields });
      if (pending.ticketId && !unchanged) {
        await postMessage(pending.ticketId, { type: 'CLIENT' }, `Demande modifiée. ${message}`);
      }
      return updated;
    };

    let extension;
    try {
      extension = await prisma.reservationExtension.create({
        data: { reservationId: r.id, pendingKey: r.id, ...fields },
      });
      const ticket = await createTicket({
        userId: r.userId,
        reservationId: r.id,
        subject: `Prolongation ${r.number}`,
        message,
        kind: 'EXTENSION',
      });
      extension = await prisma.reservationExtension.update({
        where: { id: extension.id },
        data: { ticketId: ticket.id },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e;
      extension = await updatePending();
    }
    res.json({ status: 'PENDING_APPROVAL', extension, ticketId: extension.ticketId, ...estimate });
  }),
);

/** Le client retire sa demande de prolongation en attente. */
reservationsRouter.post(
  '/:id/extend/cancel',
  requireUser,
  h(async (req, res) => {
    const r = await prisma.reservation.findUnique({ where: { id: req.params.id } });
    if (!r || r.userId !== req.principal!.id) throw notFound();
    const pending = await prisma.reservationExtension.findFirst({
      where: { reservationId: r.id, status: 'PENDING' },
    });
    if (!pending) throw conflict('Aucune demande de prolongation en attente');
    await prisma.reservationExtension.update({
      where: { id: pending.id },
      data: { status: 'CANCELLED', pendingKey: null, decidedAt: new Date(), decidedBy: 'client' },
    });
    if (pending.ticketId) {
      await postMessage(pending.ticketId, { type: 'SYSTEM' }, 'Demande annulée par le client.');
      await prisma.supportTicket.update({ where: { id: pending.ticketId }, data: { status: 'CLOSED' } });
    }
    res.json({ status: 'CANCELLED' });
  }),
);

/** Signalement d'un problème : ouvre un ticket avec fil de discussion (visible client + équipe). */
reservationsRouter.post(
  '/:id/problem',
  requireUser,
  h(async (req, res) => {
    const body = reportProblemSchema.parse({ ...req.body, reservationId: req.params.id });
    const r = await prisma.reservation.findUnique({ where: { id: req.params.id } });
    if (!r || r.userId !== req.principal!.id) throw notFound();
    // Double envoi (double-tap) : le même signalement dans la minute renvoie le ticket existant.
    const dup = await prisma.supportTicket.findFirst({
      where: {
        userId: r.userId,
        reservationId: r.id,
        kind: 'PROBLEM',
        subject: body.subject,
        message: body.message,
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
    });
    if (dup) return res.status(200).json({ ticketId: dup.id, status: dup.status });
    const ticket = await createTicket({
      userId: r.userId,
      reservationId: r.id,
      subject: body.subject,
      message: body.message,
      kind: 'PROBLEM',
    });
    res.status(201).json({ ticketId: ticket.id, status: 'OPEN' });
  }),
);

reservationsRouter.get(
  '/:id/invoices/:invoiceId/pdf',
  requireUser,
  h(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.invoiceId },
      include: { reservation: true },
    });
    if (!invoice || invoice.reservationId !== req.params.id) throw notFound();
    if (invoice.reservation.userId !== req.principal!.id) throw forbidden();
    if (!invoice.pdfPath || !existsSync(invoice.pdfPath)) throw notFound('PDF indisponible');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.number}.pdf"`);
    createReadStream(invoice.pdfPath).pipe(res);
  }),
);

/** Recommander : recree un panier avec les memes machines. */
reservationsRouter.post(
  '/:id/reorder',
  requireUser,
  h(async (req, res) => {
    const r = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!r || r.userId !== req.principal!.id) throw notFound();
    res.json({
      items: r.items
        .filter((i) => i.kind !== 'PACK')
        .map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
  }),
);
