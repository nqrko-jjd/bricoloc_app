'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateBE } from '@bricoloc/shared';
import { useCart } from '@/lib/providers';
import { durationLabel } from '@/lib/dates';
import { DateRangePicker } from '@/components/DateRangePicker';

/**
 * Bandeau global rappelant la période choisie, modifiable à tout moment via le
 * calendrier (clic sur le 1er puis le dernier jour). Jours seulement : l'heure
 * d'arrivée se choisit à la commande (retrait ou livraison).
 */
export function DateRangeBar() {
  const { cart, setPeriod } = useCart();
  const t = useTranslations('dateBar');
  const [picking, setPicking] = useState(false);
  const p = cart?.period;

  // Visible seulement quand une période est choisie : sinon on ne l'affiche pas,
  // les dates se saisissent au catalogue, à la fiche produit ou dans le panier.
  if (!p) return null;

  return (
    <div className="datebar">
      <div className="container">
        <span>
          📅 {t('period')}&nbsp;: <strong>{formatDateBE(p.start)}</strong> →{' '}
          <strong>{formatDateBE(p.end)}</strong> ({durationLabel(p.start, p.end)})
        </span>
        <button className="btn btn-sm" onClick={() => setPicking(true)}>
          {t('edit')}
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setPeriod(null)}
          title={t('browseWithoutDates')}
        >
          {t('clear')}
        </button>
      </div>
      {picking && (
        <DateRangePicker
          initialStart={new Date(p.start)}
          initialEnd={new Date(p.end)}
          onClose={() => setPicking(false)}
          onApply={async (s, e) => {
            await setPeriod({ start: s.toISOString(), end: e.toISOString() });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
