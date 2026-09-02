'use client';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Rental {
  number: string;
  status: string;
  qty: number;
  start: string;
  end: string;
  mode: string;
  customer: string;
}
interface Maint {
  label: string;
  description: string;
  start: string;
  end: string;
}
interface Row {
  id: string;
  name: string;
  category: string;
  capacity: number;
  rentals: Rental[];
  maintenance: Maint[];
}

const DAY = 86_400_000;
const COLW = 34;

const STATUS_COLOR: Record<string, string> = {
  PENDING_SUPPLIER: '#7a5cff',
  CONFIRMED: '#2b7cd3',
  PREPARING: '#d9a400',
  READY: '#1b7a4b',
  OUT: '#08065d',
  RETURN_PENDING: '#c0392b',
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function PlanningPage() {
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [data, setData] = useState<{ rows: Row[] } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');

  const from = anchor;
  const to = useMemo(() => new Date(from.getTime() + 34 * DAY), [from]);

  useEffect(() => {
    const f = from.toISOString().slice(0, 10);
    const t = to.toISOString().slice(0, 10);
    staffApi<{ rows: Row[] }>(`/api/admin/planning?from=${f}&to=${t}`).then(setData);
  }, [from, to]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 35; i++) arr.push(new Date(from.getTime() + i * DAY));
    return arr;
  }, [from]);

  const todayX = (startOfDay(new Date()).getTime() - from.getTime()) / DAY;

  const rows = (data?.rows ?? []).filter(
    (r) => !q || r.name.toLowerCase().includes(q.toLowerCase()),
  );
  const byCat = new Map<string, Row[]>();
  for (const r of rows) byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);

  function barGeom(s: string, e: string) {
    const S = Math.max(0, (new Date(s).getTime() - from.getTime()) / DAY);
    const E = Math.min(35, (new Date(e).getTime() - from.getTime()) / DAY);
    return { left: S * COLW, width: Math.max(COLW * 0.5, (E - S) * COLW) };
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>Planning</h1>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setAnchor(startOfDay(new Date()))}>
            Aujourd’hui
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setAnchor((a) => new Date(a.getTime() - 21 * DAY))}
          >
            ◂
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setAnchor((a) => new Date(a.getTime() + 21 * DAY))}
          >
            ▸
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Filtrer une machine…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <span className="small muted">
          {from.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })} –{' '}
          {to.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <div className="gantt-legend small">
          {Object.entries(STATUS_COLOR).map(([k, c]) => (
            <span key={k}>
              <i style={{ background: c }} />
              {k}
            </span>
          ))}
          <span>
            <i className="is-maint" />
            entretien
          </span>
        </div>
      </div>

      <div className="gantt card card-body">
        <div className="gantt-scroll">
          <div className="gantt-inner" style={{ width: 220 + 35 * COLW }}>
            {/* En-tête jours */}
            <div className="gantt-head">
              <div className="gantt-name">Machine</div>
              <div className="gantt-days" style={{ width: 35 * COLW }}>
                {days.map((d, i) => {
                  const we = d.getDay() === 0 || d.getDay() === 6;
                  const first = d.getDate() === 1 || i === 0;
                  return (
                    <div key={i} className={`gantt-day${we ? ' is-we' : ''}`} style={{ width: COLW }}>
                      {first && (
                        <span className="gantt-month">
                          {d.toLocaleDateString('fr-BE', { month: 'short' })}
                        </span>
                      )}
                      {d.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Corps */}
            <div className="gantt-body" style={{ position: 'relative' }}>
              {todayX >= 0 && todayX <= 35 && (
                <div className="gantt-today" style={{ left: 220 + todayX * COLW }} />
              )}
              {[...byCat.entries()].map(([cat, crows]) => (
                <div key={cat}>
                  <button
                    className="gantt-cat"
                    onClick={() => setCollapsed((s) => ({ ...s, [cat]: !s[cat] }))}
                  >
                    {collapsed[cat] ? '▸' : '▾'} {cat}{' '}
                    <span className="small muted">({crows.length})</span>
                  </button>
                  {!collapsed[cat] &&
                    crows.map((r) => {
                      const over = r.rentals.some((rl) => {
                        // chevauchements simultanés > capacité
                        const conc = r.rentals.filter(
                          (o) =>
                            new Date(o.start) < new Date(rl.end) &&
                            new Date(o.end) > new Date(rl.start),
                        );
                        return conc.reduce((a, o) => a + o.qty, 0) > r.capacity;
                      });
                      return (
                        <div key={r.id} className="gantt-row">
                          <div className={`gantt-name${over ? ' is-over' : ''}`} title={r.name}>
                            {r.name}
                            <span className="small muted"> ·{r.capacity}</span>
                          </div>
                          <div className="gantt-track" style={{ width: 35 * COLW }}>
                            {days.map((d, i) => (
                              <div
                                key={i}
                                className={`gantt-cell${d.getDay() === 0 || d.getDay() === 6 ? ' is-we' : ''}`}
                                style={{ width: COLW }}
                              />
                            ))}
                            {r.maintenance.map((m, j) => {
                              const g = barGeom(m.start, m.end);
                              return (
                                <div
                                  key={`m${j}`}
                                  className="gantt-bar is-maint"
                                  style={{ left: g.left, width: g.width }}
                                  title={`${m.label} — ${m.description}`}
                                />
                              );
                            })}
                            {r.rentals.map((rl, j) => {
                              const g = barGeom(rl.start, rl.end);
                              return (
                                <Link
                                  key={`r${j}`}
                                  href={`/admin/reservations`}
                                  className="gantt-bar"
                                  style={{
                                    left: g.left,
                                    width: g.width,
                                    background: STATUS_COLOR[rl.status] ?? '#666',
                                  }}
                                  title={`${rl.number} · ${rl.customer} · ${rl.status}\n${new Date(
                                    rl.start,
                                  ).toLocaleDateString('fr-BE')} → ${new Date(rl.end).toLocaleDateString('fr-BE')}`}
                                >
                                  <span>{rl.customer}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
              {rows.length === 0 && <p className="muted" style={{ padding: 16 }}>Aucune machine.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
