'use client';
import { Suspense, useState } from 'react';
import { formatDateTimeBE } from '@bricoloc/shared';
import { api } from '@/lib/api';
import { useRouter } from '@/i18n/navigation';
import { ScanField } from '@/components/admin/ScanField';

interface Lookup {
  number: string;
  status: string;
  firstName: string | null;
  periodStart: string;
  periodEnd: string;
  fulfilmentMode: string;
  slot: string | null;
  items: { name: string; quantity: number; kind: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmée — en attente de préparation',
  PREPARING: 'En préparation',
  READY: 'Prête ! Présentez-vous au comptoir',
  OUT: 'Matériel en votre possession',
  RETURN_PENDING: 'Retour attendu',
  CLOSED: 'Clôturée',
};

function KioskReservation() {
  const router = useRouter();
  const [mode, setMode] = useState<'code' | 'name'>('code');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [res, setRes] = useState<Lookup | null>(null);
  const [list, setList] = useState<Lookup[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function lookup(body: Record<string, string>) {
    setErr('');
    setRes(null);
    setList(null);
    setBusy(true);
    try {
      const r = await api<{ reservation?: Lookup; reservations?: Lookup[] }>(
        '/api/public/reservation/lookup',
        { method: 'POST', body },
      );
      if (r.reservation) setRes(r.reservation);
      else if (r.reservations) setList(r.reservations);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Aucune réservation trouvée.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kioskm-page">
      <button className="kioskm-back" onClick={() => router.push('/borne')}>
        ← Accueil
      </button>
      <h1>Ma réservation</h1>

      {!res && !list && (
        <>
          <p className="kioskm-sub">
            Scannez le QR code de votre confirmation, ou retrouvez votre réservation.
          </p>

          <div className="kioskm-tabs">
            <button
              className={mode === 'code' ? 'is-on' : ''}
              onClick={() => setMode('code')}
            >
              Scanner / n° de réservation
            </button>
            <button
              className={mode === 'name' ? 'is-on' : ''}
              onClick={() => setMode('name')}
            >
              Nom + téléphone
            </button>
          </div>

          {mode === 'code' && (
            <div style={{ maxWidth: 620 }}>
              <ScanField
                placeholder="Scanner le QR, ou taper BRL-… / R-…"
                onScan={(code) => lookup({ token: code })}
              />
            </div>
          )}

          {mode === 'name' && (
            <div className="kioskm-form" style={{ maxWidth: 520 }}>
              <label className="field">
                <span>Nom de famille</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dupont" />
              </label>
              <label className="field">
                <span>Téléphone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0470 12 34 56"
                  inputMode="tel"
                />
              </label>
              <button
                className="btn btn-primary btn-lg"
                disabled={busy || !name.trim() || phone.replace(/\D/g, '').length < 6}
                onClick={() => lookup({ name: name.trim(), phone })}
              >
                Rechercher
              </button>
            </div>
          )}

          {err && (
            <div className="alert alert-warn" style={{ marginTop: 16, maxWidth: 620 }}>
              {err}
            </div>
          )}
        </>
      )}

      {list && (
        <div style={{ maxWidth: 620, display: 'grid', gap: 12 }}>
          <p className="kioskm-sub">Plusieurs réservations correspondent :</p>
          {list.map((r) => (
            <button key={r.number} className="kioskm-reslist" onClick={() => setRes(r)}>
              <strong>{r.number}</strong>
              <span>
                {formatDateTimeBE(r.periodStart)} · {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </button>
          ))}
          <button className="btn btn-ghost" onClick={() => setList(null)}>
            Nouvelle recherche
          </button>
        </div>
      )}

      {res && (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <h2 style={{ marginTop: 0 }}>{res.number}</h2>
          <p style={{ fontWeight: 800, color: 'var(--primary)' }}>
            {STATUS_LABEL[res.status] ?? res.status}
          </p>
          {res.firstName && <p>Bonjour {res.firstName} 👋</p>}
          <p className="small muted">
            {formatDateTimeBE(res.periodStart)} → {formatDateTimeBE(res.periodEnd)} ·{' '}
            {res.fulfilmentMode === 'DELIVERY' ? 'Livraison' : 'Retrait comptoir'}
            {res.slot ? ` · ${res.slot}` : ''}
          </p>
          <ul>
            {res.items.map((i, idx) => (
              <li key={idx}>
                {i.quantity}× {i.name}
              </li>
            ))}
          </ul>
          <div className="row" style={{ gap: 12, marginTop: 8 }}>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setRes(null);
                setList(null);
              }}
            >
              Nouvelle recherche
            </button>
            <button className="btn btn-primary" onClick={() => router.push('/borne')}>
              Terminer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="kioskm-page">Chargement…</div>}>
      <KioskReservation />
    </Suspense>
  );
}
