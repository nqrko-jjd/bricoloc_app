/** Types et helpers de disponibilite (le calcul reel avec stock vit dans l'API). */

export interface Interval {
  start: Date | string;
  end: Date | string;
}

function ms(d: Date | string): number {
  return (typeof d === 'string' ? new Date(d) : d).getTime();
}

/** Deux intervalles se chevauchent-ils (bornes ouvertes a droite) ? */
export function overlaps(a: Interval, b: Interval): boolean {
  return ms(a.start) < ms(b.end) && ms(b.start) < ms(a.end);
}

/** Statut de disponibilite d'un article pour une periode. */
export type AvailabilityStatus =
  | 'AVAILABLE' // quantite demandee dispo sur toute la periode
  | 'PARTIAL' // dispo mais quantite inferieure a la demande
  | 'UNAVAILABLE' // rien de dispo sur la periode
  | 'NEARBY'; // indispo sur la periode mais dispo sur une periode proche

export interface AvailabilityResult {
  productId: string;
  requestedQty: number;
  availableQty: number;
  totalUnits: number;
  status: AvailabilityStatus;
  /** Proposition de periode proche si NEARBY. */
  nearbyPeriod?: { start: string; end: string } | null;
  /** Ids de produits alternatifs compatibles disponibles. */
  alternativeProductIds: string[];
}

export function statusFor(
  requestedQty: number,
  availableQty: number,
): Exclude<AvailabilityStatus, 'NEARBY'> {
  if (availableQty <= 0) return 'UNAVAILABLE';
  if (availableQty < requestedQty) return 'PARTIAL';
  return 'AVAILABLE';
}
