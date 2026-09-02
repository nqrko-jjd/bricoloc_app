'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TerminalStockHandle {
  feedScan: (code: string) => void;
}

interface StockRow {
  id: string;
  name: string;
  category: string | null;
  total: number;
  availableNow: number;
  rented: number;
  maintenance: number;
  damaged: number;
  retired: number;
}
interface Unit {
  id: string;
  assetTag: string;
  state: string;
  product: { id: string; name: string };
}

const STATES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'DAMAGED', 'RETIRED'];

export const TerminalStock = forwardRef<TerminalStockHandle, { setFlash: (s: string) => void }>(
  function TerminalStock({ setFlash }, ref) {
    const [machines, setMachines] = useState<StockRow[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [q, setQ] = useState('');
    const [focus, setFocus] = useState<StockRow | null>(null);
    const [unitView, setUnitView] = useState<Unit | null>(null);

    // Mode inventaire
    const [inv, setInv] = useState(false);
    const [seen, setSeen] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
      const [s, u] = await Promise.all([
        staffApi<{ machines: StockRow[] }>('/api/admin/stock'),
        staffApi<{ units: Unit[] }>('/api/admin/units'),
      ]);
      setMachines(s.machines);
      setUnits(u.units);
    }, []);
    useEffect(() => {
      load();
    }, [load]);

    const handleUnit = useCallback(
      (u: Unit) => {
        if (inv) {
          setSeen((prev) => {
            const n = new Set(prev);
            n.add(u.id);
            return n;
          });
          setFlash(`${u.assetTag} pointé`);
          return;
        }
        setUnitView(u);
        setFocus(null);
      },
      [inv, setFlash],
    );

    useImperativeHandle(ref, () => ({
      feedScan: async (code: string) => {
        const up = code.trim().toUpperCase();
        const u = units.find(
          (x) => x.assetTag.toUpperCase() === up || (x as any).qrToken === code,
        );
        if (u) return handleUnit(u);
        try {
          const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
          if (r.type === 'unit') {
            const uu = units.find((x) => x.id === r.id);
            if (uu) return handleUnit(uu);
            await load();
            setFlash('Exemplaire chargé — rescannez');
            return;
          }
          if (r.type === 'product') {
            const m = machines.find((x) => x.id === r.id);
            if (m) {
              setFocus(m);
              setUnitView(null);
              return;
            }
          }
        } catch {
          setFlash(`Code inconnu : ${code}`);
        }
      },
    }));

    async function setState(u: Unit, state: string) {
      await staffApi(`/api/admin/units/${u.id}`, { method: 'PATCH', body: { state } });
      setFlash(`${u.assetTag} → ${state}`);
      await load();
      setUnitView({ ...u, state });
    }

    const shown = machines.filter(
      (m) => !q || m.name.toLowerCase().includes(q.toLowerCase()),
    );

    // ─── Inventaire : synthèse ───
    if (inv) {
      const expected = units.filter((u) => u.state === 'AVAILABLE');
      const missing = expected.filter((u) => !seen.has(u.id));
      const byProd = new Map<string, { name: string; seen: number; expected: number }>();
      for (const u of expected) {
        const e = byProd.get(u.product.id) ?? { name: u.product.name, seen: 0, expected: 0 };
        e.expected++;
        if (seen.has(u.id)) e.seen++;
        byProd.set(u.product.id, e);
      }
      return (
        <div className="term-detail">
          <div className="term-inv-head">
            <strong>Inventaire — {seen.size}/{expected.length} pointés</strong>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setInv(false);
                setSeen(new Set());
              }}
            >
              Terminer
            </button>
          </div>
          <p className="small muted">Scannez les exemplaires « disponibles » un par un.</p>
          <ul className="term-items">
            {[...byProd.values()]
              .sort((a, b) => a.seen / a.expected - b.seen / b.expected)
              .map((p) => (
                <li key={p.name}>
                  <strong>{p.name}</strong>{' '}
                  <span className={p.seen === p.expected ? 'term-ok' : 'term-warn'}>
                    {p.seen}/{p.expected}
                  </span>
                </li>
              ))}
          </ul>
          {missing.length > 0 && (
            <div className="term-flash term-flash--err">
              {missing.length} exemplaire(s) non retrouvé(s) :{' '}
              {missing.slice(0, 12).map((u) => u.assetTag).join(', ')}
              {missing.length > 12 ? '…' : ''}
            </div>
          )}
        </div>
      );
    }

    // ─── Vue exemplaire ───
    if (unitView) {
      return (
        <div className="term-detail">
          <button className="term-back" onClick={() => setUnitView(null)}>
            ← Retour
          </button>
          <div className="term-card">
            <span className="eyebrow">Exemplaire</span>
            <h2>{unitView.assetTag}</h2>
            <p className="term-card__sub">{unitView.product.name}</p>
            <p className="term-card__sub">État : {unitView.state}</p>
            <div className="term-actions">
              {STATES.map((s) => (
                <button
                  key={s}
                  className={`btn btn-lg ${s === unitView.state ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setState(unitView, s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ─── Vue machine ───
    if (focus) {
      const mine = units.filter((u) => u.product.id === focus.id);
      return (
        <div className="term-detail">
          <button className="term-back" onClick={() => setFocus(null)}>
            ← Retour
          </button>
          <div className="term-card">
            <h2>{focus.name}</h2>
            <p className="term-card__sub">
              {focus.availableNow} dispo · {focus.rented} loués · {focus.maintenance} entretien ·{' '}
              {focus.damaged + focus.retired} HS — total {focus.total}
            </p>
            <ul className="term-items">
              {mine.map((u) => (
                <li key={u.id}>
                  <button className="term-link" onClick={() => setUnitView(u)}>
                    {u.assetTag}
                  </button>{' '}
                  <span className="small muted">{u.state}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    // ─── Liste stock ───
    return (
      <div className="term-detail">
        <div className="term-inv-head">
          <strong>Stock</strong>
          <button className="btn btn-primary btn-sm" onClick={() => setInv(true)}>
            Démarrer un inventaire
          </button>
        </div>
        <input
          className="term-search"
          placeholder="Filtrer une machine…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="term-items">
          {shown.slice(0, 60).map((m) => (
            <li key={m.id}>
              <button className="term-link" onClick={() => setFocus(m)}>
                {m.name}
              </button>{' '}
              <span className={m.availableNow > 0 ? 'term-ok' : 'term-warn'}>
                {m.availableNow}/{m.total}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
