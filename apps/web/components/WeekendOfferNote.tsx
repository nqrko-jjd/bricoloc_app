'use client';
import { useTranslations } from 'next-intl';
import { periodQualifiesWeekend } from '@bricoloc/shared';
import { useConfig } from '@/lib/useConfig';

/**
 * Petit rappel « Offre week-end » affiché près de l'agenda quand la période
 * choisie y donne droit (retrait vendredi/samedi → retour lundi matin).
 * Même logique que le moteur de prix (`isWeekendRule`).
 */
export function WeekendOfferNote({
  start,
  end,
  className,
}: {
  start?: string | null;
  end?: string | null;
  className?: string;
}) {
  const t = useTranslations('search');
  const config = useConfig();

  if (!start || !end) return null;
  const wk = config?.weekend;
  if (wk && !wk.enabled) return null;

  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  if (
    !periodQualifiesWeekend(
      { start: s, end: e },
      { enabled: wk?.enabled, returnGraceHour: wk?.returnGraceHour },
    )
  ) {
    return null;
  }

  return <p className={className ?? 'weekend-note'}>🎉 {t('weekendOffer')}</p>;
}
