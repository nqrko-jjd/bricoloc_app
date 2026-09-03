'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Status = {
  status: string;
  paid: boolean;
  failed: boolean;
  number?: string;
  qrDataUrl?: string;
  invoiceNumber?: string | null;
  fulfilment?: { mode: string; pickupPoint?: { name: string; line1: string; postalCode: string; city: string; transferHours: number } | null };
};

export default function PaymentReturnPage() {
  const params = useSearchParams();
  const r = params.get('r') ?? '';
  const [st, setSt] = useState<Status | null>(null);
  const [tries, setTries] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!r) return;
    let alive = true;
    async function poll() {
      try {
        const s = await api<Status>(`/api/checkout/mollie/status?r=${encodeURIComponent(r)}`);
        if (!alive) return;
        setSt(s);
        if (!s.paid && !s.failed && tries < 20) {
          timer.current = setTimeout(() => setTries((t) => t + 1), 2000);
        }
      } catch {
        if (alive && tries < 20) timer.current = setTimeout(() => setTries((t) => t + 1), 2500);
      }
    }
    poll();
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [r, tries]);

  if (!r) {
    return (
      <div className="section container">
        <h1>Paiement</h1>
        <p className="muted">Référence de commande manquante.</p>
        <Link href="/panier" className="btn btn-primary">Retour au panier</Link>
      </div>
    );
  }

  const pending = !st || (!st.paid && !st.failed);

  return (
    <div className="section container">
      <h1>Paiement</h1>
      <div className="card card-pad stack center" style={{ alignItems: 'center', maxWidth: 520, margin: '0 auto' }}>
        {pending && (
          <>
            <span className="spinner" />
            <h2>Vérification du paiement…</h2>
            <p className="muted small">
              Ne fermez pas cette page. La confirmation arrive dès que la banque a répondu.
            </p>
          </>
        )}

        {st?.failed && (
          <>
            <h2>Paiement non abouti</h2>
            <p className="muted small">
              Le paiement a été annulé ou refusé. Votre panier est conservé, vous pouvez réessayer.
            </p>
            <Link href="/commande" className="btn btn-primary">Réessayer le paiement</Link>
          </>
        )}

        {st?.paid && (
          <>
            <h2>Réservation confirmée 🎉</h2>
            {st.number && <p className="price">{st.number}</p>}
            {st.qrDataUrl && (
              <div className="qr-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={st.qrDataUrl} alt="QR code de la réservation" />
              </div>
            )}
            <p className="muted small">
              Présentez ce QR code au comptoir BRICOLOC
              {st.fulfilment?.mode === 'DELIVERY' ? ' ou au livreur' : ''}.
            </p>
            {st.fulfilment?.pickupPoint && (
              <p className="small">
                Enlèvement : <strong>{st.fulfilment.pickupPoint.name}</strong> —{' '}
                {st.fulfilment.pickupPoint.line1}, {st.fulfilment.pickupPoint.postalCode}{' '}
                {st.fulfilment.pickupPoint.city}
                {st.fulfilment.pickupPoint.transferHours > 0 && (
                  <> · prêt sous {st.fulfilment.pickupPoint.transferHours} h</>
                )}
              </p>
            )}
            {st.invoiceNumber && <p className="small">Facture : {st.invoiceNumber}</p>}
            <Link href="/compte" className="btn btn-primary">Voir mes réservations</Link>
          </>
        )}
      </div>
    </div>
  );
}
