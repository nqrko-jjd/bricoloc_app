'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { staffApi } from '@/lib/staff';
import { ScanField } from '@/components/admin/ScanField';
import { StatusBadge } from '@/components/StatusBadge';
import { CounterFlow, type CounterFlowHandle } from '@/components/counter/CounterFlow';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKETS: { key: string; label: string; tone: string }[] = [
  { key: 'toPrepare', label: 'À préparer', tone: 'warn' },
  { key: 'ready', label: 'Prêtes', tone: 'ok' },
  { key: 'out', label: 'Retours du jour', tone: 'navy' },
  { key: 'overdue', label: 'En retard', tone: 'err' },
  { key: 'pendingSupplier', label: 'Attente fournisseur', tone: 'navy' },
];

const FLOW_STATUSES = ['CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURN_PENDING'];

export default function TerminalPage() {
  const [board, setBoard] = useState<Record<string, any[]>>({});
  const [scan, setScan] = useState<any>(null); // { reservation, paid, depositHeld } ou { type:'unit'|'product', ... }
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const flowRef = useRef<CounterFlowHandle>(null);

  const loadBoard = useCallback(async () => {
    try {
      setBoard(await staffApi('/api/ops/board'));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadBoard();
    const iv = setInterval(loadBoard, 20_000);
    return () => clearInterval(iv);
  }, [loadBoard]);

  const inFlow = scan?.reservation && FLOW_STATUSES.includes(scan.reservation.status);

  async function openReservation(numberOrId: string) {
    setErr('');
    setMsg('');
    try {
      const r = await staffApi<any>(`/api/ops/scan/${encodeURIComponent(numberOrId)}`);
      setScan({ ...r, type: 'reservation' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Introuvable');
    }
  }

  async function handleScan(code: string) {
    setErr('');
    setMsg('');
    // Pendant un parcours, un scan d'exemplaire alimente l'affectation.
    if (inFlow) {
      try {
        const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
        if (r.type === 'unit') {
          flowRef.current?.feedScan(r.assetTag ?? code);
          return;
        }
        if (r.type === 'reservation') return openReservation(r.number);
      } catch {
        flowRef.current?.feedScan(code);
      }
      return;
    }
    try {
      const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
      if (r.type === 'reservation') return openReservation(r.number);
      setScan(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Code inconnu');
    }
  }

  async function unitState(id: string, state: string) {
    try {
      await staffApi(`/api/admin/units/${id}`, { method: 'PATCH', body: { state } });
      setMsg(`Exemplaire → ${state}`);
      setScan({ ...scan, state });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action refusée');
    }
  }

  function back() {
    setScan(null);
    setErr('');
    setMsg('');
    loadBoard();
  }

  return (
    <main className="term">
      <ScanField onScan={handleScan} placeholder="Scanner un QR / code-barres…" />

      {err && <div className="term-flash term-flash--err">{err}</div>}
      {msg && <div className="term-flash term-flash--ok">{msg}</div>}

      {/* ─── Accueil : le board ─── */}
      {!scan && (
        <div className="term-board">
          {BUCKETS.map((b) => {
            const rows = board[b.key] ?? [];
            return (
              <section key={b.key} className="term-bucket" data-tone={b.tone}>
                <h2>
                  {b.label} <span>{rows.length}</span>
                </h2>
                {rows.length === 0 ? (
                  <p className="term-empty">—</p>
                ) : (
                  <ul>
                    {rows.slice(0, 8).map((r) => (
                      <li key={r.id}>
                        <button className="term-row" onClick={() => openReservation(r.number)}>
                          <span className="term-row__num">{r.number}</span>
                          <span className="term-row__cust">{r.customer}</span>
                          <span className="term-row__meta">
                            {r.lines} art. · {r.fulfilmentMode === 'DELIVERY' ? 'Livr.' : 'Retrait'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ─── Parcours retrait / retour ─── */}
      {inFlow && (
        <CounterFlow
          ref={flowRef}
          scan={scan}
          onReload={() => openReservation(scan.reservation.number)}
          onDone={back}
          onExit={back}
        />
      )}

      {/* ─── Réservation hors parcours (brouillon, clôturée…) ─── */}
      {scan?.reservation && !inFlow && (
        <div className="term-detail">
          <button className="term-back" onClick={back}>
            ← Retour
          </button>
          <div className="term-card">
            <span className="eyebrow">Réservation</span>
            <h2>
              {scan.reservation.number} <StatusBadge status={scan.reservation.status} />
            </h2>
            <p className="term-card__sub">
              {scan.reservation.status === 'CLOSED'
                ? 'Cette location est clôturée.'
                : scan.reservation.status === 'CANCELLED'
                  ? 'Cette réservation est annulée.'
                  : 'Réservation pas encore confirmée (paiement en attente).'}
            </p>
            <div className="term-actions">
              <Link
                href={`/admin/reservations/${scan.reservation.id}`}
                className="btn btn-outline btn-lg"
              >
                Voir la fiche complète
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─── Exemplaire ─── */}
      {scan?.type === 'unit' && (
        <div className="term-detail">
          <button className="term-back" onClick={back}>
            ← Retour
          </button>
          <div className="term-card">
            <span className="eyebrow">Exemplaire</span>
            <h2>{scan.assetTag}</h2>
            <p className="term-card__sub">{scan.product?.name}</p>
            <p className="term-card__sub">
              État : <StatusBadge status={scan.state} />
            </p>
            {scan.activeReservation && (
              <p className="term-card__sub">
                Location en cours :{' '}
                <button
                  className="term-link"
                  onClick={() => openReservation(scan.activeReservation.number)}
                >
                  {scan.activeReservation.number}
                </button>
              </p>
            )}
            <div className="term-actions">
              <button className="btn btn-outline btn-lg" onClick={() => unitState(scan.id, 'AVAILABLE')}>
                Disponible
              </button>
              <button
                className="btn btn-outline btn-lg"
                onClick={() => unitState(scan.id, 'MAINTENANCE')}
              >
                Maintenance
              </button>
              <button className="btn btn-outline btn-lg" onClick={() => unitState(scan.id, 'DAMAGED')}>
                Endommagé
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Produit ─── */}
      {scan?.type === 'product' && (
        <div className="term-detail">
          <button className="term-back" onClick={back}>
            ← Retour
          </button>
          <div className="term-card">
            <span className="eyebrow">Produit</span>
            <h2>{scan.name}</h2>
            <div className="term-actions">
              <Link href="/admin/exemplaires" className="btn btn-primary btn-lg">
                Exemplaires & stock
              </Link>
              <Link href="/admin/etiquettes" className="btn btn-outline btn-lg">
                Imprimer des étiquettes
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
