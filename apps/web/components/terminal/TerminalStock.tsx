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
  image: string | null;
  category: string | null;
  total: number;
  availableNow: number;
  rented: number;
  maintenance: number;
  damaged: number;
  retired: number;
}
interface ConsumableRow {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  stockQty: number | null;
  partSupplier: string | null;
}
interface Unit {
  id: string;
  assetTag: string;
  state: string;
  product: { id: string; name: string; images?: string[] | null };
}

const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#eeeef7"/></svg>');
function Thumb({ src, alt = '' }: { src?: string | null; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="term-thumb" src={src || PH} alt={alt} loading="lazy" onError={(e) => ((e.currentTarget as HTMLImageElement).src = PH)} />;
}

const STATE_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  RENTED: 'En location',
  MAINTENANCE: 'En entretien',
  DAMAGED: 'Endommagé',
  RETIRED: 'Retiré',
};

export const TerminalStock = forwardRef<
  TerminalStockHandle,
  { setFlash: (s: string) => void; startInventory?: boolean }
>(function TerminalStock({ setFlash, startInventory = false }, ref) {
  const [tab, setTab] = useState<'machines' | 'consumables'>('machines');
  const [machines, setMachines] = useState<StockRow[]>([]);
  const [consumables, setConsumables] = useState<ConsumableRow[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState<StockRow | null>(null);
  const [unitView, setUnitView] = useState<Unit | null>(null);

  const [inv, setInv] = useState(startInventory);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [s, u] = await Promise.all([
      staffApi<{ machines: StockRow[]; consumables: ConsumableRow[] }>('/api/admin/stock'),
      staffApi<{ units: Unit[] }>('/api/admin/units'),
    ]);
    setMachines(s.machines);
    setConsumables(s.consumables);
    setUnits(u.units);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const handleUnit = useCallback(
    (u: Unit) => {
      if (inv) {
        setSeen((p) => new Set(p).add(u.id));
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
      const u = units.find((x) => x.assetTag.toUpperCase() === up);
      if (u) return handleUnit(u);
      try {
        const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
        if (r.type === 'unit') {
          const uu = units.find((x) => x.id === r.id);
          if (uu) return handleUnit(uu);
          await load();
          setFlash('Rechargé — rescannez');
          return;
        }
        if (r.type === 'product') {
          const m = machines.find((x) => x.id === r.id);
          if (m) {
            setFocus(m);
            setUnitView(null);
          }
        }
      } catch {
        setFlash(`Code inconnu : ${code}`);
      }
    },
  }));

  async function setState(u: Unit, state: string) {
    await staffApi(`/api/admin/units/${u.id}`, { method: 'PATCH', body: { state } });
    setFlash(`${u.assetTag} → ${STATE_LABEL[state]}`);
    await load();
    setUnitView({ ...u, state });
  }

  // ─── Inventaire ───
  if (inv) {
    const expected = units.filter((u) => u.state === 'AVAILABLE');
    const missing = expected.filter((u) => !seen.has(u.id));
    const byProd = new Map<string, { name: string; image: string | null; seen: number; expected: number }>();
    for (const u of expected) {
      const e =
        byProd.get(u.product.id) ??
        { name: u.product.name, image: u.product.images?.[0] ?? null, seen: 0, expected: 0 };
      e.expected++;
      if (seen.has(u.id)) e.seen++;
      byProd.set(u.product.id, e);
    }
    return (
      <div className="term-page">
        <div className="term-page__head">
          <h2>Inventaire</h2>
          <strong>
            {seen.size}/{expected.length}
          </strong>
        </div>
        <p className="term-note">Scannez les exemplaires « disponibles » un par un.</p>
        <ul className="term-list">
          {[...byProd.values()]
            .sort((a, b) => a.seen / a.expected - b.seen / b.expected)
            .map((p) => (
              <li key={p.name} className="term-list__row term-list__row--img">
                <Thumb src={p.image} alt={p.name} />
                <span className="term-list__name">{p.name}</span>
                <strong className={p.seen === p.expected ? 'term-ok' : 'term-warn'}>
                  {p.seen}/{p.expected}
                </strong>
              </li>
            ))}
        </ul>
        {missing.length > 0 && (
          <div className="term-flash term-flash--err">
            {missing.length} non retrouvé(s) : {missing.slice(0, 12).map((u) => u.assetTag).join(', ')}
            {missing.length > 12 ? '…' : ''}
          </div>
        )}
        <button
          className="btn btn-outline btn-lg term-wide"
          onClick={() => {
            setInv(false);
            setSeen(new Set());
          }}
        >
          Terminer l’inventaire
        </button>
      </div>
    );
  }

  // ─── Exemplaire ───
  if (unitView) {
    return (
      <div className="term-page">
        <button className="term-back" onClick={() => setUnitView(null)}>
          ← Retour
        </button>
        <div className="term-detailhead">
          <Thumb src={unitView.product.images?.[0]} alt={unitView.product.name} />
          <div>
            <h2>{unitView.assetTag}</h2>
            <p className="term-note">
              {unitView.product.name} —{' '}
              <strong>{STATE_LABEL[unitView.state] ?? unitView.state}</strong>
            </p>
          </div>
        </div>
        <div className="term-btns">
          {Object.entries(STATE_LABEL).map(([s, label]) => (
            <button
              key={s}
              className={`btn btn-lg ${s === unitView.state ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setState(unitView, s)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Machine ───
  if (focus) {
    const mine = units.filter((u) => u.product.id === focus.id);
    return (
      <div className="term-page">
        <button className="term-back" onClick={() => setFocus(null)}>
          ← Retour
        </button>
        <div className="term-detailhead">
          <Thumb src={focus.image} alt={focus.name} />
          <div>
            <h2>{focus.name}</h2>
            <p className="term-note">
              <span className="term-ok">{focus.availableNow} dispo</span> · {focus.rented} en location ·{' '}
              {focus.maintenance} entretien · {focus.damaged + focus.retired} HS —{' '}
              <strong>{focus.total} exemplaires</strong>
            </p>
          </div>
        </div>
        <ul className="term-list">
          {mine.map((u) => (
            <li key={u.id} className="term-list__row term-list__row--tap" onClick={() => setUnitView(u)}>
              <span>{u.assetTag}</span>
              <span className="term-tag">{STATE_LABEL[u.state] ?? u.state}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ─── Liste ───
  const shownM = machines.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()));
  const shownC = consumables.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="term-page">
      <div className="term-page__head">
        <h2>Stock</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setInv(true)}>
          Inventaire
        </button>
      </div>
      <div className="term-tabs">
        <button className={tab === 'machines' ? 'is-on' : ''} onClick={() => setTab('machines')}>
          Machines
        </button>
        <button className={tab === 'consumables' ? 'is-on' : ''} onClick={() => setTab('consumables')}>
          Consommables
        </button>
      </div>
      <input
        className="term-input"
        placeholder="Filtrer…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {tab === 'machines' && (
        <ul className="term-list">
          {shownM.slice(0, 80).map((m) => (
            <li
              key={m.id}
              className="term-list__row term-list__row--tap term-list__row--img"
              onClick={() => setFocus(m)}
            >
              <Thumb src={m.image} alt={m.name} />
              <span className="term-list__name">{m.name}</span>
              <strong className={m.availableNow > 0 ? 'term-ok' : 'term-warn'}>
                {m.availableNow}/{m.total}
              </strong>
            </li>
          ))}
        </ul>
      )}

      {tab === 'consumables' && (
        <ul className="term-list">
          {shownC.slice(0, 120).map((c) => (
            <li key={c.id} className="term-list__row term-list__row--img">
              <Thumb src={c.image} alt={c.name} />
              <span className="term-list__name">{c.name}</span>
              <strong className={(c.stockQty ?? 0) > 0 ? 'term-ok' : 'term-warn'}>
                {c.stockQty ?? '—'}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
