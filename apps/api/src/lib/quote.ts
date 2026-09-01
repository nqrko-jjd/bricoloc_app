import type { Product } from '@prisma/client';
import {
  computeCartTotals,
  computeRentalPrice,
  round2,
  type CartTotals,
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

  const lines: QuoteLine[] = input.lines.map((l) => {
    const start = l.periodStart ?? input.periodStart;
    const end = l.periodEnd ?? input.periodEnd;

    if (l.product.isConsumable) {
      const unit = round2(l.product.dailyPrice); // pour un consommable, dailyPrice = prix de vente unitaire
      return {
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
      };
    }

    const r = computeRentalPrice({
      pricing: toPricing(l.product),
      period: { start, end },
      quantity: l.quantity,
      customerType: input.customerType,
      settings: ps,
    });
    return {
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
    };
  });

  const rentalHT = round2(lines.reduce((a, l) => a + l.lineHT, 0));
  const depositsTotal = round2(lines.reduce((a, l) => a + l.depositLine, 0));

  let deliveryFeeHT = 0;
  let deliveryReason: string | undefined;
  if (input.fulfilmentMode === 'DELIVERY') {
    const d = await computeDeliveryFee(input.deliveryAddress, rentalHT, settings);
    deliveryFeeHT = d.feeHT;
    deliveryReason = d.reason;
  }

  let discountHT = 0;
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
      discountHT =
        promo.kind === 'PERCENT'
          ? round2((rentalHT * promo.value) / 100)
          : round2(Math.min(promo.value, rentalHT));
      promoLabel =
        promo.kind === 'PERCENT' ? `-${promo.value}%` : `-${promo.value} € HTVA`;
    }
  }

  const totals = computeCartTotals({
    rentalLinesHT: lines.map((l) => l.lineHT),
    depositsTotal,
    deliveryFeeHT,
    extraFeesHT: 0,
    discountHT,
    vatRate: rate,
  });

  return {
    lines,
    totals,
    deliveryFeeHT,
    deliveryReason,
    discountHT,
    promoCode: input.promoCode ?? null,
    promoLabel,
    currency: String(settings.currency ?? 'EUR'),
    vatRate: rate,
  };
}
