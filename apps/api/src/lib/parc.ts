/**
 * Parc partagé Bricoloc ↔ JJD.
 * Bricoloc est la source de vérité du parc physique ; le CRM JJD pilote via l'API
 * partenaire. Une « sortie chantier » (AssetLoan) immobilise l'exemplaire
 * (state = ON_SITE) : il sort automatiquement des disponibilités de location.
 */
import type { ProductUnit } from '@prisma/client';
import { prisma } from '../db.js';
import { badRequest, conflict, notFound } from './http.js';

/** Résout un code scanné (assetTag / code-barres / QR) vers un exemplaire. */
export async function resolveUnit(code: string) {
  const c = code.trim();
  const unit = await prisma.productUnit.findFirst({
    where: { OR: [{ assetTag: c }, { barcode: c }, { qrToken: c }] },
    include: { product: { select: { id: true, name: true, slug: true, kind: true, images: true } } },
  });
  return unit;
}

export type UnitLocation =
  | { type: 'DEPOT'; storageLocation: string | null }
  | { type: 'CHANTIER'; chantier: { id: string; name: string; externalRef: string | null }; since: Date; loanId: string; takenBy: string | null }
  | { type: 'RENTED'; reservationNumber: string; until: Date }
  | { type: 'MAINTENANCE' }
  | { type: 'DAMAGED' }
  | { type: 'RETIRED' }
  | { type: 'UNKNOWN' };

/** Où se trouve un exemplaire, maintenant. */
export async function unitLocation(unit: ProductUnit): Promise<UnitLocation> {
  if (unit.state === 'ON_SITE') {
    const loan = await prisma.assetLoan.findFirst({
      where: { unitId: unit.id, returnedAt: null },
      orderBy: { takenAt: 'desc' },
      include: { chantier: { select: { id: true, name: true, externalRef: true } } },
    });
    if (loan)
      return {
        type: 'CHANTIER',
        chantier: loan.chantier,
        since: loan.takenAt,
        loanId: loan.id,
        takenBy: loan.takenBy,
      };
  }
  if (unit.state === 'RENTED') {
    const ru = await prisma.reservationUnit.findFirst({
      where: { unitId: unit.id, returnedAt: null },
      orderBy: { assignedAt: 'desc' },
      include: { reservationItem: { include: { reservation: true } } },
    });
    const r = ru?.reservationItem.reservation;
    if (r) return { type: 'RENTED', reservationNumber: r.number, until: r.periodEnd };
  }
  if (unit.state === 'MAINTENANCE') return { type: 'MAINTENANCE' };
  if (unit.state === 'DAMAGED') return { type: 'DAMAGED' };
  if (unit.state === 'RETIRED') return { type: 'RETIRED' };
  if (unit.state === 'AVAILABLE') return { type: 'DEPOT', storageLocation: unit.storageLocation };
  return { type: 'UNKNOWN' };
}

/** Upsert d'un chantier depuis le CRM JJD (clé = externalRef). */
export async function upsertChantier(input: {
  externalRef: string;
  name: string;
  client?: string | null;
  address?: string | null;
  active?: boolean;
}) {
  const ref = String(input.externalRef).trim();
  if (!ref) throw badRequest('externalRef requis');
  const data = {
    name: String(input.name ?? '').trim() || ref,
    client: input.client?.trim() || null,
    address: input.address?.trim() || null,
    active: input.active !== false,
  };
  return prisma.chantier.upsert({
    where: { externalRef: ref },
    create: { externalRef: ref, ...data },
    update: data,
  });
}

async function chantierByRef(ref: string) {
  const c = await prisma.chantier.findUnique({ where: { externalRef: String(ref).trim() } });
  if (!c) throw notFound(`Chantier inconnu (${ref}) — synchronisez-le d'abord.`);
  if (!c.active) throw badRequest(`Chantier « ${c.name} » archivé.`);
  return c;
}

/** Sortie chantier : le CRM JJD scanne un outil et l'affecte à un chantier. */
export async function createLoan(input: {
  code: string;
  chantierRef: string;
  takenBy?: string | null;
  note?: string | null;
}) {
  const unit = await resolveUnit(input.code);
  if (!unit) throw notFound(`Exemplaire inconnu (${input.code})`);
  if (unit.state === 'ON_SITE') {
    const cur = await unitLocation(unit);
    throw conflict(
      cur.type === 'CHANTIER'
        ? `Déjà sur le chantier « ${cur.chantier.name} » depuis le ${cur.since.toLocaleDateString('fr-BE')}.`
        : 'Exemplaire déjà sorti.',
    );
  }
  if (unit.state === 'RENTED') throw conflict('Exemplaire actuellement loué à un client.');
  if (unit.state === 'MAINTENANCE' || unit.state === 'DAMAGED')
    throw conflict('Exemplaire en entretien / endommagé.');
  if (unit.state === 'RETIRED') throw conflict('Exemplaire réformé.');

  const chantier = await chantierByRef(input.chantierRef);

  const [loan] = await prisma.$transaction([
    prisma.assetLoan.create({
      data: {
        unitId: unit.id,
        chantierId: chantier.id,
        takenBy: input.takenBy?.trim() || null,
        noteOut: input.note?.trim() || null,
        createdVia: 'PARTNER_API',
      },
    }),
    prisma.productUnit.update({ where: { id: unit.id }, data: { state: 'ON_SITE' } }),
  ]);
  return { loan, unit, chantier };
}

/** Retour chantier : l'outil revient au dépôt. */
export async function returnLoan(input: {
  code: string;
  returnedBy?: string | null;
  note?: string | null;
  toState?: 'AVAILABLE' | 'MAINTENANCE' | 'DAMAGED';
  /** Emplacement (étagère/zone) où l'outil est physiquement rangé au retour. */
  storageLocation?: string | null;
}) {
  const unit = await resolveUnit(input.code);
  if (!unit) throw notFound(`Exemplaire inconnu (${input.code})`);
  const loan = await prisma.assetLoan.findFirst({
    where: { unitId: unit.id, returnedAt: null },
    orderBy: { takenAt: 'desc' },
  });
  if (!loan) throw badRequest('Aucune sortie chantier en cours pour cet exemplaire.');
  const next = input.toState ?? 'AVAILABLE';
  const storageLocation = input.storageLocation?.trim() || undefined;
  await prisma.$transaction([
    prisma.assetLoan.update({
      where: { id: loan.id },
      data: {
        returnedAt: new Date(),
        returnedBy: input.returnedBy?.trim() || null,
        noteIn: input.note?.trim() || null,
      },
    }),
    prisma.productUnit.update({
      where: { id: unit.id },
      data: { state: next, ...(storageLocation ? { storageLocation } : {}) },
    }),
  ]);
  return { loanId: loan.id, unitId: unit.id, state: next, storageLocation: storageLocation ?? null };
}

/** Consommation d'un consommable par un chantier (décompte du stock commun). */
export async function logConsumption(input: {
  code?: string;
  productId?: string;
  quantity: number;
  chantierRef: string;
  takenBy?: string | null;
  note?: string | null;
}) {
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty <= 0) throw badRequest('Quantité invalide');

  let product;
  if (input.productId) {
    product = await prisma.product.findUnique({ where: { id: input.productId } });
  } else if (input.code) {
    const unit = await resolveUnit(input.code);
    product = unit?.product
      ? await prisma.product.findUnique({ where: { id: unit.product.id } })
      : await prisma.product.findFirst({
          where: { OR: [{ slug: input.code.trim() }, { units: { some: { barcode: input.code.trim() } } }] },
        });
  }
  if (!product) throw notFound('Produit consommable introuvable');
  if (!product.isConsumable) throw badRequest(`« ${product.name} » n'est pas un consommable.`);

  const chantier = await chantierByRef(input.chantierRef);
  const current = product.stockQty ?? 0;

  const [log] = await prisma.$transaction([
    prisma.consumptionLog.create({
      data: {
        productId: product.id,
        chantierId: chantier.id,
        quantity: qty,
        takenBy: input.takenBy?.trim() || null,
        note: input.note?.trim() || null,
      },
    }),
    prisma.product.update({
      where: { id: product.id },
      data: { stockQty: Math.max(0, current - qty) },
    }),
  ]);
  return { log, product: { id: product.id, name: product.name }, stockLeft: Math.max(0, current - qty) };
}
