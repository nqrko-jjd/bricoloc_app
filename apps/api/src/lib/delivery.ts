import {
  computeDeliveryFee,
  computeTimeDistanceDelivery,
  type DeliveryConfig,
  type DeliveryQuote,
  type TimeDistanceDeliveryBreakdown,
  type TimeDistanceDeliveryConfig,
} from '@bricoloc/shared';
import { geocode, routeInfo, depotPoint, type AddressInput } from './geo.js';
import { getSettings, vatRate } from './settings.js';

export interface DeliveryQuoteResult extends DeliveryQuote {
  geocoded: boolean;
  address?: string;
}

function toConfig(s: Record<string, unknown>): DeliveryConfig {
  const d = (s.delivery as Record<string, unknown>) ?? {};
  return {
    mode: (d.mode as 'BRACKETS' | 'PER_KM') ?? 'BRACKETS',
    brackets: (d.brackets as { maxKm: number; feeHT: number }[]) ?? [
      { maxKm: 15, feeHT: 25 },
      { maxKm: 30, feeHT: 40 },
      { maxKm: 50, feeHT: 65 },
    ],
    baseFeeHT: Number(d.baseFeeHT ?? 20),
    perKmHT: Number(d.perKmHT ?? 1.2),
    maxKm: Number(d.maxKm ?? 50),
    freeThresholdHT: Number(d.freeThresholdHT ?? 350),
    saturdaySurchargeHT: Number(d.saturdaySurchargeHT ?? 0),
  };
}

function toTimeDistanceConfig(s: Record<string, unknown>): TimeDistanceDeliveryConfig {
  const d = (s.delivery as Record<string, unknown>)?.timeDistance as Record<string, unknown> | undefined;
  return {
    hourlyRateHT: Number(d?.hourlyRateHT ?? 12.5),
    perKmHT: Number(d?.perKmHT ?? 0.4),
    handlingMinutes: Number(d?.handlingMinutes ?? 30),
    fixedFeeHT: Number(d?.fixedFeeHT ?? 3.75),
    groupingDiscountPct: Number(d?.groupingDiscountPct ?? 0.3),
    marginPct: Number(d?.marginPct ?? 0.2),
    minFeeTVAC: Number(d?.minFeeTVAC ?? 39),
    premiumFeeTVACPerLeg: Number(d?.premiumFeeTVACPerLeg ?? 25),
    maxKmOneWay: Number(d?.maxKmOneWay ?? 50),
    saturdaySurchargeTVAC: Number(d?.saturdaySurchargeTVAC ?? 0),
  };
}

/**
 * Devis livraison depuis une adresse client : géocodage -> distance depuis le
 * dépôt -> tarif (tranches km ou au km). `rentalHT` applique la franchise.
 */
export async function quoteDelivery(
  address: AddressInput,
  rentalHT = 0,
  deliveryDate?: Date | string,
): Promise<DeliveryQuoteResult> {
  const s = await getSettings();
  const cfg = toConfig(s);

  const point = await geocode(address);
  if (!point) {
    return {
      served: false,
      distanceKm: 0,
      feeHT: 0,
      free: false,
      reason: 'OUT_OF_RANGE',
      saturdaySurchargeHT: 0,
      geocoded: false,
    };
  }
  const depot = await depotPoint();
  const route = await routeInfo(depot, point);
  const quote = computeDeliveryFee(route.distanceKm, cfg, rentalHT, deliveryDate);
  return { ...quote, geocoded: true, address: point.displayName };
}

export interface TimeDistanceQuoteResult {
  served: boolean;
  geocoded: boolean;
  address?: string;
  /** Motif quand `served` est faux : adresse introuvable, hors zone, ou credentials manquants. */
  reason?: 'ADDRESS_NOT_FOUND' | 'OUT_OF_RANGE';
  message?: string;
  routed: boolean;
  breakdown?: TimeDistanceDeliveryBreakdown;
}

/**
 * Devis « forfait temps + distance » (livraison + reprise, une seule fois par
 * commande). Geocodage -> itineraire routier reel (distance + temps ALLER) ->
 * formule (voir `computeTimeDistanceDelivery`).
 *
 * Une adresse introuvable n'est JAMAIS interpretee comme un trajet de 0 km :
 * elle bloque le devis (`served:false`, `reason:'ADDRESS_NOT_FOUND'`) pour
 * demander une correction — validation manuelle possible cote equipe (edition
 * de reservation en admin).
 */
export async function quoteTimeDistanceDelivery(
  address: AddressInput,
  opts: { premiumOut?: boolean; premiumReturn?: boolean; deliveryDate?: Date | string } = {},
): Promise<TimeDistanceQuoteResult> {
  const s = await getSettings();
  const cfg = toTimeDistanceConfig(s);
  const rate = vatRate(s);

  const point = await geocode(address);
  if (!point) {
    return {
      served: false,
      geocoded: false,
      routed: false,
      reason: 'ADDRESS_NOT_FOUND',
      message: "Adresse introuvable — merci de la corriger. L'équipe peut aussi valider manuellement.",
    };
  }
  const depot = await depotPoint();
  const route = await routeInfo(depot, point);

  const isSaturday = opts.deliveryDate != null && new Date(opts.deliveryDate).getDay() === 6;
  const breakdown = computeTimeDistanceDelivery(
    {
      distanceKmOneWay: route.distanceKm,
      minutesOneWay: route.minutes,
      premiumOut: !!opts.premiumOut,
      premiumReturn: !!opts.premiumReturn,
      isSaturday,
    },
    cfg,
    rate,
  );

  if (breakdown.outOfRange) {
    return {
      served: false,
      geocoded: true,
      address: point.displayName,
      routed: route.routed,
      reason: 'OUT_OF_RANGE',
      message: `Hors zone pour ce mode de livraison (${route.distanceKm} km du dépôt, max ${cfg.maxKmOneWay} km). Contactez-nous pour un devis.`,
      breakdown,
    };
  }

  return { served: true, geocoded: true, address: point.displayName, routed: route.routed, breakdown };
}
