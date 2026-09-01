'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/providers';
import { fromLocalInput, toLocalInput, defaultPeriod } from '@/lib/dates';

export function HomeDatePicker() {
  const { setPeriod, setFulfilment } = useCart();
  const router = useRouter();
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
      <strong style={{ color: 'var(--loc)' }}>Je connais mes dates</strong>
      <div className="field-2">
        <div className="field">
          <label>Date &amp; heure de début</label>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>Date &amp; heure de retour</label>
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Retrait ou livraison</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as 'PICKUP' | 'DELIVERY')}>
          <option value="PICKUP">Click &amp; Collect (retrait comptoir)</option>
          <option value="DELIVERY">Livraison à domicile / chantier</option>
        </select>
      </div>
      <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => go(true)}>
        Voir les machines disponibles
      </button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => go(false)}>
        Je préfère d&apos;abord choisir mes outils
      </button>
      <p className="small muted center">
        Vos dates restent mémorisées sur le site, l&apos;appli mobile et la borne.
      </p>
    </div>
  );
}
