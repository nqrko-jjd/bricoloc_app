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
  deliveryAddressPostalCode?: string | null;
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

/** Frais de livraison selon la zone (prefixe code postal) ou valeurs par defaut. */
export async function computeDeliveryFee(
  postalCode: string | null | undefined,
  rentalHT: number,
  settings: AppSettings,
): Promise<{ feeHT: number; reason: string; served: boolean }> {
  const base = Number(settings.deliveryBaseFee ?? 25);
  const freeThreshold = Number(settings.deliveryFreeThreshold ?? 250);
  if (!postalCode) {
    return { feeHT: base, reason: 'Tarif de livraison standard (demo)', served: true };
  }
  const zones = await prisma.deliveryZone.findMany({ where: { active: true } });
  const zone = zones.find((z) =>
    (z.postalPrefixes as string[]).some((pref) => postalCode.startsWith(pref)),
  );
  if (zones.length > 0 && !zone) {
    return {
      feeHT: 0,
      reason: `Le code postal ${postalCode} est hors de la zone desservie.`,
      served: false,
    };
  }
  let fee = zone ? zone.baseFee : base;
  if (rentalHT >= freeThreshold) {
    return {
      feeHT: 0,
      reason: `Livraison offerte dès ${freeThreshold} € HTVA de location`,
      served: true,
    };
  }
  return {
    feeHT: round2(fee),
    reason: zone ? `Zone : ${zone.name}` : 'Tarif de livraison standard (demo)',
    served: true,
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
    const d = await computeDeliveryFee(input.deliveryAddressPostalCode, rentalHT, settings);
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
