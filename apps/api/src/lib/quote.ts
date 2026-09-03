import type { Product } from '@prisma/client';
import {
  computeCartTotals,
  computeComposedPackDiscount,
  computeRentalPrice,
  round2,
  type CartTotals,
  type ComposedPackConfig,
  type ComposedPackResult,
  type CustomerType,
  type ProductPricing,
} from '@bricoloc/shared';
import { prisma } from '../db.js';
import { getSettings, pricingSettings, vatRate, type AppSettings } from './settings.js';
import { quoteDelivery } from './delivery.js';

export interface QuoteLineInput {
  product: Product;
  quantity: number;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

export interface QuoteLine {
  productId: string;
  name: string;
  kind: string;
  quantity: number;
  billedDays: number;
  appliedRule: string;
  unitPriceHT: number;
  lineHT: number;
  depositUnit: number;
  depositLine: number;
  isConsumable: boolean;
  /** Ligne machine issue de l'éclatement d'un BricoPack (= id produit du pack). */
  packRef?: string | null;
}

export interface QuoteInput {
  lines: QuoteLineInput[];
  periodStart: Date;
  periodEnd: Date;
  customerType: CustomerType;
  fulfilmentMode: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: {
    line1?: string;
    line2?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  } | null;
  promoCode?: string | null;
}

export interface Quote {
  lines: QuoteLine[];
  totals: CartTotals;
  deliveryFeeHT: number;
  deliveryReason?: string;
  discountHT: number;
  promoCode?: string | null;
  promoLabel?: string | null;
  /** « Pack composé » : remise selon le nombre de machines. */
  composedPack: ComposedPackResult;
  currency: string;
  vatRate: number;
}

function toPricing(p: Product): ProductPricing {
  return {
    dailyPrice: p.dailyPrice,
    weekendPrice: p.weekendPrice,
    weekPrice: p.weekPrice,
    monthPrice: p.monthPrice,
    tiers: (p.tiers as unknown as ProductPricing['tiers']) ?? [],
    proDiscountPct: p.proDiscountPct,
    deposit: p.deposit,
  };
}

/**
 * Frais de livraison géolocalisés : distance routière depuis le dépôt -> tarif
 * (tranches de km ou au km, config admin). Repli sur le forfait de base si
 * l'adresse ne peut pas être géocodée.
 */
export async function computeDeliveryFee(
  address: QuoteInput['deliveryAddress'],
  rentalHT: number,
  settings: AppSettings,
): Promise<{ feeHT: number; reason: string; served: boolean; distanceKm?: number }> {
  const base = Number(settings.deliveryBaseFee ?? 25);
  if (!address || (!address.postalCode && !address.line1)) {
    return { feeHT: base, reason: 'Adresse incomplète — tarif provisoire', served: true };
  }
  const q = await quoteDelivery(address, rentalHT);
  if (!q.geocoded) {
    return { feeHT: base, reason: 'Adresse non localisée — tarif provisoire', served: true };
  }
  if (!q.served) {
    return {
      feeHT: 0,
      served: false,
      distanceKm: q.distanceKm,
      reason: `Hors zone de livraison (${q.distanceKm} km du dépôt). Contactez-nous pour un devis.`,
    };
  }
  if (q.free) {
    return {
      feeHT: 0,
      served: true,
      distanceKm: q.distanceKm,
      reason: `Livraison offerte (${q.distanceKm} km, franchise atteinte)`,
    };
  }
  return {
    feeHT: round2(q.feeHT),
    served: true,
    distanceKm: q.distanceKm,
    reason: `Livraison ${q.distanceKm} km depuis le dépôt`,
  };
}

export async function buildQuote(input: QuoteInput): Promise<Quote> {
  const settings = await getSettings();
  const ps = pricingSettings(settings);
  const rate = vatRate(settings);

  // Composition des BricoPacks présents dans le panier (liens PACK_ITEM).
  const packIds = input.lines.filter((l) => l.product.kind === 'PACK').map((l) => l.product.id);
  const packBom = new Map<string, { component: Product; quantity: number }[]>();
  if (packIds.length) {
    for (const id of packIds) packBom.set(id, []);
    const bomLinks = await prisma.productLink.findMany({
      where: { fromId: { in: packIds }, type: 'PACK_ITEM' },
      include: { to: true },
    });
    for (const bl of bomLinks) {
      packBom.get(bl.fromId)?.push({ component: bl.to, quantity: Math.max(1, bl.quantity) });
    }
  }

  const buildLines = (l: QuoteLineInput): QuoteLine[] => {
    const start = l.periodStart ?? input.periodStart;
    const end = l.periodEnd ?? input.periodEnd;

    if (l.product.isConsumable) {
      const unit = round2(l.product.dailyPrice); // pour un consommable, dailyPrice = prix de vente unitaire
      return [
        {
          productId: l.product.id,
          name: l.product.name,
          kind: l.product.kind,
          quantity: l.quantity,
          billedDays: 0,
          appliedRule: 'CONSUMABLE',
          unitPriceHT: unit,
          lineHT: round2(unit * l.quantity),
          depositUnit: 0,
          depositLine: 0,
          isConsumable: true,
          packRef: null,
        },
      ];
    }

    const r = computeRentalPrice({
      pricing: toPricing(l.product),
      period: { start, end },
      quantity: l.quantity,
      customerType: input.customerType,
      settings: ps,
    });

    // BricoPack : ligne parente (prix pack, caution = somme des machines) +
    // lignes machines à 0 € qui immobilisent le stock réel.
    if (l.product.kind === 'PACK') {
      const bom = packBom.get(l.product.id) ?? [];
      const depositUnit = round2(
        bom.reduce((a, b) => a + (b.component.deposit ?? 0) * b.quantity, 0),
      );
      const parent: QuoteLine = {
        productId: l.product.id,
        name: l.product.name,
        kind: 'PACK',
        quantity: l.quantity,
        billedDays: r.billedDays,
        appliedRule: r.appliedRule,
        unitPriceHT: r.unitPrice,
        lineHT: r.linePrice,
        depositUnit,
        depositLine: round2(depositUnit * l.quantity),
        isConsumable: false,
        packRef: null,
      };
      const children: QuoteLine[] = bom.map((b) => ({
        productId: b.component.id,
        name: b.component.name,
        kind: 'MACHINE',
        quantity: l.quantity * b.quantity,
        billedDays: r.billedDays,
        appliedRule: 'PACK_ITEM',
        unitPriceHT: 0,
        lineHT: 0,
        depositUnit: 0,
        depositLine: 0,
        isConsumable: false,
        packRef: l.product.id,
      }));
      return [parent, ...children];
    }

    return [
      {
        productId: l.product.id,
        name: l.product.name,
        kind: l.product.kind,
        quantity: l.quantity,
        billedDays: r.billedDays,
        appliedRule: r.appliedRule,
        unitPriceHT: r.unitPrice,
        lineHT: r.linePrice,
        depositUnit: l.product.deposit,
        depositLine: r.depositTotal,
        isConsumable: false,
        packRef: null,
      },
    ];
  };

  const built = input.lines.map((l) => ({ input: l, out: buildLines(l) }));
  const lines: QuoteLine[] = built.flatMap((b) => b.out);

  const rentalHT = round2(lines.reduce((a, l) => a + l.lineHT, 0));
  const depositsTotal = round2(lines.reduce((a, l) => a + l.depositLine, 0));

  // « Pack composé » : machines libres choisies par le client (hors BricoPack
  // curaté, hors Loiselet). Les machines incluses dans un pack ne comptent pas.
  const eligible = built
    .filter(
      (b) =>
        b.input.product.kind === 'MACHINE' &&
        !b.input.product.isConsumable &&
        b.input.product.supplier !== 'LOISELET',
    )
    .flatMap((b) => b.out);
  const composedPack = computeComposedPackDiscount(
    eligible.reduce((a, l) => a + l.quantity, 0),
    round2(eligible.reduce((a, l) => a + l.lineHT, 0)),
    settings.composedPack as ComposedPackConfig,
  );

  let deliveryFeeHT = 0;
  let deliveryReason: string | undefined;
  if (input.fulfilmentMode === 'DELIVERY') {
    const d = await computeDeliveryFee(input.deliveryAddress, rentalHT, settings);
    deliveryFeeHT = d.feeHT;
    deliveryReason = d.reason;
  }

  let promoDiscountHT = 0;
  let promoLabel: string | null = null;
  if (input.promoCode) {
    const promo = await prisma.promotion.findUnique({
      where: { code: input.promoCode.toUpperCase() },
    });
    const valid =
      promo &&
      promo.active &&
      rentalHT >= promo.minTotalHT &&
      (!promo.expiresAt || promo.expiresAt.getTime() > Date.now());
    if (valid && promo) {
      promoDiscountHT =
        promo.kind === 'PERCENT'
          ? round2((rentalHT * promo.value) / 100)
          : round2(Math.min(promo.value, rentalHT));
      promoLabel =
        promo.kind === 'PERCENT' ? `-${promo.value}%` : `-${promo.value} € HTVA`;
    }
  }

  const discountHT = round2(promoDiscountHT + composedPack.discountHT);

  const totals = computeCartTotals({
    rentalLinesHT: lines.map((l) => l.lineHT),
    depositsTotal,
    deliveryFeeHT,
    extraFeesHT: 0,
    discountHT,
    vatRate: rate,
  });
  totals.promoDiscountHT = round2(promoDiscountHT);
  totals.composedPackDiscountHT = composedPack.discountHT;
  totals.composedPackPct = composedPack.pct;

  return {
    lines,
    totals,
    deliveryFeeHT,
    deliveryReason,
    discountHT,
    promoCode: input.promoCode ?? null,
    promoLabel,
    composedPack,
    currency: String(settings.currency ?? 'EUR'),
    vatRate: rate,
  };
}

/**
 * Recalcule une réservation existante après édition en back-office :
 * re-tarife chaque ligne, applique d'éventuels frais/remises manuels,
 * met à jour les `ReservationItem` et le snapshot `totals`.
 */
export async function recomputeReservation(
  reservationId: string,
  opts: { extraFeesHT?: number; extraDiscountHT?: number } = {},
): Promise<void> {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { items: { include: { product: true } }, user: true },
  });
  if (!r) throw new Error('Réservation introuvable');

  const settings = await getSettings();
  const ps = pricingSettings(settings);
  const rate = vatRate(settings);
  const customerType = (r.user?.customerType as CustomerType) ?? 'PARTICULIER';

  // Caution des BricoPacks = somme des cautions de leurs machines (liens PACK_ITEM).
  const packIds = r.items.filter((i) => i.product.kind === 'PACK').map((i) => i.productId);
  const packDeposit = new Map<string, number>();
  if (packIds.length) {
    const bom = await prisma.productLink.findMany({
      where: { fromId: { in: packIds }, type: 'PACK_ITEM' },
      include: { to: { select: { deposit: true } } },
    });
    for (const id of packIds) packDeposit.set(id, 0);
    for (const b of bom) {
      packDeposit.set(
        b.fromId,
        (packDeposit.get(b.fromId) ?? 0) + (b.to.deposit ?? 0) * Math.max(1, b.quantity),
      );
    }
  }

  let rentalHT = 0;
  let depositsTotal = 0;

  for (const item of r.items) {
    const start = item.periodStart ?? r.periodStart;
    const end = item.periodEnd ?? r.periodEnd;

    // Ligne machine incluse dans un pack : reste à 0 €, on ne la re-tarife pas.
    if (item.packRef) {
      await prisma.reservationItem.update({
        where: { id: item.id },
        data: {
          nameSnapshot: item.product.name,
          unitPriceHT: 0,
          lineHT: 0,
          depositUnit: 0,
          appliedRule: 'PACK_ITEM',
        },
      });
      continue;
    }

    if (item.product.isConsumable) {
      const unit = round2(item.product.dailyPrice);
      await prisma.reservationItem.update({
        where: { id: item.id },
        data: {
          nameSnapshot: item.product.name,
          unitPriceHT: unit,
          lineHT: round2(unit * item.quantity),
          depositUnit: 0,
          billedDays: 0,
          appliedRule: 'CONSUMABLE',
        },
      });
      rentalHT += round2(unit * item.quantity);
      continue;
    }
    const p = computeRentalPrice({
      pricing: toPricing(item.product),
      period: { start, end },
      quantity: item.quantity,
      customerType,
      settings: ps,
    });
    const depUnit =
      item.product.kind === 'PACK'
        ? round2(packDeposit.get(item.productId) ?? 0)
        : item.product.deposit;
    await prisma.reservationItem.update({
      where: { id: item.id },
      data: {
        nameSnapshot: item.product.name,
        unitPriceHT: p.unitPrice,
        lineHT: p.linePrice,
        depositUnit: depUnit,
        billedDays: p.billedDays,
        appliedRule: p.appliedRule,
      },
    });
    rentalHT += p.linePrice;
    depositsTotal += round2(depUnit * item.quantity);
  }
  rentalHT = round2(rentalHT);
  depositsTotal = round2(depositsTotal);

  let deliveryFeeHT = 0;
  if (r.fulfilmentMode === 'DELIVERY') {
    const d = await computeDeliveryFee(r.address as QuoteInput['deliveryAddress'], rentalHT, settings);
    deliveryFeeHT = d.feeHT;
  }

  const prev =
    (r.totals as
      | { extraFeesHT?: number; discountHT?: number; promoDiscountHT?: number; composedPackDiscountHT?: number }
      | null) ?? {};
  const extraFeesHT = round2(opts.extraFeesHT ?? Number(prev.extraFeesHT ?? 0));

  // Recalcule le « pack composé » sur les lignes actuelles.
  const eligible = r.items.filter(
    (it) =>
      it.product.kind === 'MACHINE' &&
      !it.packRef &&
      !it.product.isConsumable &&
      it.product.supplier !== 'LOISELET',
  );
  const composed = computeComposedPackDiscount(
    eligible.reduce((a, it) => a + it.quantity, 0),
    round2(eligible.reduce((a, it) => a + it.lineHT, 0)),
    settings.composedPack as ComposedPackConfig,
  );
  // Part promo/manuelle : override explicite, sinon ce qui restait hors pack composé.
  const otherDiscount =
    opts.extraDiscountHT != null
      ? round2(opts.extraDiscountHT)
      : round2(
          Number(prev.promoDiscountHT ?? 0) ||
            Math.max(0, Number(prev.discountHT ?? 0) - Number(prev.composedPackDiscountHT ?? 0)),
        );
  const discountHT = round2(otherDiscount + composed.discountHT);

  const totals = computeCartTotals({
    rentalLinesHT: [rentalHT],
    depositsTotal,
    deliveryFeeHT,
    extraFeesHT,
    discountHT,
    vatRate: rate,
  });
  totals.promoDiscountHT = otherDiscount;
  totals.composedPackDiscountHT = composed.discountHT;
  totals.composedPackPct = composed.pct;

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { totals: totals as never },
  });
}
