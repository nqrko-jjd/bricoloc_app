'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { staffApi } from '@/lib/staff';
import { ScanField } from '@/components/admin/ScanField';
import { CounterFlow, type CounterFlowHandle } from '@/components/counter/CounterFlow';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKETS: { key: string; label: string; urgent?: boolean }[] = [
  { key: 'toPrepare', label: 'À préparer' },
  { key: 'ready', label: 'Prêtes' },
  { key: 'out', label: 'Retour aujourd’hui' },
  { key: 'overdue', label: '⚠ En retard', urgent: true },
  { key: 'pendingSupplier', label: 'Demandes Loiselet' },
];

const FLOW_STATUSES = ['CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURN_PENDING'];

export default function ComptoirPage() {
  const [board, setBoard] = useState<Record<string, any[]>>({});
  const [scan, setScan] = useState<any>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const flowRef = useRef<CounterFlowHandle>(null);
  const searchParams = useSearchParams();
  const autoOpened = useRef(false);

  const loadBoard = useCallback(async () => {
    setBoard((await staffApi<Record<string, any[]>>('/api/ops/board').catch(() => ({})))!);
  }, []);
  useEffect(() => {
    loadBoard();
    const iv = setInterval(loadBoard, 20_000);
    return () => clearInterval(iv);
  }, [loadBoard]);

  const inFlow = scan?.reservation && FLOW_STATUSES.includes(scan.reservation.status);

  const openReservation = useCallback(async (numberOrId: string) => {
    setErr('');
    setMsg('');
    try {
      const r = await staffApi<any>(`/api/ops/scan/${encodeURIComponent(numberOrId)}`);
      setScan({ ...r, type: 'reservation' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Réservation introuvable');
    }
  }, []);

  // Arrivée depuis le terminal Zebra : /admin/comptoir?res=BRL-…
  useEffect(() => {
    const res = searchParams.get('res');
    if (res && !autoOpened.current) {
      autoOpened.current = true;
      openReservation(res);
    }
  }, [searchParams, openReservation]);

  async function handleScan(code: string) {
    setErr('');
    setMsg('');
    if (inFlow) {
      try {
        const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
        if (r.type === 'unit') return flowRef.current?.feedScan(r.assetTag ?? code);
        if (r.type === 'reservation') return openReservation(r.number);
      } catch {
        flowRef.current?.feedScan(code);
      }
      return;
    }
    try {
      const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
      if (r.type === 'reservation') return openReservation(r.number);
      if (r.type === 'unit' && r.activeReservation) return openReservation(r.activeReservation.number);
      setErr('Ce code ne correspond à aucune réservation en cours.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Code inconnu');
    }
  }

  function back() {
    setScan(null);
    setErr('');
    setMsg('');
    loadBoard();
  }

  return (
    <div className="stack">
      <h1>Comptoir — retrait &amp; retour</h1>
      <ScanField
        onScan={handleScan}
        placeholder="Scanner le QR du client, ou taper un n° de réservation"
      />

      {err && <div className="alert alert-err">{err}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      {!scan && (
        <div className="counter-board">
          {BUCKETS.map((b) => {
            const rows = board[b.key] ?? [];
            if (b.key === 'pendingSupplier' && rows.length === 0) return null;
            return (
              <div key={b.key} className={`counter-col${b.urgent ? ' counter-col--urgent' : ''}`}>
                <h3>
                  {b.label} <span className="badge">{rows.length}</span>
                </h3>
                {rows.length === 0 && <p className="small muted">—</p>}
                {rows.map((r: any) => (
                  <button
                    key={r.id}
                    type="button"
                    className="counter-card"
                    onClick={() => openReservation(r.number)}
                    style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }}
                  >
                    <strong>{r.number}</strong> · {r.customer}
                    <span className="badge" style={{ marginLeft: 6 }}>
                      {r.fulfilmentMode === 'DELIVERY' ? 'Livr.' : 'Retrait'}
                    </span>
                    {r.paymentStatus === 'ON_PICKUP' && (
                      <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                        💶 À encaisser
                      </span>
                    )}
                    <div className="small muted">{(r.items ?? []).slice(0, 2).join(' · ')}</div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {inFlow && (
        <CounterFlow
          ref={flowRef}
          scan={scan}
          onReload={() => openReservation(scan.reservation.number)}
          onDone={back}
          onExit={back}
        />
      )}

      {scan?.reservation && !inFlow && (
        <div className="card card-pad stack">
          <h2>{scan.reservation.number}</h2>
          <p className="muted">
            Statut <strong>{scan.reservation.status}</strong> — rien à faire au comptoir ici.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={back}>
            ← Retour au tableau
          </button>
        </div>
      )}
    </div>
  );
}
