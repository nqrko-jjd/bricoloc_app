'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { staffApi, useStaff } from '@/lib/staff';
import { ScanField } from '@/components/admin/ScanField';
import { StatusBadge } from '@/components/StatusBadge';
import { CounterFlow, type CounterFlowHandle } from '@/components/counter/CounterFlow';
import { TerminalStock, type TerminalStockHandle } from '@/components/terminal/TerminalStock';
import { TerminalRepairs, type TerminalRepairsHandle } from '@/components/terminal/TerminalRepairs';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKETS: { key: string; label: string; tone: string }[] = [
  { key: 'toPrepare', label: 'À préparer', tone: 'warn' },
  { key: 'ready', label: 'Prêtes', tone: 'ok' },
  { key: 'out', label: 'Retours du jour', tone: 'navy' },
  { key: 'overdue', label: 'En retard', tone: 'err' },
  { key: 'pendingSupplier', label: 'Attente fournisseur', tone: 'navy' },
];

const FLOW_STATUSES = ['CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURN_PENDING'];
type View = 'home' | 'counter' | 'stock' | 'inventory' | 'repairs';

export default function TerminalPage() {
  const { staff } = useStaff();
  const [view, setView] = useState<View>('home');
  const [board, setBoard] = useState<Record<string, any[]>>({});
  const [counts, setCounts] = useState({ counter: 0, repairs: 0 });
  const [scan, setScan] = useState<any>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const flowRef = useRef<CounterFlowHandle>(null);
  const stockRef = useRef<TerminalStockHandle>(null);
  const repairsRef = useRef<TerminalRepairsHandle>(null);

  const loadBoard = useCallback(async () => {
    try {
      const b: Record<string, any[]> = await staffApi('/api/ops/board');
      setBoard(b);
      setCounts((c) => ({
        ...c,
        counter: (b.toPrepare?.length ?? 0) + (b.ready?.length ?? 0) + (b.out?.length ?? 0) + (b.overdue?.length ?? 0),
      }));
    } catch {
      /* ignore */
    }
  }, []);
  const loadRepairCount = useCallback(async () => {
    try {
      const s = await staffApi<{ machines: any[] }>('/api/admin/stock');
      const n = s.machines.reduce((a, m) => a + (m.damaged ?? 0) + (m.maintenance ?? 0), 0);
      setCounts((c) => ({ ...c, repairs: n }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadBoard();
    loadRepairCount();
    const iv = setInterval(loadBoard, 20_000);
    return () => clearInterval(iv);
  }, [loadBoard, loadRepairCount]);

  const inFlow = scan?.reservation && FLOW_STATUSES.includes(scan.reservation.status);

  const openReservation = useCallback(async (numberOrId: string) => {
    setErr('');
    setMsg('');
    try {
      const r = await staffApi<any>(`/api/ops/scan/${encodeURIComponent(numberOrId)}`);
      setScan({ ...r, type: 'reservation' });
      setView('counter');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Introuvable');
    }
  }, []);

  async function handleScan(code: string) {
    setErr('');
    setMsg('');
    if (view === 'stock' || view === 'inventory') return stockRef.current?.feedScan(code);
    if (view === 'repairs') return repairsRef.current?.feedScan(code);
    if (view === 'counter' && inFlow) {
      try {
        const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
        if (r.type === 'unit') return flowRef.current?.feedScan(r.assetTag ?? code);
        if (r.type === 'reservation') return openReservation(r.number);
      } catch {
        flowRef.current?.feedScan(code);
      }
      return;
    }
    // home ou board : on résout
    try {
      const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
      if (r.type === 'reservation') return openReservation(r.number);
      if (r.type === 'unit') {
        setScan(r);
        setView('stock');
        setTimeout(() => stockRef.current?.feedScan(r.assetTag ?? code), 50);
        return;
      }
      if (r.type === 'product') {
        setView('stock');
        setTimeout(() => stockRef.current?.feedScan(code), 50);
        return;
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Code inconnu');
    }
  }

  function home() {
    setScan(null);
    setErr('');
    setMsg('');
    setView('home');
    loadBoard();
    loadRepairCount();
  }

  const TILES: { key: View; label: string; icon: string; badge?: number; tone: string }[] = [
    { key: 'counter', label: 'Comptoir\nretrait / retour', icon: '🛒', badge: counts.counter, tone: 'navy' },
    { key: 'stock', label: 'Stock\nmachines & consommables', icon: '📦', tone: 'plain' },
    { key: 'repairs', label: 'Réparations\n& maintenance', icon: '🔧', badge: counts.repairs, tone: 'warn' },
    { key: 'inventory', label: 'Inventaire', icon: '📋', tone: 'plain' },
  ];

  return (
    <main className="term">
      {view !== 'home' && (
        <button className="term-home-btn" onClick={home}>
          ← Accueil
        </button>
      )}

      <ScanField onScan={handleScan} placeholder="Scanner un QR / code-barres…" />

      {err && <div className="term-flash term-flash--err">{err}</div>}
      {msg && <div className="term-flash term-flash--ok">{msg}</div>}

      {/* ─────────── ACCUEIL : grosses touches ─────────── */}
      {view === 'home' && (
        <>
          <p className="term-hello">Bonjour {staff?.name?.split(' ')[0] ?? ''} — que faites-vous ?</p>
          <div className="term-tiles">
            {TILES.map((t) => (
              <button
                key={t.key}
                className={`term-tile term-tile--${t.tone}`}
                onClick={() => {
                  setScan(null);
                  setView(t.key);
                }}
              >
                <span className="term-tile__icon">{t.icon}</span>
                <span className="term-tile__label">{t.label}</span>
                {t.badge ? <span className="term-tile__badge">{t.badge}</span> : null}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ─────────── COMPTOIR ─────────── */}
      {view === 'counter' && !inFlow && (
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

      {view === 'counter' && inFlow && (
        <CounterFlow
          ref={flowRef}
          scan={scan}
          onReload={() => openReservation(scan.reservation.number)}
          onDone={() => {
            setScan(null);
            setView('counter');
            loadBoard();
          }}
          onExit={() => {
            setScan(null);
            setView('counter');
            loadBoard();
          }}
        />
      )}

      {view === 'counter' && scan?.reservation && !inFlow && (
        <div className="term-detail">
          <div className="term-card">
            <span className="eyebrow">Réservation</span>
            <h2>
              {scan.reservation.number} <StatusBadge status={scan.reservation.status} />
            </h2>
            <p className="term-card__sub">
              {scan.reservation.status === 'CLOSED'
                ? 'Location clôturée.'
                : scan.reservation.status === 'CANCELLED'
                  ? 'Réservation annulée.'
                  : 'Pas encore confirmée (paiement en attente).'}
            </p>
            <div className="term-actions">
              <Link href={`/admin/reservations/${scan.reservation.id}`} className="btn btn-outline btn-lg">
                Voir la fiche complète
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── STOCK / INVENTAIRE ─────────── */}
      {(view === 'stock' || view === 'inventory') && (
        <TerminalStock ref={stockRef} setFlash={setMsg} startInventory={view === 'inventory'} />
      )}

      {/* ─────────── RÉPARATIONS ─────────── */}
      {view === 'repairs' && (
        <TerminalRepairs
          ref={repairsRef}
          setFlash={setMsg}
          onChange={() => {
            loadRepairCount();
          }}
        />
      )}
    </main>
  );
}
