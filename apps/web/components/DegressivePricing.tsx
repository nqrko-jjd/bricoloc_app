'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Curseur « prix dégressif » de l'accueil.
 * Modèle Bricoloc : Semaine = 4 × tarif jour · Mois = 12 × tarif jour.
 * On calcule, pour une durée, le meilleur assemblage (jours + semaines + mois)
 * et on l'exprime en réduction vs le tarif jour à plat.
 */
const WEEK = 4; // jours facturés pour 7 jours de location
const MONTH = 12; // jours facturés pour 30 jours

function billedDayEquivalents(days: number): number {
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

  const discountPct = useMemo(() => {
    const flat = days;
    const billed = billedDayEquivalents(days);
    return Math.round((1 - billed / flat) * 100);
  }, [days]);

  return (
    <div className="degressive">
      <div className="degressive__copy">
        <span className="eyebrow">{t('degressiveEyebrow')}</span>
        <h2>
          {t('degressiveTitle')} <em>{t('degressiveTitleAccent')}</em>
        </h2>
        <p className="muted">{t('degressiveText')}</p>
      </div>

      <div className="degressive__panel">
        <label className="degressive__label" htmlFor="degressive-range">
          {t('degressiveDuration')}
        </label>
        <output className="degressive__days">{t('degressiveDays', { n: days })}</output>
        <input
          id="degressive-range"
          type="range"
          min={1}
          max={30}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="degressive__range"
        />
        <div className="degressive__ticks" aria-hidden>
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

        <div className="degressive__result">
          <span>{t('degressiveDiscount')}</span>
          <strong>−{Math.max(0, discountPct)}%</strong>
        </div>
      </div>
    </div>
  );
}
