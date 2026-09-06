'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Sélecteur « prix dégressif » de l'accueil (style concept .cslider).
 *
 * Montre sur un exemple concret (outil à 20 €/jour) comment le prix PAR JOUR
 * baisse quand on garde l'outil plus longtemps — c'est ça le message, pas le %.
 * Courbe = « Option A » validée : palier dès 3 j (chaque jour au-delà de 2 à
 * −65 %), forfait semaine ×3,5, forfait mois ×12.
 *   1 j → 20 €/j · 3 j → 15,70 €/j (−22 %) · 1 sem. → 10 €/j (−50 %) · 1 mois → 8 €/j (−60 %)
 */
const DAILY = 20;

const STEPS = [
  { key: 'day', days: 1, total: 1 },
  { key: 'day3', days: 3, total: 2.35 },
  { key: 'week', days: 7, total: 3.5 },
  { key: 'month', days: 30, total: 12 },
] as const;

const eur = (n: number) => (n % 1 === 0 ? `${n} €` : `${n.toFixed(2).replace('.', ',')} €`);

export function DegressivePricing() {
  const t = useTranslations('home');
  const [i, setI] = useState(2); // « 1 semaine » par défaut
  const step = STEPS[i]!;
  const perDay = Math.round(((DAILY * step.total) / step.days) * 100) / 100;
  const total = Math.round(DAILY * step.total);
  const discount = Math.round((1 - step.total / step.days) * 100);

  return (
    <div className="cslider">
      <div className="cslider__head">
        <span>{t('degressiveExample', { price: eur(DAILY) })}</span>
        <b>{t(`degressiveStep_${step.key}` as never)}</b>
      </div>

      <input
        type="range"
        min={0}
        max={STEPS.length - 1}
        step={1}
        value={i}
        onChange={(e) => setI(Number(e.target.value))}
        aria-label={t('degressiveDuration')}
      />
      <div className="cslider__ticks cslider__ticks--even">
        {STEPS.map((s, idx) => (
          <button
            key={s.key}
            type="button"
            className={i === idx ? 'is-active' : undefined}
            onClick={() => setI(idx)}
          >
            {t(`degressiveStep_${s.key}` as never)}
          </button>
        ))}
      </div>

      <div className="cslider__foot">
        <div className="cslider__price">
          <span>{t('degressivePerDayLabel')}</span>
          <strong>
            {eur(perDay)}
            <em>&nbsp;/&nbsp;{t('degressivePerDayUnit')}</em>
          </strong>
          {discount > 0 && <small>{t('degressiveInstead', { price: eur(DAILY) })}</small>}
        </div>
        <div className="cslider__save">
          {discount > 0 ? (
            <span className="cslider__badge">−{discount}%</span>
          ) : (
            <span className="cslider__badge cslider__badge--full">{t('degressiveFull')}</span>
          )}
          {discount > 0 && (
            <small>{t('degressiveTotal', { price: eur(total), days: step.days })}</small>
          )}
        </div>
      </div>
    </div>
  );
}
