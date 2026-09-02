'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTimeBE } from '@bricoloc/shared';
import { useCart } from '@/lib/providers';
import { fromLocalInput, toLocalInput, defaultPeriod, durationLabel } from '@/lib/dates';

/** Bandeau global rappelant la periode choisie, modifiable a tout moment. */
export function DateRangeBar() {
  const { cart, setPeriod } = useCart();
  const t = useTranslations('dateBar');
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cart?.period) {
      setStart(toLocalInput(cart.period.start));
      setEnd(toLocalInput(cart.period.end));
    } else {
      const d = defaultPeriod();
      setStart(toLocalInput(d.start));
      setEnd(toLocalInput(d.end));
    }
  }, [cart?.period]);

  async function save() {
    setBusy(true);
    try {
      await setPeriod({ start: fromLocalInput(start), end: fromLocalInput(end) });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  const p = cart?.period;

  // Bandeau visible seulement quand une période est choisie (rappel + édition).
  // Sinon on ne l'affiche pas : les dates se saisissent au catalogue / à la fiche.
  if (!p && !editing) return null;

  return (
    <div className="datebar">
      <div className="container">
        {!editing && p && (
          <>
            <span>
              📅 {t('period')}&nbsp;: <strong>{formatDateTimeBE(p.start)}</strong> →{' '}
              <strong>{formatDateTimeBE(p.end)}</strong> ({durationLabel(p.start, p.end)})
            </span>
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              {t('edit')}
            </button>
          </>
        )}
        {!editing && !p && (
          <>
            <span>📅 {t('noDates')}</span>
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              {t('chooseDates')}
            </button>
          </>
        )}
        {editing && (
          <>
            <label className="small">
              {t('start')}&nbsp;
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="small">
              {t('return')}&nbsp;
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <button className="btn btn-sm" onClick={save} disabled={busy}>
              {busy ? '…' : t('apply')}
            </button>
            {p && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setEditing(false)}
              >
                {t('cancel')}
              </button>
            )}
            {p && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setPeriod(null)}
                title={t('browseWithoutDates')}
              >
                {t('clear')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
