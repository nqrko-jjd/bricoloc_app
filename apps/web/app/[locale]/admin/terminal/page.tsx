'use client';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatEUR } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { ScanField } from '@/components/admin/ScanField';
import { StatusBadge } from '@/components/StatusBadge';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Mode Terminal : plein écran, scan-first, pour l'inventaire et le in/out rapide
 * (Zebra TC51 / douchette / caméra). Un scan résout n'importe quel code
 * (réservation, exemplaire, produit) et propose les actions adaptées.
 */
export default function TerminalPage() {
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function scan(code: string) {
    setErr('');
    setMsg('');
    setRes(null);
    try {
      setRes(await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Code inconnu');
    }
  }

  async function unitState(id: string, state: string) {
    await staffApi(`/api/admin/units/${id}`, { method: 'PATCH', body: { state } });
    setMsg(`Exemplaire → ${state}`);
    setRes({ ...res, state });
  }

  return (
    <div className="terminal">
      <div className="spread">
        <h1>Terminal</h1>
        <Link href="/admin" className="btn btn-ghost btn-sm">
          ← Back-office
        </Link>
      </div>

      <ScanField onScan={scan} placeholder="Scanner un QR / code-barres / n°…" />

      {err && <div className="alert alert-err" style={{ fontSize: '1.1rem' }}>{err}</div>}
      {msg && <div className="alert alert-ok" style={{ fontSize: '1.1rem' }}>{msg}</div>}

      {res?.type === 'reservation' && (
        <div className="card card-pad terminal-card">
          <span className="eyebrow">Réservation</span>
          <h2>{res.number}</h2>
          <Link href={`/admin/reservations/${res.id}`} className="btn btn-primary btn-lg">
            Ouvrir au comptoir
          </Link>
        </div>
      )}

      {res?.type === 'unit' && (
        <div className="card card-pad terminal-card">
          <span className="eyebrow">Exemplaire</span>
          <h2>
            {res.assetTag} — {res.product?.name}
          </h2>
          <p>
            État : <StatusBadge status={res.state} />
          </p>
          {res.activeReservation && (
            <p>
              Location en cours :{' '}
              <Link href={`/admin/reservations/${res.activeReservation.id}`}>
                {res.activeReservation.number}
              </Link>{' '}
              <StatusBadge status={res.activeReservation.status} />
            </p>
          )}
          <div className="row">
            <button className="btn btn-outline btn-lg" onClick={() => unitState(res.id, 'AVAILABLE')}>
              Disponible
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => unitState(res.id, 'MAINTENANCE')}>
              En maintenance
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => unitState(res.id, 'DAMAGED')}>
              Endommagé
            </button>
          </div>
        </div>
      )}

      {res?.type === 'product' && (
        <div className="card card-pad terminal-card">
          <span className="eyebrow">Produit</span>
          <h2>{res.name}</h2>
          <Link href={`/admin/produits`} className="btn btn-primary btn-lg">
            Voir la fiche
          </Link>
          <Link href={`/admin/etiquettes`} className="btn btn-ghost btn-lg">
            Imprimer des étiquettes
          </Link>
        </div>
      )}
    </div>
  );
}
