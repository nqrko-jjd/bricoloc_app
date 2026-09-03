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
import { env } from '../env.js';
import { mollieEnabled, mollieTestMode, createPayment, getPayment } from '../lib/mollie.js';

export const checkoutRouter = Router();
checkoutRouter.use(attachPrincipal);

/**
 * Finalise le paiement du loyer : marque PAID, confirme la réservation, vide le
 * panier, génère la facture, notifie. Idempotent (ne refait rien si déjà CONFIRMED).
 * Partagé par le paiement mock et le webhook Mollie.
 */
async function finalizeRental(reservationId: string, externalRef: string, meta: Record<string, unknown>) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { payments: true, user: true },
  });
  if (!reservation) throw notFound('Réservation introuvable');
  const payment = reservation.payments.find((p) => p.kind === 'RENTAL');
  if (!payment) throw badRequest('Aucun paiement de location');

  if (reservation.status !== 'DRAFT') {
    // déjà finalisée (double webhook, retour navigateur…)
    const invoice = await prisma.invoice.findFirst({
      where: { reservationId: reservation.id, kind: 'RESERVATION' },
    });
    return { reservation, invoiceNumber: invoice?.number ?? null, alreadyDone: true };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'PAID', externalRef, meta: meta as never },
  });
  await prisma.reservation.update({ where: { id: reservation.id }, data: { status: 'CONFIRMED' } });
  if (reservation.userId) {
    await prisma.cart.deleteMany({ where: { userId: reservation.userId } });
  }
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
  return { reservation, invoiceNumber: invoice.number, alreadyDone: false };
}

async function confirmedPayload(reservationId: string, invoiceNumber: string | null) {
  const r = await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
  return {
    status: r.status,
    reservationId: r.id,
    number: r.number,
    qrToken: r.qrToken,
    qrDataUrl: await qrDataUrl(r.qrToken),
    invoiceNumber,
    fulfilment: {
      mode: r.fulfilmentMode,
      slot: r.slot,
      address: r.address,
      pickupPoint: r.pickupPoint,
    },
  };
}

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

    // La borne (KIOSK) : commande en personne, contrôle d'identité physique par
    // le staff -> pas de compte ni de pièce d'identité numérique exigés.
    const isKiosk = data.channel === 'KIOSK';

    // Compte obligatoire (hors borne) : connecté, ou créé ici avec mot de passe.
    if (!uid) {
      const account = req.body?.account as { password?: string } | undefined;
      if (!data.contact) throw badRequest('Coordonnees requises pour finaliser la commande');
      if (!isKiosk && !account?.password) {
        throw badRequest('Un compte est requis pour commander (création ou connexion).');
      }
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

    // Pièce d'identité obligatoire pour valider la commande (hors borne).
    if (!isKiosk && uid) {
      const buyer = await prisma.user.findUnique({
        where: { id: uid },
        select: { idDocStatus: true },
      });
      if (!buyer || buyer.idDocStatus === 'NONE' || buyer.idDocStatus === 'REJECTED') {
        return res.status(409).json({
          error: {
            code: 'ID_REQUIRED',
            message:
              buyer?.idDocStatus === 'REJECTED'
                ? 'Votre pièce d’identité a été refusée. Merci d’en envoyer une nouvelle.'
                : 'Une copie de votre carte d’identité est nécessaire pour finaliser la commande.',
          },
          token: issuedToken,
        });
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

    // Point d'enlèvement (Click & Collect).
    let pickupPointSnap: Record<string, unknown> | null = null;
    if (data.fulfilment.mode === 'PICKUP') {
      const points = (Array.isArray(settings.pickupPoints) ? settings.pickupPoints : []) as {
        id: string;
        name: string;
        line1: string;
        postalCode: string;
        city: string;
        isMain?: boolean;
        transferHours?: number;
        active?: boolean;
      }[];
      const active = points.filter((p) => p.active !== false);
      const chosen =
        active.find((p) => p.id === data.fulfilment.pickupPointId) ??
        active.find((p) => p.isMain) ??
        active[0] ??
        null;
      if (chosen) {
        pickupPointSnap = {
          id: chosen.id,
          name: chosen.name,
          line1: chosen.line1,
          postalCode: chosen.postalCode,
          city: chosen.city,
          transferHours: Number(chosen.transferHours ?? 0),
        };
      }
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
        pickupPoint: pickupPointSnap as never,
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
            packRef: l.packRef ?? null,
          })),
        },
        payments: {
          create: {
            kind: 'RENTAL',
            amount: quote.totals.totalTVAC,
            status: 'PENDING',
            provider: mollieEnabled() ? 'mollie' : 'mock',
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
        provider: mollieEnabled() ? 'mollie' : 'mock',
        testMode: mollieEnabled() ? mollieTestMode() : true,
        note: mollieEnabled()
          ? 'Paiement via Mollie.'
          : 'Paiement de DEMONSTRATION. Utilisez outcome="success" ou "decline".',
      },
      token: issuedToken,
    });
  }),
);

/** Paiement de démonstration (mock / borne) : finalise la réservation. */
checkoutRouter.post(
  '/pay',
  h(async (req, res) => {
    const { reservationId, outcome } = mockPaySchema.parse(req.body);
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { payments: true, user: true },
    });
    if (!reservation) throw notFound('Réservation introuvable');
    if (req.principal?.kind === 'user' && reservation.userId && reservation.userId !== req.principal.id) {
      throw forbidden();
    }
    if (reservation.status !== 'DRAFT') throw badRequest('Réservation déjà finalisée');

    const payment = reservation.payments.find((p) => p.kind === 'RENTAL');
    if (!payment) throw badRequest('Aucun paiement en attente');

    if (outcome === 'decline') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', meta: { outcome, testMode: true } as never },
      });
      throw badRequest('Paiement refusé (carte de démonstration « decline »).');
    }

    const { invoiceNumber } = await finalizeRental(reservationId, `mock_${Date.now()}`, {
      outcome,
      testMode: true,
    });
    res.json(await confirmedPayload(reservationId, invoiceNumber));
  }),
);

/* ───────────────────────── Mollie ───────────────────────── */

/** Crée le paiement Mollie et renvoie l'URL de checkout à ouvrir. */
checkoutRouter.post(
  '/mollie/start',
  h(async (req, res) => {
    if (!mollieEnabled()) throw badRequest('Mollie non configuré');
    const reservationId = String(req.body?.reservationId ?? '');
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { payments: true },
    });
    if (!reservation) throw notFound('Réservation introuvable');
    if (req.principal?.kind === 'user' && reservation.userId && reservation.userId !== req.principal.id) {
      throw forbidden();
    }
    if (reservation.status !== 'DRAFT') throw badRequest('Réservation déjà finalisée');
    const payment = reservation.payments.find((p) => p.kind === 'RENTAL');
    if (!payment) throw badRequest('Aucun paiement en attente');

    const local = /localhost|127\.0\.0\.1/.test(env.mollieWebhookUrl) || env.mollieWebhookUrl.startsWith('http://');
    const mp = await createPayment({
      amount: payment.amount,
      description: `BRICOLOC ${reservation.number}`,
      redirectUrl: `${env.siteUrl.replace(/\/$/, '')}/commande/retour?r=${reservation.id}`,
      webhookUrl: local ? undefined : env.mollieWebhookUrl,
      metadata: { reservationId: reservation.id, paymentId: payment.id, number: reservation.number },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { provider: 'mollie', externalRef: mp.id, meta: { mollieStatus: mp.status } as never },
    });

    res.json({ checkoutUrl: mp._links?.checkout?.href ?? null, molliePaymentId: mp.id });
  }),
);

/** Webhook Mollie : appelé par Mollie quand le statut du paiement change. */
checkoutRouter.post(
  '/mollie/webhook',
  h(async (req, res) => {
    const id = String(req.body?.id ?? '');
    if (!id || !mollieEnabled()) return res.status(200).end();
    try {
      const mp = await getPayment(id);
      const reservationId = String(mp.metadata?.reservationId ?? '');
      if (reservationId && mp.status === 'paid') {
        await finalizeRental(reservationId, mp.id, { provider: 'mollie', mollieStatus: mp.status });
      } else if (reservationId && (mp.status === 'failed' || mp.status === 'expired' || mp.status === 'canceled')) {
        await prisma.payment.updateMany({
          where: { externalRef: mp.id, kind: 'RENTAL' },
          data: { status: 'FAILED', meta: { mollieStatus: mp.status } as never },
        });
      }
    } catch {
      /* on répond 200 quand même : Mollie réessaiera si besoin via le prochain event */
    }
    res.status(200).end();
  }),
);

/**
 * Statut de la réservation pour la page de retour. Interroge aussi Mollie
 * directement (ne dépend pas que du webhook — utile en dev / si le webhook tarde).
 */
checkoutRouter.get(
  '/mollie/status',
  h(async (req, res) => {
    const reservationId = String(req.query.r ?? '');
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { payments: true },
    });
    if (!reservation) throw notFound('Réservation introuvable');
    const payment = reservation.payments.find((p) => p.kind === 'RENTAL');

    if (reservation.status === 'DRAFT' && payment?.externalRef && mollieEnabled()) {
      try {
        const mp = await getPayment(payment.externalRef);
        if (mp.status === 'paid') {
          await finalizeRental(reservationId, mp.id, { provider: 'mollie', mollieStatus: mp.status });
        } else if (['failed', 'expired', 'canceled'].includes(mp.status)) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED', meta: { mollieStatus: mp.status } as never },
          });
        }
      } catch {
        /* ignore */
      }
    }

    const fresh = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: { payments: true },
    });
    const rental = fresh.payments.find((p) => p.kind === 'RENTAL');
    const paid = fresh.status === 'CONFIRMED';
    const invoice = paid
      ? await prisma.invoice.findFirst({ where: { reservationId, kind: 'RESERVATION' } })
      : null;

    res.json({
      ...(paid ? await confirmedPayload(reservationId, invoice?.number ?? null) : { number: fresh.number }),
      status: fresh.status,
      paid,
      failed: rental?.status === 'FAILED',
    });
  }),
);
