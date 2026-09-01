/**
 * Géocodage + distance routière pour la tarification livraison.
 * - Géocodage : Nominatim/OSM (gratuit, sans clé), résultats mis en cache (GeoCache).
 * - Distance : OSRM public (route réelle) ; repli sur vol d'oiseau × facteur.
 */
import { haversineKm } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { getSettings } from './settings.js';

const UA = 'BricolocApp/1.0 (https://www.bricoloc.be; david@jjd-consult.be)';

export interface GeoPoint {
  lat: number;
  lng: number;
  displayName?: string;
}

export interface AddressInput {
  line1?: string;
  line2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

function addressKey(a: AddressInput): string {
  return [a.line1, a.postalCode, a.city, a.country ?? 'BE']
    .filter(Boolean)
    .join(', ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Géocode une adresse (cache DB). Renvoie null si introuvable. */
export async function geocode(a: AddressInput): Promise<GeoPoint | null> {
  const key = addressKey(a);
  if (!key) return null;

  const cached = await prisma.geoCache.findUnique({ where: { query: key } }).catch(() => null);
  if (cached) return { lat: cached.lat, lng: cached.lng, displayName: cached.displayName ?? undefined };

  type Row = { lat: string; lon: string; display_name: string };
  const country = a.country ?? 'Belgium';
  const hit = async (qs: string): Promise<Row | null> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'fr' },
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as Row[];
      return rows[0] ?? null;
    } catch {
      return null;
    }
  };

  try {
    // 1) adresse structurée complète
    let r: Row | null = null;
    if (a.line1 || a.city || a.postalCode) {
      const p = new URLSearchParams({ format: 'jsonv2', limit: '1', country });
      if (a.line1) p.set('street', a.line1);
      if (a.city) p.set('city', a.city);
      if (a.postalCode) p.set('postalcode', a.postalCode);
      r = await hit(p.toString());
    }
    // 2) requête libre
    if (!r) r = await hit(`format=jsonv2&limit=1&q=${encodeURIComponent(key)}`);
    // 3) repli : code postal + ville seulement (suffisant pour la distance)
    if (!r && (a.postalCode || a.city)) {
      const p = new URLSearchParams({ format: 'jsonv2', limit: '1', country });
      if (a.city) p.set('city', a.city);
      if (a.postalCode) p.set('postalcode', a.postalCode);
      r = await hit(p.toString());
    }
    if (!r && a.postalCode) {
      r = await hit(`format=jsonv2&limit=1&q=${encodeURIComponent(`${a.postalCode} ${country}`)}`);
    }
    if (!r) return null;
    const point: GeoPoint = {
      lat: Number(r.lat),
      lng: Number(r.lon),
      displayName: r.display_name,
    };
    await prisma.geoCache
      .create({
        data: { query: key, lat: point.lat, lng: point.lng, displayName: point.displayName ?? null },
      })
      .catch(() => undefined);
    return point;
  } catch (err) {
    console.warn('[geo] géocodage échoué:', (err as Error).message);
    return null;
  }
}

/** Distance routière (km) via OSRM ; repli vol d'oiseau × detourFactor. */
export async function roadDistanceKm(from: GeoPoint, to: GeoPoint): Promise<number> {
  const s = await getSettings();
  const factor = Number((s.delivery as { detourFactor?: number })?.detourFactor ?? 1.3);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const json = (await res.json()) as { code: string; routes?: { distance: number }[] };
      if (json.code === 'Ok' && json.routes?.[0]) {
        return Math.round((json.routes[0].distance / 1000) * 10) / 10;
      }
    }
  } catch {
    /* repli */
  }
  return Math.round(haversineKm(from, to) * factor * 10) / 10;
}

/** Position du dépôt (Setting delivery.depotLat/Lng). */
export async function depotPoint(): Promise<GeoPoint> {
  const s = await getSettings();
  const d = s.delivery as { depotLat?: number; depotLng?: number; depotAddress?: string };
  return { lat: Number(d?.depotLat ?? 50.7712), lng: Number(d?.depotLng ?? 4.2621), displayName: d?.depotAddress };
}
