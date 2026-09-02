'use client';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatDateTimeBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { ScanField } from '@/components/admin/ScanField';
import { StatusBadge } from '@/components/StatusBadge';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKETS: { key: string; label: string; tone: string }[] = [
  { key: 'toPrepare', label: 'À préparer', tone: 'warn' },
  { key: 'ready', label: 'Prêtes', tone: 'ok' },
  { key: 'out', label: 'Retours du jour', tone: 'navy' },
  { key: 'overdue', label: 'En retard', tone: 'err' },
  { key: 'pendingSupplier', label: 'Attente fournisseur', tone: 'navy' },
];

export default function TerminalPage() {
  const [board, setBoard] = useState<Record<string, any[]>>({});
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [scannedUnits, setScannedUnits] = useState<string[]>([]);

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

  async function openReservation(id: string) {
    setErr('');
    setMsg('');
    setScannedUnits([]);
    try {
      const r = await staffApi<{ reservation: any }>(`/api/admin/reservations/${id}`);
      setRes({ type: 'reservation', ...r.reservation });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Introuvable');
    }
  }

  async function scan(code: string) {
    setErr('');
    setMsg('');
    try {
      const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
      // Si on est sur une réservation et qu'on scanne un exemplaire → on l'ajoute.
      if (res?.type === 'reservation' && r.type === 'unit') {
        setScannedUnits((u) => (u.includes(r.id) ? u : [...u, r.id]));
        setMsg(`${r.assetTag} ajouté à ${res.number}`);
        return;
      }
      if (r.type === 'reservation') return openReservation(r.id);
      setRes(r);
      setScannedUnits([]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Code inconnu');
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await staffApi(`/api/ops/reservations/${id}/status`, { method: 'POST', body: { status } });
      setMsg(status === 'READY' ? 'Marquée prête — client notifié' : 'En préparation');
      await openReservation(id);
      await loadBoard();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action refusée');
    }
  }

  async function unitState(id: string, state: string) {
    try {
      await staffApi(`/api/admin/units/${id}`, { method: 'PATCH', body: { state } });
      setMsg(`Exemplaire → ${state}`);
      setRes({ ...res, state });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action refusée');
    }
  }

  function back() {
    setRes(null);
    setErr('');
    setMsg('');
    setScannedUnits([]);
    loadBoard();
  }

  return (
    <main className="term">
      <ScanField onScan={scan} placeholder="Scanner un code…" />

      {err && <div className="term-flash term-flash--err">{err}</div>}
      {msg && <div className="term-flash term-flash--ok">{msg}</div>}

      {/* ─── Accueil : le board ─── */}
      {!res && (
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
                        <button className="term-row" onClick={() => openReservation(r.id)}>
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

      {/* ─── Réservation ─── */}
      {res?.type === 'reservation' && (
        <div className="term-detail">
          <button className="term-back" onClick={back}>
            ← Retour
          </button>
          <div className="term-card">
            <span className="eyebrow">Réservation</span>
            <h2>
              {res.number} <StatusBadge status={res.status} />
            </h2>
            <p className="term-card__sub">
              {res.user ? `${res.user.firstName} ${res.user.lastName}` : 'Invité'}
              {res.user?.phone ? ` · ${res.user.phone}` : ''}
            </p>
            <p className="term-card__sub">
              {formatDateTimeBE(res.periodStart)} → {formatDateTimeBE(res.periodEnd)}
            </p>

            <ul className="term-items">
              {(res.items ?? []).map((i: any) => {
                const assigned = (i.units ?? []).map((u: any) => u.unit.assetTag);
                return (
                  <li key={i.id}>
                    <strong>
                      {i.quantity}× {i.nameSnapshot}
                    </strong>
                    {assigned.length > 0 && (
                      <span className="term-items__tags"> {assigned.join(' · ')}</span>
                    )}
                  </li>
                );
              })}
            </ul>

            {scannedUnits.length > 0 && (
              <p className="term-flash term-flash--ok">
                {scannedUnits.length} exemplaire(s) scanné(s) — utilisez « Ouvrir au comptoir » pour
                finaliser le retrait.
              </p>
            )}

            <div className="term-actions">
              {(res.status === 'CONFIRMED' || res.status === 'PREPARING') && (
                <button className="btn btn-outline btn-lg" onClick={() => setStatus(res.id, 'PREPARING')}>
                  En préparation
                </button>
              )}
              {res.status === 'PREPARING' && (
                <button className="btn btn-primary btn-lg" onClick={() => setStatus(res.id, 'READY')}>
                  Marquer prête
                </button>
              )}
              <Link href={`/admin/comptoir?res=${res.number}`} className="btn btn-primary btn-lg">
                Ouvrir au comptoir
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─── Exemplaire ─── */}
      {res?.type === 'unit' && (
        <div className="term-detail">
          <button className="term-back" onClick={back}>
            ← Retour
          </button>
          <div className="term-card">
            <span className="eyebrow">Exemplaire</span>
            <h2>{res.assetTag}</h2>
            <p className="term-card__sub">{res.product?.name}</p>
            <p className="term-card__sub">
              État : <StatusBadge status={res.state} />
            </p>
            {res.activeReservation && (
              <p className="term-card__sub">
                Location en cours :{' '}
                <button className="term-link" onClick={() => openReservation(res.activeReservation.id)}>
                  {res.activeReservation.number}
                </button>
              </p>
            )}
            <div className="term-actions">
              <button className="btn btn-outline btn-lg" onClick={() => unitState(res.id, 'AVAILABLE')}>
                Disponible
              </button>
              <button className="btn btn-outline btn-lg" onClick={() => unitState(res.id, 'MAINTENANCE')}>
                Maintenance
              </button>
              <button className="btn btn-outline btn-lg" onClick={() => unitState(res.id, 'DAMAGED')}>
                Endommagé
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Produit ─── */}
      {res?.type === 'product' && (
        <div className="term-detail">
          <button className="term-back" onClick={back}>
            ← Retour
          </button>
          <div className="term-card">
            <span className="eyebrow">Produit</span>
            <h2>{res.name}</h2>
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
