import {
  statusFor,
  type AvailabilityResult,
  type AvailabilityStatus,
} from '@bricoloc/shared';
import { prisma } from '../db.js';

/** Statuts de reservation qui bloquent du stock sur une periode. */
export const BLOCKING_STATUSES = [
  'DRAFT',
  'PENDING_SUPPLIER',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT',
  'RETURN_PENDING',
];

const MS_DAY = 86_400_000;

/**
 * Nombre d'exemplaires d'un produit **immobilises pour maintenance** sur la periode.
 * Corrige le bug : un entretien / une reparation doit retirer l'exemplaire des
 * disponibilites. Compte les exemplaires distincts qui ont soit :
 *  - un `Maintenance` bloquant dont [startAt, endAt] chevauche [start, end),
 *  - un `immobilisedUntil` posterieur au debut de la periode demandee.
 */
export async function maintenanceBlockedQty(
  productId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const units = await prisma.productUnit.findMany({
    where: { productId },
    select: {
      id: true,
      immobilisedUntil: true,
      maintenances: {
        where: { blocksAvailability: true, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        select: { startAt: true, endAt: true },
      },
    },
  });
  let blocked = 0;
  for (const u of units) {
    const byFlag = u.immobilisedUntil != null && u.immobilisedUntil.getTime() > start.getTime();
    const byPlan = u.maintenances.some((m) => {
      const s = m.startAt ?? new Date(0);
      const e = m.endAt ?? new Date(8640000000000000); // immobilise sans fin connue
      return s.getTime() < end.getTime() && start.getTime() < e.getTime();
    });
    if (byFlag || byPlan) blocked += 1;
  }
  return blocked;
}

export interface CapacityInfo {
  productId: string;
  capacity: number;
  isConsumable: boolean;
  kind: string;
}

async function capacityOf(productId: string): Promise<CapacityInfo> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, stockQty: true, isConsumable: true, kind: true },
  });
  if (!product) return { productId, capacity: 0, isConsumable: false, kind: 'MACHINE' };
  if (product.stockQty !== null && product.stockQty !== undefined) {
    return {
      productId,
      capacity: product.stockQty,
      isConsumable: product.isConsumable,
      kind: product.kind,
    };
  }
  const units = await prisma.productUnit.count({
    where: { productId, state: { in: ['AVAILABLE', 'RENTED'] } },
  });
  return { productId, capacity: units, isConsumable: product.isConsumable, kind: product.kind };
}

/** Quantite deja reservee pour un produit sur une periode donnee. */
export async function reservedQty(
  productId: string,
  start: Date,
  end: Date,
  excludeReservationId?: string,
): Promise<number> {
  const items = await prisma.reservationItem.findMany({
    where: {
      productId,
      reservation: {
        status: { in: BLOCKING_STATUSES },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    },
    select: {
      quantity: true,
      periodStart: true,
      periodEnd: true,
      reservation: { select: { periodStart: true, periodEnd: true } },
    },
  });
  let total = 0;
  for (const it of items) {
    const s = it.periodStart ?? it.reservation.periodStart;
    const e = it.periodEnd ?? it.reservation.periodEnd;
    if (s.getTime() < end.getTime() && start.getTime() < e.getTime()) {
      total += it.quantity;
    }
  }
  return total;
}

/**
 * Composition d'un BricoPack : machines reelles qui le composent (liens PACK_ITEM).
 * Renvoie [] si le produit n'est pas un pack ou n'a pas de composition definie.
 */
export async function packComponents(
  packId: string,
): Promise<{ productId: string; quantity: number }[]> {
  const links = await prisma.productLink.findMany({
    where: { fromId: packId, type: 'PACK_ITEM' },
    select: { toId: true, quantity: true },
  });
  return links.map((l) => ({ productId: l.toId, quantity: Math.max(1, l.quantity) }));
}

/**
 * Disponibilite d'un BricoPack = maillon le plus faible : pour chaque machine du
 * pack, combien de packs complets peut-on servir (dispo machine / qte par pack).
 * Le pack n'a pas de stock propre.
 */
async function packAvailability(
  packId: string,
  start: Date,
  end: Date,
  requestedQty: number,
  opts: { excludeReservationId?: string } = {},
): Promise<AvailabilityResult> {
  const components = await packComponents(packId);
  if (components.length === 0) {
    return {
      productId: packId,
      requestedQty,
      availableQty: 0,
      totalUnits: 0,
      status: 'UNAVAILABLE',
      nearbyPeriod: null,
      alternativeProductIds: [],
    };
  }
  let packAvail = Infinity;
  let packTotal = Infinity;
  for (const c of components) {
    const a = await availabilityFor(c.productId, start, end, requestedQty * c.quantity, {
      excludeReservationId: opts.excludeReservationId,
    });
    packAvail = Math.min(packAvail, Math.floor(a.availableQty / c.quantity));
    packTotal = Math.min(packTotal, Math.floor(a.totalUnits / c.quantity));
  }
  const availableQty = Number.isFinite(packAvail) ? Math.max(0, packAvail) : 0;
  return {
    productId: packId,
    requestedQty,
    availableQty,
    totalUnits: Number.isFinite(packTotal) ? Math.max(0, packTotal) : 0,
    status: statusFor(requestedQty, availableQty),
    nearbyPeriod: null,
    alternativeProductIds: [],
  };
}

export async function availabilityFor(
  productId: string,
  start: Date,
  end: Date,
  requestedQty: number,
  opts: { withAlternatives?: boolean; excludeReservationId?: string } = {},
): Promise<AvailabilityResult> {
  const cap = await capacityOf(productId);

  if (cap.kind === 'PACK') {
    return packAvailability(productId, start, end, requestedQty, {
      excludeReservationId: opts.excludeReservationId,
    });
  }

  // Un consommable : disponible tant qu'il reste du stock (pas de blocage dans le temps).
  if (cap.isConsumable) {
    const available = cap.capacity;
    return {
      productId,
      requestedQty,
      availableQty: available,
      totalUnits: cap.capacity,
      status: statusFor(requestedQty, available),
      nearbyPeriod: null,
      alternativeProductIds: [],
    };
  }

  const [reserved, inMaintenance] = await Promise.all([
    reservedQty(productId, start, end, opts.excludeReservationId),
    maintenanceBlockedQty(productId, start, end),
  ]);
  const available = Math.max(0, cap.capacity - reserved - inMaintenance);
  let status: AvailabilityStatus = statusFor(requestedQty, available);

  let nearbyPeriod: { start: string; end: string } | null = null;
  if (status === 'UNAVAILABLE' || status === 'PARTIAL') {
    nearbyPeriod = await findNearbyPeriod(productId, start, end, requestedQty, cap.capacity);
    if (nearbyPeriod && status === 'UNAVAILABLE') status = 'NEARBY';
  }

  let alternativeProductIds: string[] = [];
  if (opts.withAlternatives && status !== 'AVAILABLE') {
    alternativeProductIds = await findAlternatives(productId, start, end, requestedQty);
  }

  return {
    productId,
    requestedQty,
    availableQty: available,
    totalUnits: cap.capacity,
    status,
    nearbyPeriod,
    alternativeProductIds,
  };
}

async function findNearbyPeriod(
  productId: string,
  start: Date,
  end: Date,
  requestedQty: number,
  capacity: number,
): Promise<{ start: string; end: string } | null> {
  const span = end.getTime() - start.getTime();
  for (let shift = 1; shift <= 7; shift++) {
    for (const dir of [1, -1]) {
      const ns = new Date(start.getTime() + dir * shift * MS_DAY);
      const ne = new Date(ns.getTime() + span);
      if (ne.getTime() < Date.now()) continue;
      const r = await reservedQty(productId, ns, ne);
      if (capacity - r >= requestedQty) {
        return { start: ns.toISOString(), end: ne.toISOString() };
      }
    }
  }
  return null;
}

async function findAlternatives(
  productId: string,
  start: Date,
  end: Date,
  requestedQty: number,
): Promise<string[]> {
  const base = await prisma.product.findUnique({
    where: { id: productId },
    select: { categoryId: true, kind: true },
  });
  if (!base?.categoryId) return [];
  const candidates = await prisma.product.findMany({
    where: {
      id: { not: productId },
      categoryId: base.categoryId,
      kind: base.kind,
      published: true,
    },
    select: { id: true },
    take: 12,
  });
  const ok: string[] = [];
  for (const c of candidates) {
    const a = await availabilityFor(c.id, start, end, requestedQty);
    if (a.status === 'AVAILABLE') ok.push(c.id);
    if (ok.length >= 4) break;
  }
  return ok;
}

export interface CheckItem {
  productId: string;
  quantity: number;
}

export async function checkMany(
  start: Date,
  end: Date,
  items: CheckItem[],
  opts: { excludeReservationId?: string } = {},
): Promise<{
  ok: boolean;
  results: AvailabilityResult[];
}> {
  const results: AvailabilityResult[] = [];
  for (const it of items) {
    results.push(
      await availabilityFor(it.productId, start, end, it.quantity, {
        withAlternatives: true,
        excludeReservationId: opts.excludeReservationId,
      }),
    );
  }
  const ok = results.every((r) => r.status === 'AVAILABLE');
  return { ok, results };
}
