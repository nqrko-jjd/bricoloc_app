import { computeDeliveryFee, type DeliveryConfig, type DeliveryQuote } from '@bricoloc/shared';
import { geocode, roadDistanceKm, depotPoint, type AddressInput } from './geo.js';
import { getSettings } from './settings.js';

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
  };
}

/**
 * Devis livraison depuis une adresse client : géocodage -> distance depuis le
 * dépôt -> tarif (tranches km ou au km). `rentalHT` applique la franchise.
 */
export async function quoteDelivery(
  address: AddressInput,
  rentalHT = 0,
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
      geocoded: false,
    };
  }
  const depot = await depotPoint();
  const km = await roadDistanceKm(depot, point);
  const quote = computeDeliveryFee(km, cfg, rentalHT);
  return { ...quote, geocoded: true, address: point.displayName };
}
