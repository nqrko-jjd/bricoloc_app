'use client';
import { useEffect, useMemo, useState } from 'react';
import { staffApi } from '@/lib/staff';
import { Barcode } from '@/components/admin/Barcode';

interface Label {
  unitId: string;
  assetTag: string;
  barcode: string;
  productName: string;
  storageLocation: string | null;
  qrDataUrl: string;
}
interface StockRow {
  id: string;
  name: string;
  category: string | null;
  total: number;
}

export default function AdminEtiquettes() {
  const [machines, setMachines] = useState<StockRow[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [labels, setLabels] = useState<Label[]>([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    staffApi<{ machines: StockRow[] }>('/api/admin/stock').then((r) =>
      setMachines(r.machines.filter((m) => m.total > 0)),
    );
  }, []);

  const shown = useMemo(
    () => machines.filter((m) => !filter || m.name.toLowerCase().includes(filter.toLowerCase())),
    [machines, filter],
  );
  const pickedIds = Object.keys(picked).filter((k) => picked[k]);
  const pickedCount = pickedIds.reduce(
    (a, id) => a + (machines.find((m) => m.id === id)?.total ?? 0),
    0,
  );

  async function generate(opts: { productIds?: string[]; all?: boolean }) {
    setBusy(true);
    try {
      const r = await staffApi<{ labels: Label[] }>('/api/admin/labels', {
        method: 'POST',
        body: opts,
      });
      setLabels(r.labels);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="no-print stack">
        <h1>Étiquettes QR &amp; code-barres</h1>
        <p className="muted small">
          Une étiquette par exemplaire : QR (scan smartphone / Zebra) + code-barres Code 128 +
          nom de la machine. Cochez les machines voulues, ou imprimez tout le parc.
        </p>

        <div className="card card-body stack">
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <input
              placeholder="Filtrer…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ maxWidth: 260 }}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setPicked(Object.fromEntries(shown.map((m) => [m.id, true])))
              }
            >
              Tout cocher (visible)
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPicked({})}>
              Décocher
            </button>
            <div style={{ flex: 1 }} />
            <button
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => generate({ all: true })}
            >
              Générer TOUT le parc
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || pickedIds.length === 0}
              onClick={() => generate({ productIds: pickedIds })}
            >
              Générer {pickedCount} étiquette(s) · {pickedIds.length} machine(s)
            </button>
          </div>

          <div className="etq-picker">
            {shown.map((m) => (
              <label key={m.id} className={`etq-chip${picked[m.id] ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!picked[m.id]}
                  onChange={(e) => setPicked((s) => ({ ...s, [m.id]: e.target.checked }))}
                />
                {m.name} <span className="small muted">×{m.total}</span>
              </label>
            ))}
          </div>
        </div>

        {labels.length > 0 && (
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <strong>{labels.length} étiquette(s) prêtes</strong>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
              🖨 Imprimer
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setLabels([])}>
              Effacer
            </button>
          </div>
        )}
      </div>

      <div className="label-sheet">
        {labels.map((l) => (
          <div key={l.unitId} className="label">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.qrDataUrl} alt="" className="label__qr" />
            <div className="label__body">
              <strong className="label__tag">
                {l.assetTag}
                {l.storageLocation ? <span className="label__loc"> · 📍 {l.storageLocation}</span> : null}
              </strong>
              <span className="label__name">{l.productName}</span>
              <Barcode value={l.barcode} height={30} unit={1.3} />
              <span className="label__brand">BRICOLOC</span>
            </div>
          </div>
        ))}
        {labels.length === 0 && (
          <p className="muted no-print">Cochez des machines puis « Générer ».</p>
        )}
      </div>
    </div>
  );
}
