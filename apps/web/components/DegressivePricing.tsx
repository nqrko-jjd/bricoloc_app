'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Curseur « prix dégressif » (style concept .cslider).
 * Modèle Bricoloc : Semaine = 4 × tarif jour · Mois = 12 × tarif jour.
 */
const WEEK = 4;
const MONTH = 12;

function billedEquivalents(days: number): number {
  const months = Math.floor(days / 30);
  let rest = days % 30;
  const weeks = Math.floor(rest / 7);
  rest = rest % 7;
  return months * MONTH + weeks * WEEK + rest;
}

const STOPS = [1, 3, 7, 14, 30];

export function DegressivePricing() {
  const t = useTranslations('home');
  const [days, setDays] = useState(7);

  const discount = useMemo(
    () => Math.max(0, Math.round((1 - billedEquivalents(days) / days) * 100)),
    [days],
  );

  return (
    <div className="cslider">
      <div className="cslider__head">
        <span>{t('degressiveDuration')}</span>
        <b>{t('degressiveDays', { n: days })}</b>
      </div>
      <input
        type="range"
        min={1}
        max={30}
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        aria-label={t('degressiveDuration')}
      />
      <div className="cslider__ticks">
        {STOPS.map((d) => (
          <button
            key={d}
            type="button"
            className={days === d ? 'is-active' : undefined}
            onClick={() => setDays(d)}
          >
            {d} j.
          </button>
        ))}
      </div>
      <div className="cslider__foot">
        <span>{t('degressiveDiscount')}</span>
        <strong>−{discount}%</strong>
      </div>
    </div>
  );
}
