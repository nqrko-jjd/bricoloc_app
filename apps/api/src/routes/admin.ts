import { Router } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import {
  SOURCE_LOCALE,
  createStaffSchema,
  moderateReviewSchema,
  upsertCategorySchema,
  upsertContentSchema,
  upsertDeliveryZoneSchema,
  upsertProductSchema,
  upsertPromoSchema,
  upsertSettingSchema,
  upsertUnitSchema,
} from '@bricoloc/shared';
import { prisma } from '../db.js';
import { badRequest, h, notFound } from '../lib/http.js';
import { attachPrincipal, hashPassword, requireStaff } from '../lib/auth.js';
import { setSetting, getSettings } from '../lib/settings.js';
import { newQrToken, qrDataUrl } from '../lib/qr.js';
import { productInclude, serializeProductDetail } from '../lib/serialize.js';
import { generateInvoice } from '../lib/invoice.js';
import { syncContentTranslations } from '../lib/i18n-content.js';
import { recomputeReservation } from '../lib/quote.js';
import { buildLoiseletRequest } from '../lib/loiselet.js';
import { randomBytes } from 'node:crypto';

export const adminRouter = Router();
adminRouter.use(attachPrincipal, requireStaff());

/* -------------------------- Tableau de bord -------------------------- */
const DAY = 86_400_000;
function dayBounds(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const start = new Date(d.getTime() + offset * DAY);
  return { start, end: new Date(start.getTime() + DAY) };
}

adminRouter.get(
  '/dashboard',
  h(async (_req, res) => {
    const today = dayBounds(0);
    const in7 = new Date(Date.now() + 7 * DAY);
    const last14Start = new Date(Date.now() - 14 * DAY);

    const [
      products,
      unitsTotal,
      unitsOut,
      unitsMaint,
      customers,
      reservations,
      openTickets,
      damages,
      pendingSupplier,
      revenue,
      revenue30,
      newRes14,
      pickupsToday,
      returnsToday,
      overdue,
      recentReservations,
      pendingReviews,
      maintDue,
    ] = await Promise.all([
      prisma.product.count({ where: { published: true } }),
      prisma.productUnit.count(),
      prisma.productUnit.count({ where: { state: 'RENTED' } }),
      prisma.productUnit.count({ where: { state: 'MAINTENANCE' } }),
      prisma.user.count(),
      prisma.reservation.groupBy({ by: ['status'], _count: true }),
      prisma.supportTicket.count({ where: { status: { not: 'CLOSED' } } }),
      prisma.damage.count({ where: { resolved: false } }),
      prisma.reservation.count({ where: { status: 'PENDING_SUPPLIER' } }),
      prisma.payment.aggregate({
        where: { status: 'PAID', kind: { in: ['RENTAL', 'EXTRA'] } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'PAID',
          kind: { in: ['RENTAL', 'EXTRA'] },
          createdAt: { gte: new Date(Date.now() - 30 * DAY) },
        },
        _sum: { amount: true },
      }),
      prisma.reservation.findMany({
        where: { createdAt: { gte: last14Start } },
        select: { createdAt: true, totals: true },
      }),
      prisma.reservation.findMany({
        where: {
          fulfilmentMode: 'PICKUP',
          status: { in: ['CONFIRMED', 'PREPARING', 'READY'] },
          periodStart: { gte: today.start, lt: today.end },
        },
        include: { user: true, items: true },
        orderBy: { periodStart: 'asc' },
      }),
      prisma.reservation.findMany({
        where: {
          status: { in: ['OUT', 'RETURN_PENDING'] },
          periodEnd: { gte: today.start, lt: today.end },
        },
        include: { user: true, items: true },
        orderBy: { periodEnd: 'asc' },
      }),
      prisma.reservation.findMany({
        where: { status: { in: ['OUT', 'RETURN_PENDING'] }, periodEnd: { lt: today.start } },
        include: { user: true },
        orderBy: { periodEnd: 'asc' },
      }),
      prisma.reservation.findMany({
        where: { status: 'CONFIRMED', periodStart: { lte: in7 } },
        include: { user: true, items: true },
        orderBy: { periodStart: 'asc' },
        take: 30,
      }),
      prisma.review.count({ where: { status: 'PENDING' } }),
      prisma.productUnit.count({
        where: { nextMaintenanceAt: { lte: new Date(Date.now() + 7 * DAY) }, state: { not: 'RETIRED' } },
      }),
    ]);

    // Série CA / jour sur 14 jours (à partir du snapshot totals).
    const byDay: Record<string, { revenue: number; count: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const k = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
      byDay[k] = { revenue: 0, count: 0 };
    }
    for (const r of newRes14) {
      const k = r.createdAt.toISOString().slice(0, 10);
      if (!byDay[k]) continue;
      byDay[k].count += 1;
      const t = r.totals as { totalTVAC?: number } | null;
      byDay[k].revenue += Number(t?.totalTVAC ?? 0);
    }

    const occupancy = unitsTotal ? Math.round((unitsOut / unitsTotal) * 100) : 0;

    res.json({
      kpi: {
        products,
        unitsTotal,
        unitsOut,
        unitsMaint,
        occupancy,
        customers,
        revenuePaid: revenue._sum.amount ?? 0,
        revenue30: revenue30._sum.amount ?? 0,
        newRes14: newRes14.length,
      },
      alerts: {
        damages,
        openTickets,
        pendingSupplier,
        overdue: overdue.length,
        maintDue,
        pendingReviews,
        toPrepareSoon: recentReservations.length,
      },
      series: Object.entries(byDay).map(([date, v]) => ({ date, ...v })),
      reservationsByStatus: reservations,
      queue: {
        pickupsToday: pickupsToday.map(slimRes),
        returnsToday: returnsToday.map(slimRes),
        overdue: overdue.map(slimRes),
      },
    });
  }),
);

function slimRes(r: {
  id: string;
  number: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  fulfilmentMode: string;
  user?: { firstName: string; lastName: string } | null;
  contact?: unknown;
  items?: { quantity: number; nameSnapshot: string }[];
}) {
  const contact = r.contact as { firstName?: string; lastName?: string } | null;
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    fulfilmentMode: r.fulfilmentMode,
    customer: r.user
      ? `${r.user.firstName} ${r.user.lastName}`
      : contact
        ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || 'Invité'
        : 'Invité',
    items: (r.items ?? []).map((i) => `${i.quantity}× ${i.nameSnapshot}`),
  };
}

/* -------------------------- Categories -------------------------- */
adminRouter.get(
  '/categories',
  h(async (_req, res) => {
    res.json({ categories: await prisma.category.findMany({ orderBy: { position: 'asc' } }) });
  }),
);
adminRouter.post(
  '/categories',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const data = upsertCategorySchema.parse(req.body);
    const cat = await prisma.category.upsert({
      where: { slug: data.slug },
      create: data,
      update: data,
    });
    res.json({ category: cat });
  }),
);
adminRouter.delete(
  '/categories/:slug',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    await prisma.category.delete({ where: { slug: req.params.slug } });
    res.status(204).end();
  }),
);

/* -------------------------- Produits -------------------------- */
adminRouter.get(
  '/products',
  h(async (req, res) => {
    const rows = await prisma.product.findMany({
      where: req.query.kind ? { kind: String(req.query.kind) } : {},
      include: productInclude,
      orderBy: { name: 'asc' },
    });
    res.json({ products: rows.map((r) => serializeProductDetail(r)) });
  }),
);

adminRouter.post(
  '/products',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const data = upsertProductSchema.parse(req.body);
    const category = data.categorySlug
      ? await prisma.category.findUnique({ where: { slug: data.categorySlug } })
      : null;

    const base = {
      name: data.name,
      kind: data.kind,
      categoryId: category?.id ?? null,
      shortDescription: data.shortDescription ?? null,
      description: data.description ?? null,
      recommendedUses: data.recommendedUses as never,
      specs: data.specs as never,
      includedAccessories: data.includedAccessories as never,
      images: data.images as never,
      manualUrl: data.manualUrl ?? null,
      documents: data.documents as never,
      dailyPrice: data.dailyPrice,
      weekendPrice: data.weekendPrice ?? null,
      weekPrice: data.weekPrice ?? null,
      monthPrice: data.monthPrice ?? null,
      tiers: data.tiers as never,
      proDiscountPct: data.proDiscountPct ?? null,
      deposit: data.deposit,
      isConsumable: data.kind === 'CONSUMABLE',
      isDemo: data.isDemo,
      published: data.published,
    };
    const product = await prisma.product.upsert({
      where: { slug: data.slug },
      create: { slug: data.slug, ...base },
      update: base,
    });

    // Reconstruit les liens.
    await prisma.productLink.deleteMany({ where: { fromId: product.id } });
    const links: { fromId: string; toId: string; type: string; quantity: number }[] = [];
    for (const id of data.recommendedAccessoryIds)
      links.push({ fromId: product.id, toId: id, type: 'ACCESSORY', quantity: 1 });
    for (const id of data.consumableIds)
      links.push({ fromId: product.id, toId: id, type: 'CONSUMABLE', quantity: 1 });
    for (const id of data.ppeIds)
      links.push({ fromId: product.id, toId: id, type: 'PPE', quantity: 1 });
    for (const id of data.complementaryProductIds)
      links.push({ fromId: product.id, toId: id, type: 'COMPLEMENTARY', quantity: 1 });
    for (const pi of data.packItems)
      links.push({ fromId: product.id, toId: pi.productId, type: 'PACK_ITEM', quantity: pi.quantity });
    if (links.length)
      await prisma.productLink.createMany({ data: links });

    const full = await prisma.product.findUnique({
      where: { id: product.id },
      include: productInclude,
    });
    res.json({ product: serializeProductDetail(full!) });
  }),
);

adminRouter.delete(
  '/products/:slug',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    await prisma.product.delete({ where: { slug: req.params.slug } });
    res.status(204).end();
  }),
);

/* -------------------------- Exemplaires -------------------------- */
adminRouter.get(
  '/units',
  h(async (req, res) => {
    const where = req.query.productId ? { productId: String(req.query.productId) } : {};
    const rows = await prisma.productUnit.findMany({
      where,
      include: {
        product: true,
        reservationUnits: {
          include: { reservationItem: { include: { reservation: true } } },
          orderBy: { assignedAt: 'desc' },
        },
        damages: true,
        maintenances: { orderBy: { performedAt: 'desc' } },
      },
      orderBy: { assetTag: 'asc' },
    });
    res.json({ units: rows });
  }),
);

adminRouter.post(
  '/units',
  requireStaff('RESPONSABLE', 'TECHNICIEN'),
  h(async (req, res) => {
    const data = upsertUnitSchema.parse(req.body);
    const existing = await prisma.productUnit.findUnique({ where: { assetTag: data.assetTag } });
    const payload = {
      productId: data.productId,
      serialNumber: data.serialNumber ?? null,
      state: data.state,
      notes: data.notes ?? null,
      images: data.images as never,
      nextMaintenanceAt: data.nextMaintenanceAt ? new Date(data.nextMaintenanceAt) : null,
    };
    const unit = existing
      ? await prisma.productUnit.update({ where: { assetTag: data.assetTag }, data: payload })
      : await prisma.productUnit.create({
          data: { ...payload, assetTag: data.assetTag, qrToken: newQrToken('U') },
        });
    res.json({ unit });
  }),
);

adminRouter.delete(
  '/units/:id',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    await prisma.productUnit.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

/** Crée N exemplaires d'un coup (atelier étiquettes). */
adminRouter.post(
  '/units/bulk',
  requireStaff('RESPONSABLE', 'TECHNICIEN'),
  h(async (req, res) => {
    const { productId, count } = req.body ?? {};
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw notFound('Produit introuvable');
    const n = Math.min(50, Math.max(1, Number(count ?? 1)));
    const prefix = product.slug.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const start = await prisma.productUnit.count({ where: { productId } });
    const created = [];
    for (let i = 0; i < n; i++) {
      created.push(
        await prisma.productUnit.create({
          data: {
            productId,
            assetTag: `${prefix}-${String(start + i + 1).padStart(3, '0')}`,
            qrToken: newQrToken('U'),
            state: 'AVAILABLE',
          },
        }),
      );
    }
    res.status(201).json({ units: created });
  }),
);

/** Données d'étiquettes : QR (data URL) + code-barres pour une liste d'exemplaires ou un produit. */
adminRouter.post(
  '/labels',
  h(async (req, res) => {
    const { unitIds, productId } = req.body ?? {};
    const units = await prisma.productUnit.findMany({
      where: unitIds?.length ? { id: { in: unitIds } } : productId ? { productId } : { id: 'none' },
      include: { product: { select: { name: true, slug: true } } },
      orderBy: { assetTag: 'asc' },
    });
    const labels = await Promise.all(
      units.map(async (u) => ({
        unitId: u.id,
        assetTag: u.assetTag,
        barcode: u.barcode ?? u.assetTag,
        productName: u.product.name,
        qrToken: u.qrToken,
        qrDataUrl: await qrDataUrl(u.qrToken),
      })),
    );
    res.json({ labels });
  }),
);

/** Change direct de l'état / notes d'un exemplaire (menu contextuel back-office). */
adminRouter.patch(
  '/units/:id',
  requireStaff('RESPONSABLE', 'TECHNICIEN', 'COMPTOIR'),
  h(async (req, res) => {
    const { state, notes, serialNumber, sku, barcode, immobilisedUntil } = req.body ?? {};
    const unit = await prisma.productUnit.update({
      where: { id: req.params.id! },
      data: {
        state: state ?? undefined,
        notes: notes === undefined ? undefined : notes,
        serialNumber: serialNumber === undefined ? undefined : serialNumber,
        sku: sku === undefined ? undefined : sku,
        barcode: barcode === undefined ? undefined : (barcode || null),
        immobilisedUntil:
          immobilisedUntil === undefined ? undefined : immobilisedUntil ? new Date(immobilisedUntil) : null,
      },
    });
    res.json({ unit });
  }),
);

/* -------------------------- Maintenance -------------------------- */
adminRouter.get(
  '/units/:id/history',
  h(async (req, res) => {
    const [maintenances, damages, assignments] = await Promise.all([
      prisma.maintenance.findMany({ where: { unitId: req.params.id! }, orderBy: { performedAt: 'desc' } }),
      prisma.damage.findMany({ where: { unitId: req.params.id! }, orderBy: { createdAt: 'desc' } }),
      prisma.reservationUnit.findMany({
        where: { unitId: req.params.id! },
        include: { reservationItem: { include: { reservation: { select: { number: true, status: true } } } } },
        orderBy: { assignedAt: 'desc' },
        take: 20,
      }),
    ]);
    res.json({ maintenances, damages, assignments });
  }),
);

adminRouter.post(
  '/units/:id/maintenance',
  requireStaff('TECHNICIEN', 'RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const { type, description, cost, startAt, endAt, blocksAvailability, nextAt } = req.body ?? {};
    const unit = await prisma.productUnit.findUnique({ where: { id: req.params.id! } });
    if (!unit) throw notFound();

    const start = startAt ? new Date(startAt) : new Date();
    const end = endAt ? new Date(endAt) : null;
    const blocks = blocksAvailability !== false;
    const activeNow = blocks && start <= new Date() && (!end || end >= new Date());

    const m = await prisma.maintenance.create({
      data: {
        unitId: unit.id,
        type: type ?? 'ENTRETIEN',
        status: end && end < new Date() ? 'DONE' : 'PLANNED',
        description: description ?? 'Entretien',
        cost: Number(cost ?? 0),
        startAt: start,
        endAt: end,
        blocksAvailability: blocks,
        nextAt: nextAt ? new Date(nextAt) : null,
        staffId: req.principal?.kind === 'staff' ? req.principal.id : undefined,
      },
    });

    await prisma.productUnit.update({
      where: { id: unit.id },
      data: {
        // Immobilise l'exemplaire tant que la période de maintenance court.
        state: activeNow ? 'MAINTENANCE' : unit.state === 'MAINTENANCE' ? 'AVAILABLE' : unit.state,
        immobilisedUntil: activeNow ? (end ?? new Date(Date.now() + 30 * 86_400_000)) : unit.immobilisedUntil,
        nextMaintenanceAt: nextAt ? new Date(nextAt) : unit.nextMaintenanceAt,
      },
    });
    res.status(201).json({ maintenance: m });
  }),
);

/** Signale un dommage sur un exemplaire (hors retour). */
adminRouter.post(
  '/units/:id/damage',
  requireStaff('TECHNICIEN', 'RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const { description, feeHT } = req.body ?? {};
    const unit = await prisma.productUnit.findUnique({ where: { id: req.params.id! } });
    if (!unit) throw notFound();
    const damage = await prisma.damage.create({
      data: {
        unitId: unit.id,
        description: description ?? 'Dommage constaté',
        feeHT: Number(feeHT ?? 0),
      },
    });
    if (unit.state === 'AVAILABLE') {
      await prisma.productUnit.update({ where: { id: unit.id }, data: { state: 'DAMAGED' } });
    }
    res.status(201).json({ damage });
  }),
);

/* -------------------------- Reservations -------------------------- */
adminRouter.get(
  '/reservations',
  h(async (req, res) => {
    const where = req.query.status ? { status: String(req.query.status) } : {};
    const rows = await prisma.reservation.findMany({
      where,
      include: { user: true, items: true, payments: true, deposit: true, deliveries: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ reservations: rows });
  }),
);

adminRouter.get(
  '/reservations/:id',
  h(async (req, res) => {
    const r = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
        items: { include: { product: true, units: { include: { unit: true } } } },
        payments: true,
        deposit: true,
        deliveries: { include: { driver: true } },
        pickup: true,
        return: true,
        invoices: true,
        damages: true,
        tickets: true,
      },
    });
    if (!r) throw notFound();
    res.json({ reservation: r });
  }),
);

/* ----- Partenaire Loiselet : demande de location + confirmation ----- */

/** Construit la demande structurée (destinataires config + corps + mailto). Ne modifie rien. */
adminRouter.get(
  '/reservations/:id/loiselet-request',
  h(async (req, res) => {
    const r = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: { user: true, items: { include: { product: true } } },
    });
    if (!r) throw notFound();
    const request = buildLoiseletRequest(r, await getSettings());
    if (request.itemCount === 0) throw badRequest('Aucune ligne Loiselet dans cette réservation.');
    res.json({ request });
  }),
);

/** Marque la demande comme envoyée (l'e-mail réel part de la messagerie de l'équipe). */
adminRouter.post(
  '/reservations/:id/loiselet-request',
  requireStaff('RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const r = await prisma.reservation.update({
      where: { id: req.params.id },
      data: { supplierStatus: 'REQUESTED', supplierRequestSentAt: new Date() },
    });
    res.json({ reservation: r });
  }),
);

/** Réponse de Loiselet : confirmée (→ CONFIRMED) ou refusée (→ CANCELLED). */
adminRouter.post(
  '/reservations/:id/supplier-status',
  requireStaff('RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const outcome = String(req.body?.outcome ?? '');
    if (!['CONFIRMED', 'DECLINED'].includes(outcome)) throw badRequest('Issue invalide.');
    const confirmed = outcome === 'CONFIRMED';
    const r = await prisma.reservation.update({
      where: { id: req.params.id },
      data: {
        supplierStatus: outcome,
        supplierConfirmedAt: confirmed ? new Date() : null,
        status: confirmed ? 'CONFIRMED' : 'CANCELLED',
      },
    });
    res.json({ reservation: r });
  }),
);

adminRouter.patch(
  '/reservations/:id',
  requireStaff('RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const { status, note, periodStart, periodEnd, fulfilmentMode, address, slot } = req.body ?? {};
    const r = await prisma.reservation.update({
      where: { id: req.params.id },
      data: {
        status: status ?? undefined,
        note: note === undefined ? undefined : note,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
        fulfilmentMode: fulfilmentMode ?? undefined,
        address: address === undefined ? undefined : (address as never),
        slot: slot === undefined ? undefined : slot,
      },
    });
    if (periodStart || periodEnd || fulfilmentMode || address !== undefined) {
      await recomputeReservation(r.id);
    }
    res.json({ reservation: await prisma.reservation.findUnique({ where: { id: r.id } }) });
  }),
);

/** Periode exceptionnelle pour UNE ligne (cas admin, sans impacter le parcours client). */
adminRouter.patch(
  '/reservation-items/:id/period',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const { periodStart, periodEnd } = req.body ?? {};
    const item = await prisma.reservationItem.update({
      where: { id: req.params.id },
      data: {
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
      },
    });
    await recomputeReservation(item.reservationId);
    res.json({ item });
  }),
);

/* ----- Éditeur de réservation : lignes, frais, recalcul ----- */

/** Ajoute une ligne à une réservation existante. */
adminRouter.post(
  '/reservations/:id/items',
  requireStaff('RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const { productSlug, productId, quantity } = req.body ?? {};
    const product = await prisma.product.findFirst({
      where: productId ? { id: productId } : { slug: productSlug },
    });
    if (!product) throw notFound('Produit introuvable');
    const qty = Math.max(1, Number(quantity ?? 1));
    const existing = await prisma.reservationItem.findFirst({
      where: { reservationId: req.params.id!, productId: product.id },
    });
    if (existing) {
      await prisma.reservationItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + qty },
      });
    } else {
      await prisma.reservationItem.create({
        data: {
          reservationId: req.params.id!,
          productId: product.id,
          nameSnapshot: product.name,
          kind: product.kind,
          quantity: qty,
          unitPriceHT: product.dailyPrice,
          lineHT: product.dailyPrice * qty,
          depositUnit: product.deposit,
        },
      });
    }
    await recomputeReservation(req.params.id!);
    res.status(201).json({ ok: true });
  }),
);

adminRouter.patch(
  '/reservation-items/:id',
  requireStaff('RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const { quantity, unitPriceOverride } = req.body ?? {};
    const item = await prisma.reservationItem.update({
      where: { id: req.params.id! },
      data: {
        quantity: quantity === undefined ? undefined : Math.max(1, Number(quantity)),
        ...(unitPriceOverride !== undefined
          ? { unitPriceHT: Number(unitPriceOverride), appliedRule: 'MANUAL' }
          : {}),
      },
    });
    await recomputeReservation(item.reservationId);
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/reservation-items/:id',
  requireStaff('RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const item = await prisma.reservationItem.delete({ where: { id: req.params.id! } });
    await recomputeReservation(item.reservationId);
    res.status(204).end();
  }),
);

/** Frais / remise manuels + recalcul complet. */
adminRouter.post(
  '/reservations/:id/recompute',
  requireStaff('RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const { extraFeesHT, extraDiscountHT } = req.body ?? {};
    await recomputeReservation(req.params.id!, {
      extraFeesHT: extraFeesHT === undefined ? undefined : Number(extraFeesHT),
      extraDiscountHT: extraDiscountHT === undefined ? undefined : Number(extraDiscountHT),
    });
    const r = await prisma.reservation.findUnique({ where: { id: req.params.id! } });
    res.json({ totals: r?.totals ?? null });
  }),
);

adminRouter.post(
  '/reservations/:id/invoice',
  requireStaff('COMPTABILITE', 'RESPONSABLE'),
  h(async (req, res) => {
    const kind = req.body?.kind === 'FINAL' ? 'FINAL' : 'RESERVATION';
    const invoice = await generateInvoice(req.params.id, kind);
    res.status(201).json({ invoice });
  }),
);

/* -------------------------- Clients -------------------------- */
adminRouter.get(
  '/customers',
  h(async (req, res) => {
    const where = req.query.type ? { customerType: String(req.query.type) } : {};
    const rows = await prisma.user.findMany({
      where,
      include: { _count: { select: { reservations: true } }, addresses: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      customers: rows.map(({ passwordHash, ...u }) => {
        void passwordHash;
        return u;
      }),
    });
  }),
);

/** Fiche client complète : coordonnées, adresses, historique, factures, cautions, tickets. */
adminRouter.get(
  '/customers/:id',
  h(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.params.id! },
      include: {
        addresses: true,
        reservations: {
          include: { items: true, deposit: true, invoices: true, payments: true },
          orderBy: { createdAt: 'desc' },
        },
        supportTickets: { orderBy: { createdAt: 'desc' } },
        reviews: { include: { product: { select: { slug: true, name: true } } } },
      },
    });
    if (!u) throw notFound('Client introuvable');
    const { passwordHash, ...safe } = u;
    void passwordHash;
    const spent = u.reservations
      .flatMap((r) => r.payments)
      .filter((p) => p.status === 'PAID' && ['RENTAL', 'EXTRA'].includes(p.kind))
      .reduce((s, p) => s + p.amount, 0);
    res.json({
      customer: safe,
      stats: {
        reservations: u.reservations.length,
        spent: Math.round(spent * 100) / 100,
        openTickets: u.supportTickets.filter((t) => t.status !== 'CLOSED').length,
      },
    });
  }),
);

/** Note interne sur un client (stockée dans un Setting dédié `customer.note.<id>`). */
adminRouter.put(
  '/customers/:id/note',
  requireStaff('RESPONSABLE', 'COMPTABILITE', 'COMPTOIR'),
  h(async (req, res) => {
    await setSetting(`customer.note.${req.params.id}`, { text: String(req.body?.text ?? ''), at: new Date().toISOString() });
    res.json({ ok: true });
  }),
);

adminRouter.patch(
  '/customers/:id',
  requireStaff('RESPONSABLE', 'COMPTABILITE'),
  h(async (req, res) => {
    const { customerType, negotiatedDiscountPct, companyName, vatNumber, firstName, lastName, phone } =
      req.body ?? {};
    const u = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        customerType: customerType ?? undefined,
        negotiatedDiscountPct:
          negotiatedDiscountPct === undefined ? undefined : Number(negotiatedDiscountPct),
        companyName: companyName === undefined ? undefined : companyName,
        vatNumber: vatNumber === undefined ? undefined : vatNumber,
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        phone: phone ?? undefined,
      },
    });
    const { passwordHash, ...safe } = u;
    void passwordHash;
    res.json({ customer: safe });
  }),
);

/** Adresses d'un client (CRUD depuis la fiche). */
adminRouter.post(
  '/customers/:id/addresses',
  requireStaff('RESPONSABLE', 'COMPTABILITE', 'COMPTOIR'),
  h(async (req, res) => {
    const b = req.body ?? {};
    const addr = await prisma.address.create({
      data: {
        userId: req.params.id!,
        label: b.label ?? null,
        line1: String(b.line1 ?? ''),
        line2: b.line2 ?? null,
        postalCode: String(b.postalCode ?? ''),
        city: String(b.city ?? ''),
        country: b.country ?? 'BE',
        isConstructionSite: Boolean(b.isConstructionSite),
        contactName: b.contactName ?? null,
        contactPhone: b.contactPhone ?? null,
      },
    });
    res.status(201).json({ address: addr });
  }),
);
adminRouter.delete(
  '/addresses/:id',
  requireStaff('RESPONSABLE', 'COMPTABILITE'),
  h(async (req, res) => {
    await prisma.address.delete({ where: { id: req.params.id! } });
    res.status(204).end();
  }),
);

/* -------------------------- Promotions -------------------------- */
adminRouter.get(
  '/promotions',
  h(async (_req, res) => {
    res.json({ promotions: await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } }) });
  }),
);
adminRouter.post(
  '/promotions',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const data = upsertPromoSchema.parse(req.body);
    const promo = await prisma.promotion.upsert({
      where: { code: data.code.toUpperCase() },
      create: {
        code: data.code.toUpperCase(),
        kind: data.kind,
        value: data.value,
        active: data.active,
        minTotalHT: data.minTotalHT,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      update: {
        kind: data.kind,
        value: data.value,
        active: data.active,
        minTotalHT: data.minTotalHT,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    res.json({ promotion: promo });
  }),
);

/* -------------------------- Parametres & contenus -------------------------- */
adminRouter.get(
  '/settings',
  h(async (_req, res) => {
    res.json({ settings: await getSettings(true) });
  }),
);
adminRouter.put(
  '/settings',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const data = upsertSettingSchema.parse(req.body);
    await setSetting(data.key, data.value);
    res.json({ settings: await getSettings(true) });
  }),
);

adminRouter.get(
  '/content',
  h(async (_req, res) => {
    res.json({ content: await prisma.content.findMany() });
  }),
);
adminRouter.put(
  '/content',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const data = upsertContentSchema.parse(req.body);
    const isSource = data.locale === SOURCE_LOCALE;
    // Édition manuelle d'une langue cible => on fige (plus de réécrasement auto).
    const reviewed = !isSource;

    const row = await prisma.content.upsert({
      where: { key_locale: { key: data.key, locale: data.locale } },
      create: {
        key: data.key,
        locale: data.locale,
        title: data.title,
        body: data.body,
        format: data.format,
        autoTranslated: false,
        reviewedAt: reviewed ? new Date() : null,
      },
      update: {
        title: data.title,
        body: data.body,
        format: data.format,
        autoTranslated: isSource ? undefined : false,
        reviewedAt: reviewed ? new Date() : undefined,
      },
    });

    // Le FR a changé => (re)traduire NL/EN en arrière-plan (sauf versions revues).
    let translated: string[] = [];
    if (isSource) {
      translated = await syncContentTranslations({
        key: data.key,
        title: data.title,
        body: data.body,
        format: data.format,
      });
    }
    res.json({ content: row, translated });
  }),
);

/** Force la re-traduction NL/EN d'un contenu depuis sa version FR. */
adminRouter.post(
  '/content/:key/retranslate',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const fr = await prisma.content.findUnique({
      where: { key_locale: { key: req.params.key!, locale: SOURCE_LOCALE } },
    });
    if (!fr) throw notFound('Contenu FR introuvable');
    const translated = await syncContentTranslations(
      { key: fr.key, title: fr.title, body: fr.body, format: fr.format },
      { force: true },
    );
    res.json({ translated });
  }),
);

/* -------------------------- Avis clients -------------------------- */
adminRouter.get(
  '/reviews',
  h(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await prisma.review.findMany({
      where: status ? { status } : {},
      include: { product: { select: { slug: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ reviews: rows });
  }),
);

adminRouter.patch(
  '/reviews/:id',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const data = moderateReviewSchema.parse(req.body);
    const existing = await prisma.review.findUnique({ where: { id: req.params.id! } });
    if (!existing) throw notFound('Avis introuvable');
    const review = await prisma.review.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        reply: data.reply === undefined ? undefined : data.reply,
        publishedAt:
          data.status === 'PUBLISHED' ? (existing.publishedAt ?? new Date()) : null,
      },
    });
    res.json({ review });
  }),
);

/* -------------------------- Zones de livraison -------------------------- */
adminRouter.get(
  '/delivery-zones',
  h(async (_req, res) => {
    res.json({ zones: await prisma.deliveryZone.findMany() });
  }),
);
adminRouter.post(
  '/delivery-zones',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const data = upsertDeliveryZoneSchema.parse(req.body);
    const zone = await prisma.deliveryZone.create({
      data: {
        name: data.name,
        postalPrefixes: data.postalPrefixes as never,
        baseFee: data.baseFee,
        perKm: data.perKm,
        active: data.active,
      },
    });
    res.status(201).json({ zone });
  }),
);
adminRouter.patch(
  '/delivery-zones/:id',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const b = req.body ?? {};
    const zone = await prisma.deliveryZone.update({
      where: { id: req.params.id! },
      data: {
        name: b.name ?? undefined,
        mode: b.mode ?? undefined,
        postalPrefixes: b.postalPrefixes === undefined ? undefined : (b.postalPrefixes as never),
        maxDistanceKm: b.maxDistanceKm === undefined ? undefined : Number(b.maxDistanceKm),
        baseFee: b.baseFee === undefined ? undefined : Number(b.baseFee),
        perKm: b.perKm === undefined ? undefined : Number(b.perKm),
        active: b.active === undefined ? undefined : Boolean(b.active),
      },
    });
    res.json({ zone });
  }),
);
adminRouter.delete(
  '/delivery-zones/:id',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    await prisma.deliveryZone.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

/** Test rapide du tarif de livraison depuis une adresse (outil admin). */
adminRouter.post(
  '/delivery/test',
  h(async (req, res) => {
    const { quoteDelivery } = await import('../lib/delivery.js');
    const q = await quoteDelivery(req.body ?? {}, Number(req.body?.rentalHT) || 0);
    res.json(q);
  }),
);

/* -------------------------- Dommages -------------------------- */
adminRouter.get(
  '/damages',
  h(async (_req, res) => {
    res.json({
      damages: await prisma.damage.findMany({
        include: { unit: { include: { product: true } }, reservation: true },
        orderBy: { createdAt: 'desc' },
      }),
    });
  }),
);
adminRouter.patch(
  '/damages/:id',
  requireStaff('TECHNICIEN', 'RESPONSABLE'),
  h(async (req, res) => {
    const d = await prisma.damage.update({
      where: { id: req.params.id },
      data: { resolved: Boolean(req.body?.resolved) },
    });
    res.json({ damage: d });
  }),
);

/* -------------------------- Tickets support -------------------------- */
adminRouter.get(
  '/tickets',
  h(async (_req, res) => {
    res.json({
      tickets: await prisma.supportTicket.findMany({
        include: { user: true, reservation: true },
        orderBy: { createdAt: 'desc' },
      }),
    });
  }),
);
adminRouter.patch(
  '/tickets/:id',
  h(async (req, res) => {
    const t = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: { status: req.body?.status ?? undefined, response: req.body?.response ?? undefined },
    });
    res.json({ ticket: t });
  }),
);

/* -------------------------- Equipe -------------------------- */
adminRouter.get(
  '/staff',
  requireStaff('ADMIN', 'RESPONSABLE'),
  h(async (_req, res) => {
    const rows = await prisma.staffUser.findMany();
    res.json({ staff: rows.map(({ passwordHash, ...s }) => { void passwordHash; return s; }) });
  }),
);
adminRouter.post(
  '/staff',
  requireStaff('ADMIN'),
  h(async (req, res) => {
    const data = createStaffSchema.parse(req.body);
    const exists = await prisma.staffUser.findUnique({ where: { email: data.email.toLowerCase() } });
    if (exists) throw badRequest('Cet e-mail est deja utilise');
    const staff = await prisma.staffUser.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: await hashPassword(data.password),
        name: data.name,
        role: data.role,
      },
    });
    const { passwordHash, ...safe } = staff;
    void passwordHash;
    res.status(201).json({ staff: safe });
  }),
);
/** Édition complète d'un membre d'équipe (nom, e-mail, rôle, actif). */
adminRouter.patch(
  '/staff/:id',
  requireStaff('ADMIN'),
  h(async (req, res) => {
    const { name, email, role, active } = req.body ?? {};
    if (email) {
      const clash = await prisma.staffUser.findFirst({
        where: { email: String(email).toLowerCase(), id: { not: req.params.id } },
      });
      if (clash) throw badRequest('Cet e-mail est déjà utilisé');
    }
    const staff = await prisma.staffUser.update({
      where: { id: req.params.id! },
      data: {
        name: name ?? undefined,
        email: email ? String(email).toLowerCase() : undefined,
        role: role ?? undefined,
        active: active === undefined ? undefined : Boolean(active),
      },
    });
    const { passwordHash, ...safe } = staff;
    void passwordHash;
    res.json({ staff: safe });
  }),
);

/** Réinitialise le mot de passe : renvoie un mot de passe temporaire à communiquer. */
adminRouter.post(
  '/staff/:id/reset-password',
  requireStaff('ADMIN'),
  h(async (req, res) => {
    const temp =
      (req.body?.password as string | undefined) ||
      randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, '') + '9x';
    await prisma.staffUser.update({
      where: { id: req.params.id! },
      data: { passwordHash: await hashPassword(temp) },
    });
    res.json({ temporaryPassword: temp });
  }),
);

adminRouter.delete(
  '/staff/:id',
  requireStaff('ADMIN'),
  h(async (req, res) => {
    await prisma.staffUser.update({ where: { id: req.params.id }, data: { active: false } });
    res.status(204).end();
  }),
);

/* -------------------------- Factures & paiements -------------------------- */
adminRouter.get(
  '/invoices',
  requireStaff('COMPTABILITE', 'RESPONSABLE'),
  h(async (_req, res) => {
    res.json({
      invoices: await prisma.invoice.findMany({
        include: { reservation: { include: { user: true } } },
        orderBy: { issuedAt: 'desc' },
      }),
    });
  }),
);
adminRouter.get(
  '/invoices/:id/pdf',
  h(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice || !invoice.pdfPath || !existsSync(invoice.pdfPath))
      throw notFound('PDF indisponible');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.number}.pdf"`);
    createReadStream(invoice.pdfPath).pipe(res);
  }),
);

adminRouter.get(
  '/payments',
  requireStaff('COMPTABILITE', 'RESPONSABLE'),
  h(async (_req, res) => {
    res.json({
      payments: await prisma.payment.findMany({
        include: { reservation: true },
        orderBy: { createdAt: 'desc' },
      }),
    });
  }),
);
