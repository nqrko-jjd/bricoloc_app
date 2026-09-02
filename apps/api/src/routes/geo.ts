/**
 * Autocomplétion d'adresses (type Google Maps) — proxy vers Photon (komoot),
 * basé sur OpenStreetMap, gratuit et sans clé. Restreint à la Belgique.
 */
import { Router } from 'express';
import { h, badRequest } from '../lib/http.js';

export const geoRouter = Router();

const UA = 'BricolocApp/1.0 (https://www.bricoloc.be)';
// Cache mémoire court (les frappes successives repassent souvent sur les mêmes préfixes).
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 10 * 60_000;

interface PhotonFeature {
  properties: {
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    countrycode?: string;
  };
  geometry: { coordinates: [number, number] };
}

geoRouter.get(
  '/autocomplete',
  h(async (req, res) => {
    const q = String(req.query.q ?? '').trim().slice(0, 120);
    if (q.length < 3) return res.json({ suggestions: [] });

    const key = q.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return res.json(hit.data);

    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
      `&lang=fr&limit=8&lat=50.64&lon=4.66&bbox=2.5,49.49,6.41,51.51`;

    let features: PhotonFeature[] = [];
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) features = ((await r.json()) as { features: PhotonFeature[] }).features ?? [];
    } catch {
      throw badRequest('Service d’adresses indisponible');
    }

    const seen = new Set<string>();
    const suggestions = features
      .filter((f) => f.properties.countrycode === 'BE')
      .filter((f) => ['place', 'building', 'highway', 'address'].includes(f.properties.osm_key ?? ''))
      .map((f) => {
        const p = f.properties;
        const street = p.street || p.name || '';
        const line1 = [street, p.housenumber].filter(Boolean).join(' ');
        return {
          line1,
          street,
          housenumber: p.housenumber ?? '',
          postalCode: p.postcode ?? '',
          city: p.city || p.district || '',
          region: p.state ?? '',
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          label: [line1, [p.postcode, p.city || p.district].filter(Boolean).join(' ')]
            .filter(Boolean)
            .join(', '),
        };
      })
      .filter((s) => {
        if (!s.line1 || !s.city) return false;
        const k = `${s.line1}|${s.postalCode}|${s.city}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 6);

    const payload = { suggestions };
    cache.set(key, { at: Date.now(), data: payload });
    if (cache.size > 500) cache.clear();
    res.json(payload);
  }),
);
