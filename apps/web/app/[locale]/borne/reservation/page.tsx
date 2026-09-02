'use client';
import { Suspense, useState } from 'react';
import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { formatDateTimeBE, SUPPORTED_LOCALES, type Locale } from '@bricoloc/shared';
import { api } from '@/lib/api';
import { OnScreenKeyboard } from '@/components/OnScreenKeyboard';
import { KioskFrame } from '@/components/kiosk/KioskFrame';

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
  const pathname = usePathname();
  const params = useParams();
  const locale = useLocale() as Locale;
  const [code, setCode] = useState('');
  const [res, setRes] = useState<Lookup | null>(null);
  const [err, setErr] = useState('');

  const switchLocale = (l: Locale) =>
    // @ts-expect-error params dynamiques transmis tels quels
    router.replace({ pathname, params }, { locale: l });

  async function search() {
    setErr('');
    setRes(null);
    try {
      const r = await api<{ reservation: Lookup }>('/api/public/reservation/lookup', {
        method: 'POST',
        body: { token: code.trim() },
      });
      setRes(r.reservation);
    } catch {
      setErr('Aucune réservation trouvée pour ce code.');
    }
  }

  return (
    <KioskFrame locale={locale} locales={SUPPORTED_LOCALES} onLocale={switchLocale}>
      <div className="kiosk-pad">
      <button className="kiosk-back kiosk-back--inline" onClick={() => router.push('/borne')}>
        ← Accueil
      </button>
      <h1>Ma réservation</h1>
      <p className="kiosk-sub">
        Saisissez votre numéro de réservation (BRL-…) ou le code de votre QR (R-…).
      </p>

      {!res && (
        <div style={{ maxWidth: 760, width: '100%' }}>
          <OnScreenKeyboard value={code} onChange={setCode} onEnter={search} />
          <button className="btn btn-primary btn-lg" style={{ marginTop: 16 }} onClick={search}>
            Rechercher
          </button>
          {err && (
            <div className="alert alert-err" style={{ marginTop: 12 }}>
              {err}
            </div>
          )}
        </div>
      )}

      {res && (
        <div className="card card-pad" style={{ maxWidth: 620, width: '100%', color: 'var(--dark-gray)' }}>
          <h2>{res.number}</h2>
          <p style={{ fontWeight: 700, color: 'var(--brico)' }}>
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
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setRes(null)}>
              Nouvelle recherche
            </button>
            <button className="btn btn-primary" onClick={() => router.push('/borne')}>
              Terminer
            </button>
          </div>
        </div>
      )}
      </div>
    </KioskFrame>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="kiosk-body">Chargement…</div>}>
      <KioskReservation />
    </Suspense>
  );
}
