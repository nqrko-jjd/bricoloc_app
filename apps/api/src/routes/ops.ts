import { Router } from 'express';
import {
  assignDeliverySchema,
  computeLateFee,
  pickupChecklistSchema,
  returnChecklistSchema,
} from '@bricoloc/shared';
import { prisma } from '../db.js';
import { badRequest, h, notFound } from '../lib/http.js';
import { attachPrincipal, requireStaff } from '../lib/auth.js';
import { getSettings } from '../lib/settings.js';
import { generateInvoice } from '../lib/invoice.js';
import { notify, NOTIF_TEMPLATES } from '../lib/notifications.js';

export const opsRouter = Router();
opsRouter.use(attachPrincipal, requireStaff());

const staffId = (req: import('express').Request) =>
  req.principal?.kind === 'staff' ? req.principal.id : undefined;

/** Recherche une reservation par QR token ou numero. */
opsRouter.get(
  '/scan/:token',
  h(async (req, res) => {
    const token = req.params.token.trim();
    const reservation = await prisma.reservation.findFirst({
      where: { OR: [{ qrToken: token }, { number: token }] },
      include: {
        user: true,
        items: { include: { product: { include: { units: true } }, units: { include: { unit: true } } } },
        payments: true,
        deposit: true,
        deliveries: true,
        pickup: true,
        return: true,
      },
    });
    if (!reservation) throw notFound('Aucune reservation pour ce code');
    res.json({
      reservation,
      paid: reservation.payments.some((p) => p.kind === 'RENTAL' && p.status === 'PAID'),
      depositHeld: reservation.deposit?.status === 'HELD',
    });
  }),
);

/** File de preparation. */
opsRouter.get(
  '/queue',
  h(async (_req, res) => {
    const rows = await prisma.reservation.findMany({
      where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY'] } },
      include: { items: true, deliveries: true, user: true },
      orderBy: { periodStart: 'asc' },
    });
    res.json({ reservations: rows });
  }),
);

opsRouter.post(
  '/reservations/:id/status',
  requireStaff('PREPARATEUR', 'RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const next = String(req.body?.status);
    if (!['PREPARING', 'READY'].includes(next)) throw badRequest('Statut non autorise ici');
    const r = await prisma.reservation.update({
      where: { id: req.params.id },
      data: { status: next },
    });
    if (next === 'READY' && r.userId) {
      const tpl = NOTIF_TEMPLATES.EQUIPMENT_READY({ number: r.number });
      await notify({
        userId: r.userId,
        type: 'EQUIPMENT_READY',
        title: tpl.title,
        body: tpl.body,
        data: { reservationId: r.id },
      });
    }
    res.json({ reservation: r });
  }),
);

/** Retrait : affecte les exemplaires, checklist, photos, signature -> location active. */
opsRouter.post(
  '/pickup',
  requireStaff('COMPTOIR', 'PREPARATEUR', 'RESPONSABLE'),
  h(async (req, res) => {
    const data = pickupChecklistSchema.parse(req.body);
    const reservation = await prisma.reservation.findUnique({
      where: { id: data.reservationId },
      include: { items: true, payments: true, deposit: true },
    });
    if (!reservation) throw notFound();
    if (!['CONFIRMED', 'PREPARING', 'READY'].includes(reservation.status)) {
      throw badRequest(`Retrait impossible depuis le statut ${reservation.status}`);
    }
    const paid = reservation.payments.some((p) => p.kind === 'RENTAL' && p.status === 'PAID');
    if (!paid) throw badRequest('Le paiement de la location n\'est pas confirme');

    // Affectation des exemplaires physiques scannes aux lignes machine.
    const units = await prisma.productUnit.findMany({ where: { id: { in: data.unitIds } } });
    const machineItems = reservation.items.filter((i) => i.kind === 'MACHINE');
    for (const unit of units) {
      const item = machineItems.find((i) => i.productId === unit.productId);
      if (!item) throw badRequest(`L'exemplaire ${unit.assetTag} ne correspond a aucune ligne`);
      await prisma.reservationUnit.upsert({
        where: { reservationItemId_unitId: { reservationItemId: item.id, unitId: unit.id } },
        create: { reservationItemId: item.id, unitId: unit.id },
        update: {},
      });
      await prisma.productUnit.update({ where: { id: unit.id }, data: { state: 'RENTED' } });
    }

    await prisma.pickupRecord.upsert({
      where: { reservationId: reservation.id },
      create: {
        reservationId: reservation.id,
        staffId: staffId(req),
        checklist: data.checklist as never,
        photos: data.photos as never,
        signature: data.customerSignature,
        note: data.note,
      },
      update: {
        checklist: data.checklist as never,
        photos: data.photos as never,
        signature: data.customerSignature,
        note: data.note,
      },
    });

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'OUT' },
    });
    if (reservation.fulfilmentMode === 'DELIVERY') {
      await prisma.delivery.updateMany({
        where: { reservationId: reservation.id, direction: 'OUT' },
        data: { status: 'DELIVERED' },
      });
    }
    res.json({ reservation: updated, message: 'Location activee' });
  }),
);

/** Retour : controle, retard, dommages, caution, cloture + facture finale. */
opsRouter.post(
  '/return',
  requireStaff('COMPTOIR', 'TECHNICIEN', 'RESPONSABLE'),
  h(async (req, res) => {
    const data = returnChecklistSchema.parse(req.body);
    const reservation = await prisma.reservation.findUnique({
      where: { id: data.reservationId },
      include: {
        items: { include: { product: true, units: { include: { unit: true } } } },
        deposit: true,
      },
    });
    if (!reservation) throw notFound();
    if (!['OUT', 'RETURN_PENDING'].includes(reservation.status)) {
      throw badRequest(`Retour impossible depuis le statut ${reservation.status}`);
    }
    const settings = await getSettings();
    const actualReturn = new Date(data.actualReturnAt);
    const hoursLate = (actualReturn.getTime() - reservation.periodEnd.getTime()) / 3_600_000;

    // Frais de retard : base sur le tarif jour cumule des machines.
    const machineDaily = reservation.items
      .filter((i) => i.kind === 'MACHINE')
      .reduce((a, i) => a + i.product.dailyPrice * i.quantity, 0);
    const late = computeLateFee(
      machineDaily,
      hoursLate,
      Number(settings.lateFeeMultiplier ?? 1.5),
    );

    // Restitution des exemplaires.
    for (const item of reservation.items) {
      for (const ru of item.units) {
        await prisma.reservationUnit.update({
          where: { id: ru.id },
          data: { returnedAt: actualReturn },
        });
        const dmg = data.damages.find((d) => d.unitId === ru.unitId);
        await prisma.productUnit.update({
          where: { id: ru.unitId },
          data: { state: dmg ? 'DAMAGED' : 'AVAILABLE' },
        });
      }
    }

    // Dommages.
    let damageFees = 0;
    for (const d of data.damages) {
      damageFees += d.feeHT;
      await prisma.damage.create({
        data: {
          reservationId: reservation.id,
          unitId: d.unitId,
          description: d.description,
          feeHT: d.feeHT,
          photos: d.photos as never,
        },
      });
    }
    const missingFees = data.missingAccessories.reduce((a, m) => a + m.feeHT, 0);

    await prisma.returnRecord.upsert({
      where: { reservationId: reservation.id },
      create: {
        reservationId: reservation.id,
        staffId: staffId(req),
        actualReturnAt: actualReturn,
        checklist: data.checklist as never,
        photos: data.photos as never,
        cleaningFeeHT: data.cleaningFeeHT,
        otherFeeHT: data.otherFeeHT + missingFees,
        otherFeeReason:
          data.otherFeeReason ||
          (missingFees ? 'Accessoires manquants' : undefined) ||
          undefined,
        lateDays: late.daysLate,
        lateFeeHT: late.feeHT,
        note: data.note,
      },
      update: {
        actualReturnAt: actualReturn,
        checklist: data.checklist as never,
        photos: data.photos as never,
        cleaningFeeHT: data.cleaningFeeHT,
        otherFeeHT: data.otherFeeHT + missingFees,
        lateDays: late.daysLate,
        lateFeeHT: late.feeHT,
        note: data.note,
      },
    });

    // Caution.
    const depositAmount = reservation.deposit?.amount ?? 0;
    const extraCharges = late.feeHT + damageFees + missingFees + data.cleaningFeeHT + data.otherFeeHT;
    let depositStatus: 'RELEASED' | 'PARTIAL_RELEASE' | 'CAPTURED' = 'RELEASED';
    let captured = 0;
    if (data.depositAction === 'CAPTURE') {
      depositStatus = 'CAPTURED';
      captured = depositAmount;
    } else if (data.depositAction === 'PARTIAL') {
      depositStatus = 'PARTIAL_RELEASE';
      captured = Math.min(data.depositCapturedAmount || extraCharges, depositAmount);
    }
    if (reservation.deposit) {
      await prisma.deposit.update({
        where: { id: reservation.deposit.id },
        data: { status: depositStatus, capturedAmount: captured },
      });
    }
    if (captured > 0) {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          kind: 'DEPOSIT',
          amount: captured,
          status: 'PAID',
          provider: 'mock',
          meta: { reason: 'Retenue sur caution', testMode: true } as never,
        },
      });
    }
    const refund = depositAmount - captured;
    if (refund > 0) {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          kind: 'REFUND',
          amount: refund,
          status: 'REFUNDED',
          provider: 'mock',
          meta: { reason: 'Liberation caution', testMode: true } as never,
        },
      });
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CLOSED' },
    });
    if (reservation.fulfilmentMode === 'DELIVERY') {
      await prisma.delivery.updateMany({
        where: { reservationId: reservation.id, direction: 'RETURN' },
        data: { status: 'COLLECTED' },
      });
    }

    const invoice = await generateInvoice(reservation.id, 'FINAL');

    if (reservation.userId) {
      const t1 = NOTIF_TEMPLATES.RETURN_CONFIRMED({ number: reservation.number });
      await notify({
        userId: reservation.userId,
        type: 'RETURN_CONFIRMED',
        title: t1.title,
        body: t1.body,
        data: { reservationId: reservation.id, invoiceNumber: invoice.number },
      });
      if (refund > 0) {
        const t2 = NOTIF_TEMPLATES.DEPOSIT_RELEASED({ number: reservation.number });
        await notify({
          userId: reservation.userId,
          type: 'DEPOSIT_RELEASED',
          title: t2.title,
          body: `${t2.body} Montant restitue : ${refund.toFixed(2)} EUR.`,
          data: { reservationId: reservation.id, refund },
        });
      }
    }

    res.json({
      status: 'CLOSED',
      lateFeeHT: late.feeHT,
      lateDays: late.daysLate,
      damageFeesHT: damageFees,
      extraChargesHT: Math.round(extraCharges * 100) / 100,
      deposit: { amount: depositAmount, status: depositStatus, captured, refunded: refund },
      finalInvoice: invoice.number,
    });
  }),
);

opsRouter.get(
  '/deliveries',
  requireStaff('LIVREUR', 'RESPONSABLE', 'COMPTOIR'),
  h(async (_req, res) => {
    const rows = await prisma.delivery.findMany({
      include: { reservation: { include: { user: true } }, driver: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ deliveries: rows });
  }),
);

opsRouter.post(
  '/deliveries/assign',
  requireStaff('LIVREUR', 'RESPONSABLE'),
  h(async (req, res) => {
    const data = assignDeliverySchema.parse(req.body);
    const delivery = await prisma.delivery.update({
      where: { id: data.deliveryId },
      data: {
        driverId: data.driverId ?? undefined,
        status: data.status ?? undefined,
        slot: data.slot ?? undefined,
        signature: data.signature ?? undefined,
        photo: data.photo ?? undefined,
      },
      include: { reservation: true },
    });
    if (data.status === 'IN_TRANSIT' && delivery.reservation.userId) {
      const tpl = NOTIF_TEMPLATES.DELIVERY_ON_THE_WAY({ number: delivery.reservation.number });
      await notify({
        userId: delivery.reservation.userId,
        type: 'DELIVERY_ON_THE_WAY',
        title: tpl.title,
        body: tpl.body,
        data: { reservationId: delivery.reservationId },
      });
    }
    res.json({ delivery });
  }),
);
