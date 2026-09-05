'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function buildMonthGrid(monthDate: Date): (Date | null)[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = lundi
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Calendrier de sélection d'une période par clic sur le premier puis le dernier jour. */
export function DateRangePicker({
  onApply,
  onClose,
  initialStart,
  initialEnd,
}: {
  onApply: (start: Date, end: Date) => void;
  onClose: () => void;
  initialStart?: Date;
  initialEnd?: Date;
}) {
  const locale = useLocale();
  const t = useTranslations('catalogue');
  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(() =>
    addMonths(initialStart ? startOfDay(initialStart) : today, 0),
  );
  const [start, setStart] = useState<Date | null>(initialStart ? startOfDay(initialStart) : null);
  const [end, setEnd] = useState<Date | null>(initialEnd ? startOfDay(initialEnd) : null);
  const [hover, setHover] = useState<Date | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function pick(day: Date) {
    if (day < today) return;
    if (!start || end) {
      setStart(day);
      setEnd(null);
      return;
    }
    if (day < start) {
      setStart(day);
      setEnd(null);
      return;
    }
    setEnd(day);
  }

  function apply() {
    if (!start || !end) return;
    const s = new Date(start);
    s.setHours(8, 0, 0, 0);
    const e = new Date(end);
    e.setHours(18, 0, 0, 0);
    onApply(s, e);
  }

  const rangeEnd = end ?? hover;
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    weekdayFmt.format(new Date(2024, 0, 1 + i)),
  );
  const cells = buildMonthGrid(viewMonth);
  const dayCount =
    start && end ? Math.round((end.getTime() - start.getTime()) / 86400000) + 1 : 0;

  return (
    <div className="rangecal-overlay" onClick={onClose}>
      <div className="rangecal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="rangecal__head">
          <button
            type="button"
            className="rangecal__nav"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
            aria-label="←"
          >
            ‹
          </button>
          <strong>{monthFmt.format(viewMonth)}</strong>
          <button
            type="button"
            className="rangecal__nav"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            aria-label="→"
          >
            ›
          </button>
          <button type="button" className="rangecal__close" onClick={onClose} aria-label={t('rangeCancel')}>
            ✕
          </button>
        </div>
        <p className="rangecal__hint">
          {!start ? t('rangePickStart') : !end ? t('rangePickEnd') : t('rangeSummary', { count: dayCount })}
        </p>
        <div className="rangecal__weekdays">
          {weekdayLabels.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="rangecal__grid">
          {cells.map((day, i) => {
            if (!day) return <span key={i} className="rangecal__cell rangecal__cell--empty" />;
            const isPast = day < today;
            const isStart = !!start && sameDay(day, start);
            const isEnd = !!end && sameDay(day, end);
            const inRange = !!start && !!rangeEnd && day > start && day < rangeEnd;
            const cls = [
              'rangecal__cell',
              isPast ? 'is-disabled' : '',
              isStart ? 'is-start' : '',
              isEnd ? 'is-end' : '',
              inRange ? 'is-in-range' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                type="button"
                key={i}
                className={cls}
                disabled={isPast}
                onMouseEnter={() => setHover(day)}
                onClick={() => pick(day)}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
        <div className="rangecal__foot">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            {t('rangeCancel')}
          </button>
          <button type="button" className="btn btn-sm" disabled={!start || !end} onClick={apply}>
            {t('rangeApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
