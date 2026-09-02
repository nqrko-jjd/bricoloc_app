'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TerminalRepairsHandle {
  feedScan: (code: string) => void;
}

interface Unit {
  id: string;
  assetTag: string;
  state: string;
  notes: string | null;
  nextMaintenanceAt: string | null;
  immobilisedUntil: string | null;
  product: { id: string; name: string; images?: string[] | null };
}

const PH =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#eeeef7"/></svg>');

export const TerminalRepairs = forwardRef<
  TerminalRepairsHandle,
  { setFlash: (s: string) => void; onChange?: () => void }
>(function TerminalRepairs({ setFlash, onChange }, ref) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [sel, setSel] = useState<Unit | null>(null);

  const load = useCallback(async () => {
    const u = await staffApi<{ units: Unit[] }>('/api/admin/units');
    setUnits(u.units);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useImperativeHandle(ref, () => ({
    feedScan: async (code: string) => {
      const up = code.trim().toUpperCase();
      let u = units.find((x) => x.assetTag.toUpperCase() === up);
      if (!u) {
        try {
          const r: any = await staffApi(`/api/ops/resolve/${encodeURIComponent(code)}`);
          if (r.type === 'unit') {
            await load();
            u = (await staffApi<{ units: Unit[] }>('/api/admin/units')).units.find((x) => x.id === r.id);
          }
        } catch {
          /* ignore */
        }
      }
      if (u) setSel(u);
      else setFlash(`Exemplaire inconnu : ${code}`);
    },
  }));

  async function act(u: Unit, to: string, maintType?: string) {
    if (maintType) {
      await staffApi(`/api/admin/units/${u.id}/maintenance`, {
        method: 'POST',
        body: { type: maintType, description: maintType === 'REPARATION' ? 'Réparation' : 'Entretien', blocksAvailability: to !== 'AVAILABLE' },
      });
    }
    await staffApi(`/api/admin/units/${u.id}`, { method: 'PATCH', body: { state: to } });
    setFlash(`${u.assetTag} → ${to === 'AVAILABLE' ? 'remis en service' : to}`);
    await load();
    setSel(null);
    onChange?.();
  }

  const damaged = units.filter((u) => u.state === 'DAMAGED');
  const inRepair = units.filter((u) => u.state === 'MAINTENANCE');
  const dueSoon = units.filter(
    (u) =>
      u.state === 'AVAILABLE' &&
      u.nextMaintenanceAt &&
      new Date(u.nextMaintenanceAt).getTime() < Date.now() + 14 * 86_400_000,
  );

  if (sel) {
    return (
      <div className="term-page">
        <button className="term-back" onClick={() => setSel(null)}>
          ← Retour
        </button>
        <div className="term-detailhead">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="term-thumb"
            src={sel.product.images?.[0] || PH}
            alt=""
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = PH)}
          />
          <div>
            <h2>{sel.assetTag}</h2>
            <p className="term-note">
              {sel.product.name} — <strong>{sel.state}</strong>
              {sel.notes ? <> · {sel.notes}</> : null}
            </p>
          </div>
        </div>
        <div className="term-btns">
          <button className="btn btn-primary btn-lg" onClick={() => act(sel, 'AVAILABLE')}>
            Réparé — remettre en service
          </button>
          <button className="btn btn-outline btn-lg" onClick={() => act(sel, 'MAINTENANCE', 'REPARATION')}>
            Mettre en réparation (atelier)
          </button>
          <button className="btn btn-outline btn-lg" onClick={() => act(sel, 'MAINTENANCE', 'ENTRETIEN')}>
            Entretien / contrôle
          </button>
          <button className="btn btn-outline btn-lg" onClick={() => act(sel, 'DAMAGED')}>
            Signaler endommagé
          </button>
          <button className="btn btn-outline btn-lg" onClick={() => act(sel, 'RETIRED')}>
            Hors service définitif
          </button>
        </div>
      </div>
    );
  }

  const Group = ({ title, list, tone }: { title: string; list: Unit[]; tone: string }) => (
    <section className="term-bucket" data-tone={tone}>
      <h2>
        {title} <span>{list.length}</span>
      </h2>
      {list.length === 0 ? (
        <p className="term-empty">—</p>
      ) : (
        <ul>
          {list.map((u) => (
            <li key={u.id}>
              <button className="term-row term-row--img" onClick={() => setSel(u)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="term-thumb term-thumb--sm"
                  src={u.product.images?.[0] || PH}
                  alt=""
                  onError={(e) => ((e.currentTarget as HTMLImageElement).src = PH)}
                />
                <span className="term-row__num">{u.assetTag}</span>
                <span className="term-row__cust">{u.product.name}</span>
                {u.immobilisedUntil && (
                  <span className="term-row__meta">
                    jusqu’au {new Date(u.immobilisedUntil).toLocaleDateString('fr-BE')}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="term-page">
      <h2 style={{ marginBottom: 4 }}>Réparations &amp; maintenance</h2>
      <p className="term-note">Scannez une machine, ou touchez-la dans la liste.</p>
      <div className="term-board">
        <Group title="À réparer" list={damaged} tone="err" />
        <Group title="En réparation / entretien" list={inRepair} tone="warn" />
        <Group title="Entretien à prévoir (14 j)" list={dueSoon} tone="navy" />
      </div>
    </div>
  );
});
