import type { CustomerType } from './constants.js';
import { round2 } from './format.js';

/** Palier de tarif degressif cumulatif. Le premier palier doit avoir minDays = 1. */
export interface PriceTier {
  minDays: number;
  perDay: number;
}

export interface ProductPricing {
  dailyPrice: number;
  weekendPrice?: number | null;
  weekPrice?: number | null;
  monthPrice?: number | null;
  tiers?: PriceTier[];
  /** Remise appliquee aux clients PRO (0..1). Defaut = valeur settings. */
  proDiscountPct?: number | null;
  deposit: number;
}

export interface RentalPeriod {
  start: Date | string;
  end: Date | string;
}

export interface PricingSettings {
  sameDayCutoffHour: number;
  weekendRuleEnabled: boolean;
  weekendReturnGraceHour: number;
  proDiscountPctDefault: number;
}

export interface RentalPriceInput {
  pricing: ProductPricing;
  period: RentalPeriod;
  quantity: number;
  customerType: CustomerType;
  settings: PricingSettings;
}

export type AppliedRule =
  | 'SAME_DAY'
  | 'WEEKEND'
  | 'STANDARD'
  | 'WEEK_PACKAGE'
  | 'MONTH_PACKAGE';

export interface RentalPriceResult {
  billedDays: number;
  billedHours: number;
  appliedRule: AppliedRule;
  /** Prix brut pour 1 exemplaire sur la periode (avant remise PRO). */
  grossUnitPrice: number;
  /** Economie longue duree vs (tarif jour x jours). */
  longDurationDiscount: number;
  /** Remise PRO en valeur. */
  proDiscount: number;
  /** Prix net pour 1 exemplaire. */
  unitPrice: number;
  /** unitPrice x quantite (HTVA). */
  linePrice: number;
  depositTotal: number;
}

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function toDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Nombre de jours factures pour une periode (arrondi superieur, min 1). */
export function computeBilledDays(
  period: RentalPeriod,
  settings: Pick<PricingSettings, 'sameDayCutoffHour'>,
): { billedDays: number; billedHours: number } {
  const start = toDate(period.start);
  const end = toDate(period.end);
  const ms = Math.max(0, end.getTime() - start.getTime());
  const billedHours = round2(ms / MS_PER_HOUR);

  if (sameCalendarDay(start, end) && end.getHours() <= settings.sameDayCutoffHour) {
    return { billedDays: 1, billedHours };
  }
  const days = Math.max(1, Math.ceil(ms / MS_PER_DAY));
  return { billedDays: days, billedHours };
}

/** Regle week-end : retrait vendredi/samedi, retour lundi avant l'heure de grace. */
export function isWeekendRule(period: RentalPeriod, settings: PricingSettings): boolean {
  if (!settings.weekendRuleEnabled) return false;
  const start = toDate(period.start);
  const end = toDate(period.end);
  const startDow = start.getDay(); // 0 dim .. 6 sam
  const endDow = end.getDay();
  const spanDays = (end.getTime() - start.getTime()) / MS_PER_DAY;
  const startOk = startDow === 5 || startDow === 6; // vendredi ou samedi
  const endOk = endDow === 1 && end.getHours() <= settings.weekendReturnGraceHour; // lundi
  return startOk && endOk && spanDays <= 3.5;
}

function sumTiers(tiers: PriceTier[], days: number): number {
  const sorted = [...tiers].sort((a, b) => a.minDays - b.minDays);
  let total = 0;
  for (let d = 1; d <= days; d++) {
    let perDay = sorted[0]?.perDay ?? 0;
    for (const t of sorted) {
      if (t.minDays <= d) perDay = t.perDay;
    }
    total += perDay;
  }
  return total;
}

function standardCost(pricing: ProductPricing, days: number): number {
  if (pricing.tiers && pricing.tiers.length > 0) return sumTiers(pricing.tiers, days);
  return pricing.dailyPrice * days;
}

/** Calcule le prix de location HTVA avec regles same-day / week-end / paquets / degressif / PRO. */
export function computeRentalPrice(input: RentalPriceInput): RentalPriceResult {
  const { pricing, period, quantity, customerType, settings } = input;
  const raw = computeBilledDays(period, settings);
  let billedDays = raw.billedDays;
  const billedHours = raw.billedHours;
  const rawBilledDays = raw.billedDays;

  let appliedRule: AppliedRule = 'STANDARD';
  let grossUnitPrice: number;

  if (isWeekendRule(period, settings)) {
    appliedRule = 'WEEKEND';
    billedDays = 1;
    grossUnitPrice = pricing.weekendPrice ?? pricing.dailyPrice;
  } else if (
    billedDays === 1 &&
    sameCalendarDay(toDate(period.start), toDate(period.end))
  ) {
    appliedRule = 'SAME_DAY';
    grossUnitPrice = pricing.dailyPrice;
  } else {
    // Compare tarif standard/degressif vs paquets semaine/mois.
    const candidates: Array<{ rule: AppliedRule; price: number }> = [
      { rule: 'STANDARD', price: standardCost(pricing, billedDays) },
    ];
    if (pricing.weekPrice && billedDays >= 7) {
      const weeks = Math.floor(billedDays / 7);
      const rest = billedDays % 7;
      candidates.push({
        rule: 'WEEK_PACKAGE',
        price: weeks * pricing.weekPrice + standardCost(pricing, rest),
      });
    }
    if (pricing.monthPrice && billedDays >= 30) {
      const months = Math.floor(billedDays / 30);
      const rest = billedDays % 30;
      candidates.push({
        rule: 'MONTH_PACKAGE',
        price: months * pricing.monthPrice + standardCost(pricing, rest),
      });
    }
    const best = candidates.reduce((a, b) => (b.price < a.price ? b : a));
    appliedRule = best.rule;
    grossUnitPrice = best.price;
  }

  grossUnitPrice = round2(grossUnitPrice);
  const flat = round2(pricing.dailyPrice * rawBilledDays);
  const longDurationDiscount = round2(Math.max(0, flat - grossUnitPrice));

  const proPct =
    customerType === 'PRO'
      ? pricing.proDiscountPct ?? settings.proDiscountPctDefault
      : 0;
  const proDiscount = round2(grossUnitPrice * proPct);
  const unitPrice = round2(grossUnitPrice - proDiscount);
  const linePrice = round2(unitPrice * quantity);
  const depositTotal = round2(pricing.deposit * quantity);

  return {
    billedDays,
    billedHours,
    appliedRule,
    grossUnitPrice,
    longDurationDiscount,
    proDiscount,
    unitPrice,
    linePrice,
    depositTotal,
  };
}

/* ----------------------- Livraison geolocalisee ----------------------- */

export interface DeliveryConfig {
  mode: 'BRACKETS' | 'PER_KM';
  brackets: { maxKm: number; feeHT: number }[];
  baseFeeHT: number;
  perKmHT: number;
  maxKm: number;
  freeThresholdHT: number;
}

export interface DeliveryQuote {
  served: boolean;
  distanceKm: number;
  feeHT: number;
  free: boolean;
  reason?: 'OUT_OF_RANGE' | 'FREE_THRESHOLD' | 'OK';
}

/**
 * Frais de livraison a partir de la distance routiere depot -> client.
 * `rentalHT` sert a appliquer la franchise (livraison offerte au-dela d'un montant).
 */
export function computeDeliveryFee(
  distanceKm: number,
  cfg: DeliveryConfig,
  rentalHT = 0,
): DeliveryQuote {
  const km = Math.max(0, round2(distanceKm));
  if (cfg.maxKm > 0 && km > cfg.maxKm) {
    return { served: false, distanceKm: km, feeHT: 0, free: false, reason: 'OUT_OF_RANGE' };
  }

  let feeHT: number;
  if (cfg.mode === 'PER_KM') {
    feeHT = round2(cfg.baseFeeHT + km * cfg.perKmHT);
  } else {
    const sorted = [...cfg.brackets].sort((a, b) => a.maxKm - b.maxKm);
    const hit = sorted.find((b) => km <= b.maxKm);
    if (!hit) {
      return { served: false, distanceKm: km, feeHT: 0, free: false, reason: 'OUT_OF_RANGE' };
    }
    feeHT = round2(hit.feeHT);
  }

  if (cfg.freeThresholdHT > 0 && rentalHT >= cfg.freeThresholdHT) {
    return { served: true, distanceKm: km, feeHT: 0, free: true, reason: 'FREE_THRESHOLD' };
  }
  return { served: true, distanceKm: km, feeHT, free: false, reason: 'OK' };
}

/** Distance a vol d'oiseau (km) entre deux points WGS84. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return round2(2 * R * Math.asin(Math.sqrt(s)));
}

export interface CartTotalsInput {
  /** Lignes deja calculees (location HTVA hors caution). */
  rentalLinesHT: number[];
  depositsTotal: number;
  deliveryFeeHT: number;
  extraFeesHT: number;
  discountHT: number;
  vatRate: number;
}

export interface CartTotals {
  rentalHT: number;
  deliveryFeeHT: number;
  extraFeesHT: number;
  discountHT: number;
  totalHT: number;
  vatRate: number;
  vatAmount: number;
  totalTVAC: number;
  depositsTotal: number;
  /** Montant a encaisser (TVAC + caution). */
  amountDue: number;
  /** Détail des remises (informatif). */
  promoDiscountHT?: number;
  composedPackDiscountHT?: number;
  composedPackPct?: number;
}

export function computeCartTotals(input: CartTotalsInput): CartTotals {
  const rentalHT = round2(input.rentalLinesHT.reduce((a, b) => a + b, 0));
  const discountHT = round2(Math.min(input.discountHT, rentalHT + input.extraFeesHT));
  const totalHT = round2(rentalHT + input.deliveryFeeHT + input.extraFeesHT - discountHT);
  const vatAmount = round2(totalHT * input.vatRate);
  const totalTVAC = round2(totalHT + vatAmount);
  return {
    rentalHT,
    deliveryFeeHT: round2(input.deliveryFeeHT),
    extraFeesHT: round2(input.extraFeesHT),
    discountHT,
    totalHT,
    vatRate: input.vatRate,
    vatAmount,
    totalTVAC,
    depositsTotal: round2(input.depositsTotal),
    amountDue: round2(totalTVAC + input.depositsTotal),
  };
}

/* ---------------------------------------------------------------------------
   « Pack composé » — remise selon le nombre de machines dans le panier.
   --------------------------------------------------------------------------- */

export interface ComposedPackConfig {
  enabled?: boolean;
  tiers?: { minMachines: number; pct: number }[];
}
export interface ComposedPackResult {
  /** Nombre de machines éligibles comptées. */
  machineCount: number;
  /** Taux de remise appliqué (0 si aucun palier atteint). */
  pct: number;
  /** Montant de la remise HT. */
  discountHT: number;
  /** Palier suivant (pour inciter : « encore N machines → X % »), ou null. */
  next: { minMachines: number; pct: number } | null;
}

/**
 * @param machineCount  quantité totale de machines éligibles (hors BricoPacks, hors Loiselet)
 * @param eligibleRentalHT  somme des locations HT de ces machines
 */
export function computeComposedPackDiscount(
  machineCount: number,
  eligibleRentalHT: number,
  config: ComposedPackConfig | null | undefined,
): ComposedPackResult {
  const tiers = [...(config?.tiers ?? [])].sort((a, b) => a.minMachines - b.minMachines);
  const off = { machineCount, pct: 0, discountHT: 0, next: tiers[0] ?? null };
  if (config?.enabled === false || tiers.length === 0 || machineCount < tiers[0]!.minMachines) {
    return off;
  }
  let current = tiers[0]!;
  let next: { minMachines: number; pct: number } | null = null;
  for (const t of tiers) {
    if (machineCount >= t.minMachines) current = t;
    else {
      next = t;
      break;
    }
  }
  return {
    machineCount,
    pct: current.pct,
    discountHT: round2(eligibleRentalHT * current.pct),
    next,
  };
}

/** Frais de retard : jours de retard x tarif jour x multiplicateur. */
export function computeLateFee(
  dailyPrice: number,
  hoursLate: number,
  multiplier: number,
): { daysLate: number; feeHT: number } {
  if (hoursLate <= 0) return { daysLate: 0, feeHT: 0 };
  const daysLate = Math.ceil(hoursLate / 24);
  return { daysLate, feeHT: round2(daysLate * dailyPrice * multiplier) };
}
