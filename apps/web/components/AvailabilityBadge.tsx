'use client';
import { useTranslations } from 'next-intl';
import type { Availability } from '@/lib/types';
import { formatDateBE } from '@bricoloc/shared';

export function AvailabilityBadge({ a }: { a?: Availability | null }) {
  const t = useTranslations('catalogue');
  if (!a) return <span className="avail avail-unknown">{t('availChooseDates')}</span>;
  if (a.status === 'AVAILABLE')
    return <span className="avail avail-ok">✔ {t('availOk')} ({a.availableQty})</span>;
  if (a.status === 'PARTIAL')
    return (
      <span className="avail avail-partial">
        ⚠ {t('availPartial', { available: a.availableQty, requested: a.requestedQty })}
      </span>
    );
  if (a.status === 'NEARBY')
    return (
      <span className="avail avail-nearby">
        {t('availNearby', {
          date: a.nearbyPeriod ? formatDateBE(a.nearbyPeriod.start) : '—',
        })}
      </span>
    );
  return <span className="avail avail-no">✖ {t('availNone')}</span>;
}
