'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useCart } from '@/lib/providers';
import { fromLocalInput, toLocalInput, defaultPeriod } from '@/lib/dates';

export function HomeDatePicker() {
  const { setPeriod, setFulfilment } = useCart();
  const router = useRouter();
  const t = useTranslations('search');
  const d = defaultPeriod();
  const [start, setStart] = useState(toLocalInput(d.start));
  const [end, setEnd] = useState(toLocalInput(d.end));
  const [mode, setMode] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [busy, setBusy] = useState(false);

  async function go(withDates: boolean) {
    setBusy(true);
    try {
      if (withDates) {
        await setPeriod({ start: fromLocalInput(start), end: fromLocalInput(end) });
        await setFulfilment({ mode });
      }
      router.push('/catalogue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="datepicker-card">
      <strong style={{ color: 'var(--navy)' }}>{t('title')}</strong>
      <div className="field-2">
        <div className="field">
          <label>{t('startLabel')}</label>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('endLabel')}</label>
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>{t('modeLabel')}</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as 'PICKUP' | 'DELIVERY')}>
          <option value="PICKUP">{t('modePickup')}</option>
          <option value="DELIVERY">{t('modeDelivery')}</option>
        </select>
      </div>
      <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => go(true)}>
        {t('submit')}
      </button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => go(false)}>
        {t('skip')}
      </button>
      <p className="small muted center">{t('note')}</p>
    </div>
  );
}
