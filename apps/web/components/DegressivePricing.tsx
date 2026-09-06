'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Sélecteur « prix dégressif » (style concept .cslider).
 * Modèle Bricoloc : Semaine = 4 × tarif jour · Mois = 12 × tarif jour.
 * 3 positions nettes (jour / semaine / mois) : un vrai curseur continu de
 * 1 à 30 jours donnait une courbe en dents de scie (un jour de plus après
 * une semaine faisait *remonter* le prix moyen) — déroutant.
 */
const STEPS = [
  { key: 'day', days: 1, billed: 1 },
  { key: 'week', days: 7, billed: 4 },
  { key: 'month', days: 30, billed: 12 },
] as const;

export function DegressivePricing() {
  const t = useTranslations('home');
  const [i, setI] = useState(1);
  const step = STEPS[i]!;
  const discount = Math.round((1 - step.billed / step.days) * 100);

  return (
    <div className="cslider">
      <div className="cslider__head">
        <span>{t('degressiveDuration')}</span>
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
        <span>{t('degressiveDiscount')}</span>
        <strong>{discount > 0 ? `−${discount}%` : t('degressiveFull')}</strong>
      </div>
    </div>
  );
}
