import { Router } from 'express';
import { BRAND } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { h } from '../lib/http.js';
import { getSettings } from '../lib/settings.js';

export const publicRouter = Router();

/** Parametres publics (sous-ensemble non sensible). */
publicRouter.get(
  '/config',
  h(async (_req, res) => {
    const s = await getSettings();
    res.json({
      brand: BRAND,
      company: s.company,
      vatRate: s.vatRate,
      currency: s.currency,
      minLeadTimeHours: s.minLeadTimeHours,
      sameDayCutoffHour: s.sameDayCutoffHour,
      deliveryBaseFee: s.deliveryBaseFee,
      deliveryFreeThreshold: s.deliveryFreeThreshold,
      demo: true,
    });
  }),
);

publicRouter.get(
  '/content/:key',
  h(async (req, res) => {
    const locale = String(req.query.locale ?? 'fr');
    const row =
      (await prisma.content.findUnique({
        where: { key_locale: { key: req.params.key, locale } },
      })) ??
      (await prisma.content.findUnique({
        where: { key_locale: { key: req.params.key, locale: 'fr' } },
      }));
    if (!row) return res.json({ content: null });
    res.json({ content: row });
  }),
);

publicRouter.get(
  '/content',
  h(async (_req, res) => {
    res.json({ content: await prisma.content.findMany() });
  }),
);

publicRouter.post(
  '/delivery/check',
  h(async (req, res) => {
    const postalCode = String(req.body?.postalCode ?? '');
    const zones = await prisma.deliveryZone.findMany({ where: { active: true } });
    const zone = zones.find((z) =>
      (z.postalPrefixes as string[]).some((p) => postalCode.startsWith(p)),
    );
    res.json({
      postalCode,
      served: zones.length === 0 ? true : Boolean(zone),
      zone: zone ? { name: zone.name, baseFee: zone.baseFee, perKm: zone.perKm } : null,
    });
  }),
);

/** Recherche minimale d'une reservation (borne : "J'ai deja une reservation" / scan QR). */
publicRouter.post(
  '/reservation/lookup',
  h(async (req, res) => {
    const token = String(req.body?.token ?? '').trim();
    if (!token) return res.status(400).json({ error: { message: 'Code requis' } });
    const r = await prisma.reservation.findFirst({
      where: { OR: [{ qrToken: token }, { number: token }] },
      include: { items: true, user: true, deliveries: true },
    });
    if (!r) return res.status(404).json({ error: { message: 'Reservation introuvable' } });
    res.json({
      reservation: {
        number: r.number,
        status: r.status,
        firstName: r.user?.firstName ?? (r.contact as { firstName?: string })?.firstName ?? null,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        fulfilmentMode: r.fulfilmentMode,
        slot: r.slot,
        items: r.items.map((i) => ({ name: i.nameSnapshot, quantity: i.quantity, kind: i.kind })),
      },
    });
  }),
);

publicRouter.post(
  '/contact',
  h(async (req, res) => {
    const { name, email, message, phone } = req.body ?? {};
    if (!email || !message) return res.status(400).json({ error: { message: 'email et message requis' } });
    const ticket = await prisma.supportTicket.create({
      data: {
        subject: `Contact site : ${name ?? email}`,
        message: `${message}\n\nTel: ${phone ?? '-'} / Email: ${email}`,
      },
    });
    res.status(201).json({ ok: true, ticketId: ticket.id });
  }),
);
