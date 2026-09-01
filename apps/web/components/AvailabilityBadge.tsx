import type { Availability } from '@/lib/types';
import { formatDateBE } from '@bricoloc/shared';

export function AvailabilityBadge({ a }: { a?: Availability | null }) {
  if (!a) return <span className="avail avail-unknown">Choisissez vos dates</span>;
  if (a.status === 'AVAILABLE')
    return <span className="avail avail-ok">✔ Disponible ({a.availableQty})</span>;
  if (a.status === 'PARTIAL')
    return (
      <span className="avail avail-partial">
        ⚠ {a.availableQty} dispo sur {a.requestedQty} demandé(s)
      </span>
    );
  if (a.status === 'NEARBY')
    return (
      <span className="avail avail-nearby">
        Indispo — libre dès le {a.nearbyPeriod ? formatDateBE(a.nearbyPeriod.start) : 'bientôt'}
      </span>
    );
  return <span className="avail avail-no">✖ Indisponible sur la période</span>;
}
