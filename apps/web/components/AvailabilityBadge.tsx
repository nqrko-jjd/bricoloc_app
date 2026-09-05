'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Availability } from '@/lib/types';
import { formatDateBE } from '@bricoloc/shared';
import { useCart } from '@/lib/providers';
import { DateRangePicker } from './DateRangePicker';

export function AvailabilityBadge({ a }: { a?: Availability | null }) {
  const t = useTranslations('catalogue');
  const { setPeriod } = useCart();
  const [open, setOpen] = useState(false);

  if (!a)
    return (
      <>
        <button
          type="button"
          className="avail avail-unknown avail-clickable"
          onClick={() => setOpen(true)}
        >
          {t('availChooseDates')}
        </button>
        {open && (
          <DateRangePicker
            onClose={() => setOpen(false)}
            onApply={(start, end) => {
              setPeriod({ start: start.toISOString(), end: end.toISOString() });
              setOpen(false);
            }}
          />
        )}
      </>
    );
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
