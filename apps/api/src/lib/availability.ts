import {
  statusFor,
  type AvailabilityResult,
  type AvailabilityStatus,
} from '@bricoloc/shared';
import { prisma } from '../db.js';

/** Statuts de reservation qui bloquent du stock sur une periode. */
export const BLOCKING_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT',
  'RETURN_PENDING',
];

const MS_DAY = 86_400_000;

export interface CapacityInfo {
  productId: string;
  capacity: number;
  isConsumable: boolean;
}

async function capacityOf(productId: string): Promise<CapacityInfo> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, stockQty: true, isConsumable: true },
  });
  if (!product) return { productId, capacity: 0, isConsumable: false };
  if (product.stockQty !== null && product.stockQty !== undefined) {
    return {
      productId,
      capacity: product.stockQty,
      isConsumable: product.isConsumable,
    };
  }
  const units = await prisma.productUnit.count({
    where: { productId, state: { in: ['AVAILABLE', 'RENTED'] } },
  });
  return { productId, capacity: units, isConsumable: product.isConsumable };
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

export async function availabilityFor(
  productId: string,
  start: Date,
  end: Date,
  requestedQty: number,
  opts: { withAlternatives?: boolean; excludeReservationId?: string } = {},
): Promise<AvailabilityResult> {
  const cap = await capacityOf(productId);

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

  const reserved = await reservedQty(productId, start, end, opts.excludeReservationId);
  const available = Math.max(0, cap.capacity - reserved);
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
