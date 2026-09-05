/**
 * API partenaire — parc partagé Bricoloc ↔ JJD.
 * Auth : en-tête `x-api-key` (= env.partnerApiKey). Machine-à-machine, pas d'utilisateur.
 * Ne renvoie JAMAIS de données client / réservation / prix Bricoloc.
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { badRequest, h, notFound } from '../lib/http.js';
import {
  createLoan,
  logConsumption,
  resolveUnit,
  returnLoan,
  unitLocation,
  upsertChantier,
} from '../lib/parc.js';

export const partnerRouter = Router();

/** Première image d'un produit (chemin relatif `/uploads/...` ou URL absolue). */
function firstImage(images: unknown): string | null {
  const arr = Array.isArray(images) ? (images as string[]) : [];
  return arr[0] ?? null;
}

partnerRouter.use((req, res, next) => {
  if (!env.partnerApiKey) {
    return res.status(503).json({ error: { code: 'DISABLED', message: 'API partenaire désactivée' } });
  }
  const key = req.header('x-api-key') ?? '';
  if (key !== env.partnerApiKey) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Clé API invalide' } });
  }
  next();
});

partnerRouter.get(
  '/health',
  h(async (_req, res) => {
    res.json({ ok: true, service: 'bricoloc-parc', time: new Date().toISOString() });
  }),
);

/* ----------------------------- Chantiers ----------------------------- */

/** Synchronise les chantiers depuis le CRM JJD. Body : objet ou tableau. */
partnerRouter.post(
  '/chantiers',
  h(async (req, res) => {
    const list = Array.isArray(req.body) ? req.body : [req.body];
    const out = [];
    for (const c of list) out.push(await upsertChantier(c));
    res.json({ chantiers: out.map((c) => ({ id: c.id, externalRef: c.externalRef, name: c.name })) });
  }),
);

partnerRouter.get(
  '/chantiers',
  h(async (_req, res) => {
    const rows = await prisma.chantier.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, externalRef: true, name: true, client: true, address: true },
    });
    res.json({ chantiers: rows });
  }),
);

/** Fiche chantier : outils présents + consommables utilisés. */
partnerRouter.get(
  '/chantiers/:ref',
  h(async (req, res) => {
    const chantier = await prisma.chantier.findUnique({
      where: { externalRef: req.params.ref! },
      include: {
        loans: {
          where: { returnedAt: null },
          include: { unit: { include: { product: { select: { name: true, slug: true } } } } },
        },
        consumption: {
          orderBy: { takenAt: 'desc' },
          include: { product: { select: { name: true, slug: true } } },
        },
      },
    });
    if (!chantier) throw notFound('Chantier inconnu');
    res.json({
      chantier: { id: chantier.id, externalRef: chantier.externalRef, name: chantier.name },
      tools: chantier.loans.map((l) => ({
        loanId: l.id,
        assetTag: l.unit.assetTag,
        product: l.unit.product.name,
        since: l.takenAt,
        takenBy: l.takenBy,
      })),
      consumption: chantier.consumption.map((c) => ({
        product: c.product.name,
        quantity: c.quantity,
        at: c.takenAt,
        takenBy: c.takenBy,
      })),
    });
  }),
);

/* ------------------------------- Stock ------------------------------- */

/** État du parc partagé : produits + exemplaires + localisation. */
partnerRouter.get(
  '/stock',
  h(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const products = await prisma.product.findMany({
      where: {
        kind: { in: ['MACHINE', 'ACCESSORY'] },
        published: true,
        ...(q ? { name: { contains: q } } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true,
        brand: true,
        model: true,
        images: true,
        category: { select: { name: true } },
        shortDescription: true,
        description: true,
        specs: true,
        manualUrl: true,
        documents: true,
        units: {
          select: { id: true, assetTag: true, state: true, storageLocation: true },
        },
      },
    });

    const activeLoans = await prisma.assetLoan.findMany({
      where: { returnedAt: null },
      include: { chantier: { select: { name: true, externalRef: true } } },
    });
    const loanByUnit = new Map(activeLoans.map((l) => [l.unitId, l]));

    res.json({
      products: products.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        kind: p.kind,
        brand: p.brand ?? null,
        model: p.model ?? null,
        image: firstImage(p.images),
        category: p.category?.name ?? null,
        shortDescription: p.shortDescription ?? null,
        description: p.description ?? null,
        specs: (p.specs as Record<string, string>) ?? {},
        manualUrl: p.manualUrl ?? null,
        documents: (p.documents as { label: string; url: string }[]) ?? [],
        total: p.units.length,
        available: p.units.filter((u) => u.state === 'AVAILABLE').length,
        onSite: p.units.filter((u) => u.state === 'ON_SITE').length,
        rented: p.units.filter((u) => u.state === 'RENTED').length,
        units: p.units.map((u) => {
          const loan = loanByUnit.get(u.id);
          return {
            assetTag: u.assetTag,
            state: u.state,
            storageLocation: u.storageLocation,
            chantier: loan ? { name: loan.chantier.name, ref: loan.chantier.externalRef, since: loan.takenAt } : null,
          };
        }),
      })),
    });
  }),
);

/** Consommables partagés + stock restant. */
partnerRouter.get(
  '/consumables',
  h(async (_req, res) => {
    const rows = await prisma.product.findMany({
      where: { isConsumable: true, published: true },
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, stockQty: true, shortDescription: true },
    });
    res.json({ consumables: rows });
  }),
);

/** Résout un code scanné : exemplaire + produit + où il est. */
partnerRouter.get(
  '/units/:code',
  h(async (req, res) => {
    const unit = await resolveUnit(req.params.code!);
    if (!unit) throw notFound('Exemplaire inconnu');
    const location = await unitLocation(unit);
    const history = await prisma.assetLoan.findMany({
      where: { unitId: unit.id },
      orderBy: { takenAt: 'desc' },
      take: 10,
      include: { chantier: { select: { name: true, externalRef: true } } },
    });
    res.json({
      unit: { assetTag: unit.assetTag, barcode: unit.barcode, state: unit.state },
      product: {
        id: unit.product.id,
        name: unit.product.name,
        kind: unit.product.kind,
        image: firstImage((unit.product as { images?: unknown }).images),
      },
      location,
      history: history.map((l) => ({
        chantier: l.chantier.name,
        chantierRef: l.chantier.externalRef,
        takenAt: l.takenAt,
        takenBy: l.takenBy,
        returnedAt: l.returnedAt,
      })),
    });
  }),
);

/* --------------------------- Sorties / retours --------------------------- */

partnerRouter.post(
  '/loans',
  h(async (req, res) => {
    const { code, chantierRef, takenBy, note } = req.body ?? {};
    if (!code || !chantierRef) throw badRequest('code et chantierRef requis');
    const { loan, unit, chantier } = await createLoan({ code, chantierRef, takenBy, note });
    res.status(201).json({
      loan: { id: loan.id, takenAt: loan.takenAt },
      unit: { assetTag: unit.assetTag, product: unit.product.name },
      chantier: { name: chantier.name, ref: chantier.externalRef },
    });
  }),
);

/** Retour : par code scanné. */
partnerRouter.post(
  '/returns',
  h(async (req, res) => {
    const { code, returnedBy, note, toState, storageLocation } = req.body ?? {};
    if (!code) throw badRequest('code requis');
    const r = await returnLoan({ code, returnedBy, note, toState, storageLocation });
    res.json(r);
  }),
);

/* ---------------------------- Consommation ---------------------------- */

partnerRouter.post(
  '/consumption',
  h(async (req, res) => {
    const { code, productId, quantity, chantierRef, takenBy, note } = req.body ?? {};
    if ((!code && !productId) || !quantity || !chantierRef)
      throw badRequest('(code ou productId), quantity et chantierRef requis');
    const r = await logConsumption({ code, productId, quantity, chantierRef, takenBy, note });
    res.status(201).json(r);
  }),
);
