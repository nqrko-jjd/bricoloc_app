import { Router } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import {
  SOURCE_LOCALE,
  createStaffSchema,
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
import { newQrToken } from '../lib/qr.js';
import { productInclude, serializeProductDetail } from '../lib/serialize.js';
import { generateInvoice } from '../lib/invoice.js';
import { syncContentTranslations } from '../lib/i18n-content.js';

export const adminRouter = Router();
adminRouter.use(attachPrincipal, requireStaff());

/* -------------------------- Tableau de bord -------------------------- */
adminRouter.get(
  '/dashboard',
  h(async (_req, res) => {
    const [products, units, customers, reservations, openTickets, damages] = await Promise.all([
      prisma.product.count(),
      prisma.productUnit.count(),
      prisma.user.count(),
      prisma.reservation.groupBy({ by: ['status'], _count: true }),
      prisma.supportTicket.count({ where: { status: { not: 'CLOSED' } } }),
      prisma.damage.count({ where: { resolved: false } }),
    ]);
    const upcoming = await prisma.reservation.findMany({
      where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURN_PENDING'] } },
      include: { user: true, items: true },
      orderBy: { periodStart: 'asc' },
      take: 20,
    });
    const revenue = await prisma.payment.aggregate({
      where: { status: 'PAID', kind: { in: ['RENTAL', 'EXTRA', 'DEPOSIT'] } },
      _sum: { amount: true },
    });
    res.json({
      counters: { products, units, customers, openTickets, damages },
      reservationsByStatus: reservations,
      revenuePaid: revenue._sum.amount ?? 0,
      upcoming,
    });
  }),
);

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
    res.json({ products: rows.map(serializeProductDetail) });
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

/* -------------------------- Maintenance -------------------------- */
adminRouter.post(
  '/units/:id/maintenance',
  requireStaff('TECHNICIEN', 'RESPONSABLE'),
  h(async (req, res) => {
    const { type, description, cost, nextAt } = req.body ?? {};
    const unit = await prisma.productUnit.findUnique({ where: { id: req.params.id } });
    if (!unit) throw notFound();
    const m = await prisma.maintenance.create({
      data: {
        unitId: unit.id,
        type: type ?? 'ENTRETIEN',
        description: description ?? 'Entretien',
        cost: Number(cost ?? 0),
        nextAt: nextAt ? new Date(nextAt) : null,
        staffId: req.principal?.kind === 'staff' ? req.principal.id : undefined,
      },
    });
    await prisma.productUnit.update({
      where: { id: unit.id },
      data: {
        state: 'AVAILABLE',
        nextMaintenanceAt: nextAt ? new Date(nextAt) : unit.nextMaintenanceAt,
      },
    });
    res.status(201).json({ maintenance: m });
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

adminRouter.patch(
  '/reservations/:id',
  requireStaff('RESPONSABLE', 'COMPTOIR'),
  h(async (req, res) => {
    const { status, note, periodStart, periodEnd } = req.body ?? {};
    const r = await prisma.reservation.update({
      where: { id: req.params.id },
      data: {
        status: status ?? undefined,
        note: note ?? undefined,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      },
    });
    res.json({ reservation: r });
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
    res.json({ item });
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

adminRouter.patch(
  '/customers/:id',
  requireStaff('RESPONSABLE', 'COMPTABILITE'),
  h(async (req, res) => {
    const { customerType, negotiatedDiscountPct, companyName, vatNumber } = req.body ?? {};
    const u = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        customerType: customerType ?? undefined,
        negotiatedDiscountPct:
          negotiatedDiscountPct === undefined ? undefined : Number(negotiatedDiscountPct),
        companyName: companyName ?? undefined,
        vatNumber: vatNumber ?? undefined,
      },
    });
    const { passwordHash, ...safe } = u;
    void passwordHash;
    res.json({ customer: safe });
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
adminRouter.delete(
  '/delivery-zones/:id',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    await prisma.deliveryZone.delete({ where: { id: req.params.id } });
    res.status(204).end();
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
