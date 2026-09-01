import { Router } from 'express';
import { checkoutSchema, mockPaySchema } from '@bricoloc/shared';
import { buildReservationNumber } from '@bricoloc/shared';
import { prisma, nextCounter } from '../db.js';
import { badRequest, conflict, forbidden, h, notFound } from '../lib/http.js';
import { attachPrincipal, hashPassword, signToken } from '../lib/auth.js';
import { cartKeyFrom, customerTypeFor, getOrCreateCart } from '../lib/cart.js';
import { checkMany } from '../lib/availability.js';
import { buildQuote, computeDeliveryFee } from '../lib/quote.js';
import { getSettings } from '../lib/settings.js';
import { newQrToken, qrDataUrl } from '../lib/qr.js';
import { generateInvoice } from '../lib/invoice.js';
import { notify, NOTIF_TEMPLATES } from '../lib/notifications.js';

export const checkoutRouter = Router();
checkoutRouter.use(attachPrincipal);

/**
 * Cree une reservation DRAFT a partir du panier :
 * verifie TOUTES les disponibilites en une passe, fige le devis, cree le paiement + la caution.
 */
checkoutRouter.post(
  '/',
  h(async (req, res) => {
    const key = cartKeyFrom(req);
    const data = checkoutSchema.parse(req.body);
    let uid = req.principal?.kind === 'user' ? req.principal.id : undefined;
    let issuedToken: string | undefined;

    const cart = await getOrCreateCart(key, uid);
    if (cart.items.length === 0) throw badRequest('Votre panier est vide');

    const start = new Date(data.period.start);
    const end = new Date(data.period.end);
    const settings = await getSettings();
    const minLead = Number(settings.minLeadTimeHours ?? 2) * 3_600_000;
    if (start.getTime() < Date.now() + minLead - 60_000) {
      throw badRequest(
        `Le retrait doit etre planifie au moins ${settings.minLeadTimeHours}h a l'avance.`,
      );
    }

    // Verification simultanee de toutes les lignes.
    const check = await checkMany(
      start,
      end,
      cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    );
    if (!check.ok) {
      return res.status(409).json({
        error: {
          code: 'AVAILABILITY',
          message: "Certains articles ne sont pas disponibles sur la periode choisie.",
        },
        results: check.results,
      });
    }

    // Compte : cree si demande, sinon guest avec contact obligatoire.
    if (!uid) {
      const account = req.body?.account as { password?: string } | undefined;
      if (!data.contact) throw badRequest('Coordonnees requises pour finaliser la commande');
      if (account?.password) {
        const existing = await prisma.user.findUnique({
          where: { email: data.contact.email.toLowerCase() },
        });
        if (existing) throw conflict('Un compte existe deja avec cet e-mail, connectez-vous.');
        const user = await prisma.user.create({
          data: {
            email: data.contact.email.toLowerCase(),
            passwordHash: await hashPassword(account.password),
            firstName: data.contact.firstName,
            lastName: data.contact.lastName,
            phone: data.contact.phone,
          },
        });
        uid = user.id;
        issuedToken = signToken({ kind: 'user', id: user.id, email: user.email });
        await prisma.cart.update({ where: { id: cart.id }, data: { userId: uid } });
      }
    }

    // Zone de livraison.
    let deliveryAddress = data.fulfilment.address ?? null;
    if (data.fulfilment.addressId) {
      const a = await prisma.address.findUnique({ where: { id: data.fulfilment.addressId } });
      if (a)
        deliveryAddress = {
          line1: a.line1,
          line2: a.line2 ?? undefined,
          postalCode: a.postalCode,
          city: a.city,
          country: a.country,
          isConstructionSite: a.isConstructionSite,
          contactName: a.contactName ?? undefined,
          contactPhone: a.contactPhone ?? undefined,
        };
    }
    if (data.fulfilment.mode === 'DELIVERY') {
      if (!deliveryAddress?.postalCode) throw badRequest('Adresse de livraison requise');
      const d = await computeDeliveryFee(deliveryAddress, 0, settings);
      if (!d.served) throw badRequest(d.reason);
    }

    const customerType = await customerTypeFor(uid);
    const quote = await buildQuote({
      lines: cart.items.map((i) => ({ product: i.product, quantity: i.quantity })),
      periodStart: start,
      periodEnd: end,
      customerType,
      fulfilmentMode: data.fulfilment.mode,
      deliveryAddress: deliveryAddress ?? null,
      promoCode: data.promoCode ?? cart.promoCode,
    });

    const seq = await nextCounter('reservation');
    const number = buildReservationNumber(seq);
    const qrToken = newQrToken('R');

    const reservation = await prisma.reservation.create({
      data: {
        number,
        qrToken,
        userId: uid ?? null,
        status: 'DRAFT',
        channel: data.channel,
        periodStart: start,
        periodEnd: end,
        fulfilmentMode: data.fulfilment.mode,
        address: deliveryAddress as never,
        slot: data.fulfilment.slot ?? null,
        contact: (data.contact ?? null) as never,
        promoCode: quote.promoCode,
        totals: quote.totals as never,
        items: {
          create: quote.lines.map((l) => ({
            productId: l.productId,
            nameSnapshot: l.name,
            kind: l.kind,
            quantity: l.quantity,
            unitPriceHT: l.unitPriceHT,
            lineHT: l.lineHT,
            depositUnit: l.depositUnit,
            billedDays: l.billedDays,
            appliedRule: l.appliedRule,
          })),
        },
        payments: {
          create: {
            kind: 'RENTAL',
            amount: quote.totals.totalTVAC,
            status: 'PENDING',
            provider: 'mock',
          },
        },
        deposit: {
          create: { amount: quote.totals.depositsTotal, status: 'HELD' },
        },
        deliveries:
          data.fulfilment.mode === 'DELIVERY'
            ? {
                create: {
                  direction: 'OUT',
                  status: 'REQUESTED',
                  address: deliveryAddress as never,
                  feeHT: quote.deliveryFeeHT,
                  slot: data.fulfilment.slot ?? null,
                },
              }
            : undefined,
      },
      include: { items: true, payments: true, deposit: true },
    });

    res.status(201).json({
      reservation: {
        id: reservation.id,
        number: reservation.number,
        status: reservation.status,
        totals: quote.totals,
      },
      payment: {
        id: reservation.payments[0]!.id,
        amountDue: quote.totals.amountDue,
        provider: 'mock',
        testMode: true,
        note: 'Paiement de DEMONSTRATION. Utilisez outcome="success" ou "decline".',
      },
      token: issuedToken,
    });
  }),
);

/** Paiement de demonstration : finalise la reservation. */
checkoutRouter.post(
  '/pay',
  h(async (req, res) => {
    const { reservationId, outcome } = mockPaySchema.parse(req.body);
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { payments: true, deposit: true, user: true },
    });
    if (!reservation) throw notFound('Reservation introuvable');
    if (reservation.status !== 'DRAFT') throw badRequest('Reservation deja finalisee');

    if (req.principal?.kind === 'user' && reservation.userId && reservation.userId !== req.principal.id) {
      throw forbidden();
    }

    const payment = reservation.payments.find((p) => p.kind === 'RENTAL');
    if (!payment) throw badRequest('Aucun paiement en attente');

    if (outcome === 'decline') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', meta: { outcome, testMode: true } as never },
      });
      throw badRequest('Paiement refuse (carte de demonstration "decline").');
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        externalRef: `mock_${Date.now()}`,
        meta: { outcome, testMode: true } as never,
      },
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CONFIRMED' },
    });

    // Clôture du panier associe (nouvelle cle a la prochaine visite).
    await prisma.cart.deleteMany({ where: { userId: reservation.userId ?? '___' } });

    const invoice = await generateInvoice(reservation.id, 'RESERVATION');

    if (reservation.userId) {
      const tpl = NOTIF_TEMPLATES.RESERVATION_CONFIRMED({ number: reservation.number });
      await notify({
        userId: reservation.userId,
        type: 'RESERVATION_CONFIRMED',
        title: tpl.title,
        body: tpl.body,
        data: { reservationId: reservation.id, number: reservation.number },
      });
    }

    res.json({
      status: 'CONFIRMED',
      reservationId: reservation.id,
      number: reservation.number,
      qrToken: reservation.qrToken,
      qrDataUrl: await qrDataUrl(reservation.qrToken),
      invoiceNumber: invoice.number,
      fulfilment: {
        mode: reservation.fulfilmentMode,
        slot: reservation.slot,
        address: reservation.address,
      },
    });
  }),
);
