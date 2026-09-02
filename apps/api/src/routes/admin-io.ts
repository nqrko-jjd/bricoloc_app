/**
 * Import / export CSV du back-office.
 *   GET  /api/admin/io/export/:entity          -> fichier .csv
 *   POST /api/admin/io/import/:entity          -> aperçu (dry-run) ou application
 *        body JSON { csv: string, commit?: boolean }
 *
 * entités : products | consumables | units | clients | reservations (export seul)
 */
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { badRequest, h } from '../lib/http.js';
import { requireStaff } from '../lib/auth.js';
import { hashPassword } from '../lib/auth.js';
import { newQrToken } from '../lib/qr.js';
import { toCsv, parseCsv, csv, type CsvRow } from '../lib/csv.js';

export const adminIoRouter = Router();

const UNIT_STATES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'DAMAGED', 'RETIRED'];
const PRODUCT_KINDS = ['MACHINE', 'ACCESSORY', 'CONSUMABLE', 'PPE', 'PACK'];

/* ======================================================================== *
 *  EXPORT
 * ======================================================================== */

function sendCsv(res: import('express').Response, name: string, body: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bricoloc-${name}-${stamp}.csv"`);
  res.send(body);
}

const EXPORTERS: Record<string, () => Promise<string>> = {
  async products() {
    const rows = await prisma.product.findMany({
      where: { kind: { not: 'CONSUMABLE' } },
      include: { category: { select: { slug: true } } },
      orderBy: { name: 'asc' },
    });
    return toCsv(
      rows.map((p) => ({
        slug: p.slug,
        name: p.name,
        kind: p.kind,
        categorySlug: p.category?.slug ?? '',
        brand: p.brand ?? '',
        model: p.model ?? '',
        shortDescription: p.shortDescription ?? '',
        dailyPrice: p.dailyPrice,
        weekendPrice: p.weekendPrice ?? '',
        weekPrice: p.weekPrice ?? '',
        monthPrice: p.monthPrice ?? '',
        deposit: p.deposit,
        proDiscountPct: p.proDiscountPct ?? '',
        stockQty: p.stockQty ?? '',
        published: p.published ? 1 : 0,
        supplier: p.supplier,
        partSupplier: p.partSupplier ?? '',
        supplierRef: p.supplierRef ?? '',
        supplierUrl: p.supplierUrl ?? '',
      })),
      ['slug', 'name', 'kind', 'categorySlug', 'brand', 'model', 'shortDescription', 'dailyPrice',
        'weekendPrice', 'weekPrice', 'monthPrice', 'deposit', 'proDiscountPct', 'stockQty',
        'published', 'supplier', 'partSupplier', 'supplierRef', 'supplierUrl'],
    );
  },

  async consumables() {
    const rows = await prisma.product.findMany({
      where: { kind: 'CONSUMABLE' },
      include: { category: { select: { slug: true } } },
      orderBy: { name: 'asc' },
    });
    return toCsv(
      rows.map((p) => ({
        slug: p.slug,
        name: p.name,
        categorySlug: p.category?.slug ?? '',
        brand: p.brand ?? '',
        shortDescription: p.shortDescription ?? '',
        unitPrice: p.dailyPrice,
        deposit: p.deposit,
        stockQty: p.stockQty ?? '',
        published: p.published ? 1 : 0,
        partSupplier: p.partSupplier ?? '',
        supplierRef: p.supplierRef ?? '',
        supplierUrl: p.supplierUrl ?? '',
        supplierListPrice: p.supplierListPrice ?? '',
        purchasePrice: p.purchasePrice ?? '',
      })),
      ['slug', 'name', 'categorySlug', 'brand', 'shortDescription', 'unitPrice', 'deposit',
        'stockQty', 'published', 'partSupplier', 'supplierRef', 'supplierUrl',
        'supplierListPrice', 'purchasePrice'],
    );
  },

  async units() {
    const rows = await prisma.productUnit.findMany({
      include: { product: { select: { slug: true, name: true } } },
      orderBy: { assetTag: 'asc' },
    });
    return toCsv(
      rows.map((u) => ({
        assetTag: u.assetTag,
        productSlug: u.product.slug,
        productName: u.product.name,
        storageLocation: u.storageLocation ?? '',
        serialNumber: u.serialNumber ?? '',
        sku: u.sku ?? '',
        barcode: u.barcode ?? '',
        state: u.state,
        notes: u.notes ?? '',
        nextMaintenanceAt: u.nextMaintenanceAt ? u.nextMaintenanceAt.toISOString().slice(0, 10) : '',
      })),
      ['assetTag', 'productSlug', 'productName', 'storageLocation', 'serialNumber', 'sku', 'barcode',
        'state', 'notes', 'nextMaintenanceAt'],
    );
  },

  async clients() {
    const rows = await prisma.user.findMany({
      include: {
        addresses: { orderBy: { createdAt: 'asc' }, take: 1 },
        _count: { select: { reservations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return toCsv(
      rows.map((u) => ({
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        customerType: u.customerType,
        companyName: u.companyName ?? '',
        vatNumber: u.vatNumber ?? '',
        negotiatedDiscountPct: u.negotiatedDiscountPct ?? '',
        addressLine1: u.addresses[0]?.line1 ?? '',
        postalCode: u.addresses[0]?.postalCode ?? '',
        city: u.addresses[0]?.city ?? '',
        reservations: u._count.reservations,
        createdAt: u.createdAt.toISOString().slice(0, 10),
      })),
      ['email', 'firstName', 'lastName', 'phone', 'customerType', 'companyName', 'vatNumber',
        'negotiatedDiscountPct', 'addressLine1', 'postalCode', 'city', 'reservations', 'createdAt'],
    );
  },

  async reservations() {
    const rows = await prisma.reservation.findMany({
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return toCsv(
      rows.map((r) => {
        const t = (r.totals ?? {}) as Record<string, number>;
        const c = (r.contact ?? {}) as Record<string, string>;
        return {
          number: r.number,
          status: r.status,
          channel: r.channel,
          createdAt: r.createdAt.toISOString(),
          periodStart: r.periodStart.toISOString(),
          periodEnd: r.periodEnd.toISOString(),
          customerEmail: r.user?.email ?? c.email ?? '',
          customerName: r.user ? `${r.user.firstName} ${r.user.lastName}` : `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
          fulfilmentMode: r.fulfilmentMode,
          items: r._count.items,
          totalTVAC: t.totalTVAC ?? '',
          depositsTotal: t.depositsTotal ?? '',
          paymentMethod: r.paymentMethod,
          paymentStatus: r.paymentStatus,
        };
      }),
      ['number', 'status', 'channel', 'createdAt', 'periodStart', 'periodEnd', 'customerEmail',
        'customerName', 'fulfilmentMode', 'items', 'totalTVAC', 'depositsTotal', 'paymentMethod',
        'paymentStatus'],
    );
  },
};

adminIoRouter.get(
  '/io/export/:entity',
  h(async (req, res) => {
    const fn = EXPORTERS[req.params.entity];
    if (!fn) throw badRequest('Entité inconnue');
    sendCsv(res, req.params.entity, await fn());
  }),
);

/* ======================================================================== *
 *  IMPORT
 * ======================================================================== */

type RowResult = {
  line: number;
  action: 'create' | 'update' | 'skip' | 'error';
  key: string;
  message?: string;
  changes?: string[];
};

interface Importer {
  requiredHeaders: string[];
  run(rows: CsvRow[], commit: boolean): Promise<RowResult[]>;
}

function diffKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const k of Object.keys(after)) {
    if (after[k] === undefined) continue;
    const b = before[k] ?? null;
    const a = after[k] ?? null;
    if (String(b) !== String(a)) out.push(k);
  }
  return out;
}

const IMPORTERS: Record<string, Importer> = {
  /* ---- Produits (machines / accessoires / EPI / packs) ---- */
  products: {
    requiredHeaders: ['slug', 'name', 'dailyPrice'],
    async run(rows, commit) {
      const cats = new Map(
        (await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
      );
      const results: RowResult[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const line = i + 2;
        const slug = csv.str(r.slug);
        if (!slug) {
          results.push({ line, action: 'error', key: '', message: 'slug manquant' });
          continue;
        }
        const kind = (csv.str(r.kind) ?? 'MACHINE').toUpperCase();
        if (!PRODUCT_KINDS.includes(kind)) {
          results.push({ line, action: 'error', key: slug, message: `kind invalide : ${kind}` });
          continue;
        }
        const catSlug = csv.str(r.categorySlug);
        if (catSlug && !cats.has(catSlug)) {
          results.push({ line, action: 'error', key: slug, message: `catégorie inconnue : ${catSlug}` });
          continue;
        }
        const name = csv.str(r.name);
        const dailyPrice = csv.num(r.dailyPrice);
        const existing = await prisma.product.findUnique({ where: { slug } });
        if (!existing && (!name || dailyPrice === null)) {
          results.push({ line, action: 'error', key: slug, message: 'name et dailyPrice requis pour créer' });
          continue;
        }
        const data: Record<string, unknown> = {
          name: name ?? undefined,
          kind,
          categoryId: catSlug ? cats.get(catSlug) : r.categorySlug === '' ? undefined : undefined,
          brand: 'brand' in r ? csv.str(r.brand) : undefined,
          model: 'model' in r ? csv.str(r.model) : undefined,
          shortDescription: 'shortDescription' in r ? csv.str(r.shortDescription) : undefined,
          dailyPrice: dailyPrice ?? undefined,
          weekendPrice: 'weekendPrice' in r ? csv.num(r.weekendPrice) : undefined,
          weekPrice: 'weekPrice' in r ? csv.num(r.weekPrice) : undefined,
          monthPrice: 'monthPrice' in r ? csv.num(r.monthPrice) : undefined,
          deposit: 'deposit' in r ? csv.num(r.deposit) ?? undefined : undefined,
          proDiscountPct: 'proDiscountPct' in r ? csv.num(r.proDiscountPct) : undefined,
          stockQty: 'stockQty' in r ? csv.int(r.stockQty) : undefined,
          published: 'published' in r ? csv.bool(r.published) ?? undefined : undefined,
          partSupplier: 'partSupplier' in r ? csv.str(r.partSupplier) : undefined,
          supplierRef: 'supplierRef' in r ? csv.str(r.supplierRef) : undefined,
          supplierUrl: 'supplierUrl' in r ? csv.str(r.supplierUrl) : undefined,
          isConsumable: kind === 'CONSUMABLE',
        };
        if (catSlug) data.categoryId = cats.get(catSlug);

        const changes = existing ? diffKeys(existing as Record<string, unknown>, data) : Object.keys(data).filter((k) => data[k] !== undefined);
        if (existing && changes.length === 0) {
          results.push({ line, action: 'skip', key: slug });
          continue;
        }
        if (commit) {
          const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
          if (existing) await prisma.product.update({ where: { slug }, data: clean });
          else
            await prisma.product.create({
              data: { slug, name: name!, kind, dailyPrice: dailyPrice!, deposit: (data.deposit as number) ?? 0, isConsumable: kind === 'CONSUMABLE', ...clean } as never,
            });
        }
        results.push({ line, action: existing ? 'update' : 'create', key: slug, changes });
      }
      return results;
    },
  },

  /* ---- Consommables ---- */
  consumables: {
    requiredHeaders: ['slug', 'name'],
    async run(rows, commit) {
      const cats = new Map(
        (await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
      );
      const results: RowResult[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const line = i + 2;
        const slug = csv.str(r.slug);
        if (!slug) {
          results.push({ line, action: 'error', key: '', message: 'slug manquant' });
          continue;
        }
        const catSlug = csv.str(r.categorySlug);
        if (catSlug && !cats.has(catSlug)) {
          results.push({ line, action: 'error', key: slug, message: `catégorie inconnue : ${catSlug}` });
          continue;
        }
        const name = csv.str(r.name);
        const unitPrice = 'unitPrice' in r ? csv.num(r.unitPrice) : csv.num(r.dailyPrice);
        const existing = await prisma.product.findUnique({ where: { slug } });
        if (!existing && (!name || unitPrice === null)) {
          results.push({ line, action: 'error', key: slug, message: 'name et unitPrice requis pour créer' });
          continue;
        }
        const data: Record<string, unknown> = {
          name: name ?? undefined,
          kind: 'CONSUMABLE',
          isConsumable: true,
          brand: 'brand' in r ? csv.str(r.brand) : undefined,
          shortDescription: 'shortDescription' in r ? csv.str(r.shortDescription) : undefined,
          dailyPrice: unitPrice ?? undefined,
          deposit: 'deposit' in r ? csv.num(r.deposit) ?? undefined : undefined,
          stockQty: 'stockQty' in r ? csv.int(r.stockQty) : undefined,
          published: 'published' in r ? csv.bool(r.published) ?? undefined : undefined,
          partSupplier: 'partSupplier' in r ? csv.str(r.partSupplier) : undefined,
          supplierRef: 'supplierRef' in r ? csv.str(r.supplierRef) : undefined,
          supplierUrl: 'supplierUrl' in r ? csv.str(r.supplierUrl) : undefined,
          supplierListPrice: 'supplierListPrice' in r ? csv.num(r.supplierListPrice) : undefined,
          purchasePrice: 'purchasePrice' in r ? csv.num(r.purchasePrice) : undefined,
        };
        if (catSlug) data.categoryId = cats.get(catSlug);
        const changes = existing ? diffKeys(existing as Record<string, unknown>, data) : Object.keys(data).filter((k) => data[k] !== undefined);
        if (existing && changes.length === 0) {
          results.push({ line, action: 'skip', key: slug });
          continue;
        }
        if (commit) {
          const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
          if (existing) await prisma.product.update({ where: { slug }, data: clean });
          else
            await prisma.product.create({
              data: { slug, name: name!, kind: 'CONSUMABLE', isConsumable: true, dailyPrice: unitPrice!, deposit: (data.deposit as number) ?? 0, ...clean } as never,
            });
        }
        results.push({ line, action: existing ? 'update' : 'create', key: slug, changes });
      }
      return results;
    },
  },

  /* ---- Exemplaires ---- */
  units: {
    requiredHeaders: ['assetTag', 'productSlug'],
    async run(rows, commit) {
      const results: RowResult[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const line = i + 2;
        const assetTag = csv.str(r.assetTag);
        if (!assetTag) {
          results.push({ line, action: 'error', key: '', message: 'assetTag manquant' });
          continue;
        }
        const existing = await prisma.productUnit.findUnique({ where: { assetTag } });
        const state = (csv.str(r.state) ?? 'AVAILABLE').toUpperCase();
        if (!UNIT_STATES.includes(state)) {
          results.push({ line, action: 'error', key: assetTag, message: `état invalide : ${state}` });
          continue;
        }
        let productId = existing?.productId;
        const productSlug = csv.str(r.productSlug);
        if (productSlug) {
          const p = await prisma.product.findUnique({ where: { slug: productSlug }, select: { id: true } });
          if (!p) {
            results.push({ line, action: 'error', key: assetTag, message: `produit inconnu : ${productSlug}` });
            continue;
          }
          productId = p.id;
        }
        if (!productId) {
          results.push({ line, action: 'error', key: assetTag, message: 'productSlug requis pour créer' });
          continue;
        }
        const data: Record<string, unknown> = {
          productId,
          state,
          storageLocation: 'storageLocation' in r ? csv.str(r.storageLocation) : undefined,
          serialNumber: 'serialNumber' in r ? csv.str(r.serialNumber) : undefined,
          sku: 'sku' in r ? csv.str(r.sku) : undefined,
          barcode: 'barcode' in r ? csv.str(r.barcode) : undefined,
          notes: 'notes' in r ? csv.str(r.notes) : undefined,
        };
        const changes = existing
          ? diffKeys(existing as Record<string, unknown>, data)
          : ['(nouveau)'];
        if (existing && changes.length === 0) {
          results.push({ line, action: 'skip', key: assetTag });
          continue;
        }
        if (commit) {
          const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
          if (existing) await prisma.productUnit.update({ where: { assetTag }, data: clean });
          else
            await prisma.productUnit.create({
              data: { assetTag, productId, state, qrToken: newQrToken('U'), ...clean } as never,
            });
        }
        results.push({ line, action: existing ? 'update' : 'create', key: assetTag, changes });
      }
      return results;
    },
  },

  /* ---- Clients ---- */
  clients: {
    requiredHeaders: ['email'],
    async run(rows, commit) {
      const results: RowResult[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const line = i + 2;
        const email = csv.str(r.email)?.toLowerCase();
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          results.push({ line, action: 'error', key: r.email ?? '', message: 'e-mail invalide' });
          continue;
        }
        const existing = await prisma.user.findUnique({ where: { email } });
        const type = (csv.str(r.customerType) ?? 'PARTICULIER').toUpperCase();
        const data: Record<string, unknown> = {
          firstName: 'firstName' in r ? csv.str(r.firstName) : undefined,
          lastName: 'lastName' in r ? csv.str(r.lastName) : undefined,
          phone: 'phone' in r ? csv.str(r.phone) : undefined,
          customerType: type === 'PRO' ? 'PRO' : 'PARTICULIER',
          companyName: 'companyName' in r ? csv.str(r.companyName) : undefined,
          vatNumber: 'vatNumber' in r ? csv.str(r.vatNumber) : undefined,
          negotiatedDiscountPct: 'negotiatedDiscountPct' in r ? csv.num(r.negotiatedDiscountPct) : undefined,
        };
        if (!existing && (!data.firstName || !data.lastName || !data.phone)) {
          results.push({ line, action: 'error', key: email, message: 'firstName, lastName et phone requis pour créer' });
          continue;
        }
        const changes = existing
          ? diffKeys(existing as Record<string, unknown>, data)
          : ['(nouveau)'];
        if (existing && changes.length === 0) {
          results.push({ line, action: 'skip', key: email });
          continue;
        }
        if (commit) {
          const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
          if (existing) await prisma.user.update({ where: { email }, data: clean });
          else {
            const pw = await hashPassword(randomBytes(18).toString('hex'));
            await prisma.user.create({
              data: {
                email,
                passwordHash: pw,
                firstName: data.firstName as string,
                lastName: data.lastName as string,
                phone: data.phone as string,
                customerType: data.customerType as string,
                companyName: (data.companyName as string) ?? null,
                vatNumber: (data.vatNumber as string) ?? null,
                negotiatedDiscountPct: (data.negotiatedDiscountPct as number) ?? null,
              },
            });
          }
        }
        results.push({ line, action: existing ? 'update' : 'create', key: email, changes });
      }
      return results;
    },
  },
};

adminIoRouter.post(
  '/io/import/:entity',
  requireStaff('RESPONSABLE'),
  h(async (req, res) => {
    const imp = IMPORTERS[req.params.entity];
    if (!imp) throw badRequest('Import non disponible pour cette entité');
    const text: string = String(req.body?.csv ?? '');
    if (!text.trim()) throw badRequest('CSV vide');
    const commit = req.body?.commit === true;

    const rows = parseCsv(text);
    if (rows.length === 0) throw badRequest('Aucune ligne de données');
    const headers = Object.keys(rows[0]);
    const missing = imp.requiredHeaders.filter((hd) => !headers.includes(hd));
    if (missing.length) throw badRequest(`Colonnes manquantes : ${missing.join(', ')}`);
    if (rows.length > 5000) throw badRequest('5000 lignes maximum par import');

    const results = await imp.run(rows, commit);
    const summary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.action] = (acc[r.action] ?? 0) + 1;
      return acc;
    }, {});
    res.json({ entity: req.params.entity, commit, total: results.length, summary, results });
  }),
);
