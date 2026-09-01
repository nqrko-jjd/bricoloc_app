import { Router } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { extendReservationSchema, reportProblemSchema } from '@bricoloc/shared';
import { computeRentalPrice } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { badRequest, forbidden, h, notFound } from '../lib/http.js';
import { attachPrincipal, requireUser } from '../lib/auth.js';
import { availabilityFor } from '../lib/availability.js';
import { getSettings, pricingSettings } from '../lib/settings.js';
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

/** Demande de prolongation : verifie la dispo de chaque ligne sur la periode etendue. */
reservationsRouter.post(
  '/:id/extend',
  requireUser,
  h(async (req, res) => {
    const { newEnd } = extendReservationSchema.parse(req.body);
    const r = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } },
    });
    if (!r) throw notFound();
    if (r.userId !== req.principal!.id) throw forbidden();
    if (!['CONFIRMED', 'READY', 'OUT', 'RETURN_PENDING'].includes(r.status)) {
      throw badRequest('Cette reservation ne peut pas etre prolongee');
    }
    const end = new Date(newEnd);
    if (end.getTime() <= r.periodEnd.getTime())
      throw badRequest('La nouvelle date doit etre posterieure a la date de retour actuelle');

    const settings = await getSettings();
    const ps = pricingSettings(settings);
    const conflicts = [];
    let extraHT = 0;
    for (const item of r.items) {
      if (item.product.isConsumable) continue;
      const avail = await availabilityFor(
        item.productId,
        r.periodEnd,
        end,
        item.quantity,
        { excludeReservationId: r.id },
      );
      if (avail.status !== 'AVAILABLE') conflicts.push(avail);
      const before = computeRentalPrice({
        pricing: {
          dailyPrice: item.product.dailyPrice,
          weekendPrice: item.product.weekendPrice,
          weekPrice: item.product.weekPrice,
          monthPrice: item.product.monthPrice,
          tiers: (item.product.tiers as never) ?? [],
          deposit: item.product.deposit,
        },
        period: { start: r.periodStart, end: r.periodEnd },
        quantity: item.quantity,
        customerType: 'PARTICULIER',
        settings: ps,
      });
      const after = computeRentalPrice({
        pricing: {
          dailyPrice: item.product.dailyPrice,
          weekendPrice: item.product.weekendPrice,
          weekPrice: item.product.weekPrice,
          monthPrice: item.product.monthPrice,
          tiers: (item.product.tiers as never) ?? [],
          deposit: item.product.deposit,
        },
        period: { start: r.periodStart, end },
        quantity: item.quantity,
        customerType: 'PARTICULIER',
        settings: ps,
      });
      extraHT += after.linePrice - before.linePrice;
    }

    if (conflicts.length > 0) {
      return res.status(409).json({
        error: { code: 'AVAILABILITY', message: 'Prolongation impossible : materiel deja reserve.' },
        conflicts,
      });
    }

    const vat = Number(settings.vatRate ?? 0.21);
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: r.userId,
        reservationId: r.id,
        subject: 'Demande de prolongation',
        message: `Nouvelle date de retour souhaitee : ${end.toISOString()}. Supplement estime : ${(
          extraHT *
          (1 + vat)
        ).toFixed(2)} EUR TVAC.`,
      },
    });
    res.json({
      status: 'PENDING_APPROVAL',
      ticketId: ticket.id,
      estimatedExtraHT: Math.round(extraHT * 100) / 100,
      estimatedExtraTVAC: Math.round(extraHT * (1 + vat) * 100) / 100,
    });
  }),
);

reservationsRouter.post(
  '/:id/problem',
  requireUser,
  h(async (req, res) => {
    const body = reportProblemSchema.parse({ ...req.body, reservationId: req.params.id });
    const r = await prisma.reservation.findUnique({ where: { id: req.params.id } });
    if (!r || r.userId !== req.principal!.id) throw notFound();
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: r.userId,
        reservationId: r.id,
        subject: body.subject,
        message: body.message,
      },
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
