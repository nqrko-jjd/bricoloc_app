'use client';
import { useEffect, useMemo, useState } from 'react';
import { staffApi } from '@/lib/staff';
import { Barcode } from '@/components/admin/Barcode';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';

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
  image: string | null;
  total: number;
}
interface ZoneLabel {
  code: string;
  qrDataUrl: string;
}

/** « R-01-A » → { head:"R-01-", tail:"A", pad:1 } ; « R-05 » → { head:"R-", tail:"05", pad:2 }. */
function splitTail(code: string): { head: string; tail: string; num: boolean } | null {
  const m = code.match(/^(.*?)([0-9]+|[A-Za-z])$/);
  if (!m) return null;
  return { head: m[1], tail: m[2], num: /[0-9]/.test(m[2]) };
}

function expandRange(from: string, to: string): string[] {
  const a = from.trim().toUpperCase();
  const b = to.trim().toUpperCase();
  if (!a) return [];
  if (!b || a === b) return [a];
  const sa = splitTail(a);
  const sb = splitTail(b);
  if (!sa || !sb || sa.head !== sb.head || sa.num !== sb.num) return [a, b];
  const out: string[] = [];
  if (sa.num) {
    const start = parseInt(sa.tail, 10);
    const end = parseInt(sb.tail, 10);
    const width = sa.tail.length;
    for (let i = Math.min(start, end); i <= Math.max(start, end) && out.length < 200; i++) {
      out.push(sa.head + String(i).padStart(width, '0'));
    }
  } else {
    const start = sa.tail.charCodeAt(0);
    const end = sb.tail.charCodeAt(0);
    for (let c = Math.min(start, end); c <= Math.max(start, end) && out.length < 200; c++) {
      out.push(sa.head + String.fromCharCode(c));
    }
  }
  return out;
}

export default function AdminEtiquettes() {
  const [tab, setTab] = useState<'machines' | 'zones'>('machines');

  return (
    <div className="stack">
      <div className="no-print stack">
        <h1>Étiquettes QR &amp; code-barres</h1>
        <div className="chips">
          <button
            className={`chip${tab === 'machines' ? ' active' : ''}`}
            onClick={() => setTab('machines')}
          >
            Machines
          </button>
          <button
            className={`chip${tab === 'zones' ? ' active' : ''}`}
            onClick={() => setTab('zones')}
          >
            Emplacements (racks)
          </button>
        </div>
      </div>
      {tab === 'machines' ? <MachineLabels /> : <ZoneLabels />}
    </div>
  );
}

function MachineLabels() {
  const [machines, setMachines] = useState<StockRow[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [labels, setLabels] = useState<Label[]>([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [dense, setDense] = useState(false);

  useEffect(() => {
    staffApi<{ machines: StockRow[] }>('/api/admin/stock').then((r) =>
      setMachines(r.machines.filter((m) => m.total > 0)),
    );
  }, []);

  const shown = useMemo(
    () => machines.filter((m) => !filter || m.name.toLowerCase().includes(filter.toLowerCase())),
    [machines, filter],
  );
  const byCat = useMemo(() => {
    const map = new Map<string, StockRow[]>();
    for (const m of shown) {
      const k = m.category ?? 'Sans catégorie';
      map.set(k, [...(map.get(k) ?? []), m]);
    }
    return map;
  }, [shown]);
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
    <>
      <p className="muted small no-print">
        Une étiquette par exemplaire : QR (scan smartphone / Zebra) + code-barres Code 128 + nom
        de la machine. Cliquez les vignettes voulues, ou imprimez tout le parc.
      </p>

      <div className="card card-body stack no-print">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            placeholder="Filtrer…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPicked(Object.fromEntries(shown.map((m) => [m.id, true])))}
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

        {[...byCat.entries()].map(([cat, rows]) => (
          <div key={cat} className="stack" style={{ gap: 8 }}>
            <strong className="small" style={{ color: 'var(--muted-fg)' }}>{cat}</strong>
            <div className="etq-grid">
              {rows.map((m) => (
                <label key={m.id} className={`etq-card${picked[m.id] ? ' is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!picked[m.id]}
                    onChange={(e) => setPicked((s) => ({ ...s, [m.id]: e.target.checked }))}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image || PLACEHOLDER_IMG} alt="" />
                  <span className="etq-card__name">{m.name}</span>
                  <span className="etq-card__qty">×{m.total}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {labels.length > 0 && (
        <div className="row no-print" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{labels.length} étiquette(s) prêtes</strong>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={dense} onChange={(e) => setDense(e.target.checked)} />
            <span className="small">Petit format (4 / rangée)</span>
          </label>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            🖨 Imprimer
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setLabels([])}>
            Effacer
          </button>
          <span className="small muted">
            À l&apos;impression : marges « par défaut », décocher en-têtes/pieds de page.
          </span>
        </div>
      )}

      <div className={`label-sheet${dense ? ' label-sheet--dense' : ''}`}>
        {labels.map((l) => (
          <div key={l.unitId} className="label">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.qrDataUrl} alt="" className="label__qr" />
            <div className="label__body">
              <strong className="label__tag">{l.assetTag}</strong>
              <span className="label__name">
                {l.productName}
                {l.storageLocation ? ` · 📍 ${l.storageLocation}` : ''}
              </span>
              <span className="label__code">
                <Barcode value={l.barcode} height={22} unit={0.9} showText={false} />
              </span>
              <span className="label__brand">BRICOLOC</span>
            </div>
          </div>
        ))}
        {labels.length === 0 && (
          <p className="muted no-print">Cochez des machines puis « Générer ».</p>
        )}
      </div>
    </>
  );
}

function ZoneLabels() {
  const [zones, setZones] = useState<string[]>([]);
  const [used, setUsed] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [one, setOne] = useState('');
  const [rFrom, setRFrom] = useState('');
  const [rTo, setRTo] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [labels, setLabels] = useState<ZoneLabel[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    staffApi<{ zones: string[]; declared: string[]; used: string[] }>('/api/admin/zones').then((r) => {
      const list = [...new Set([...(r.declared ?? []), ...(r.used ?? [])])].sort();
      setZones(list);
      setUsed(r.used ?? []);
      setPicked(Object.fromEntries(list.map((z) => [z, true])));
    });
  }, []);

  const undeclaredUsed = useMemo(() => used.filter((u) => !zones.includes(u)), [used, zones]);

  function addZones(next: string[]) {
    const clean = next.map((z) => z.trim().toUpperCase()).filter((z) => z && z.length <= 32);
    if (clean.length === 0) return;
    setZones((prev) => {
      const merged = [...new Set([...prev, ...clean])].sort();
      return merged;
    });
    setPicked((p) => ({ ...p, ...Object.fromEntries(clean.map((z) => [z, true])) }));
    setDirty(true);
  }

  function removeZone(z: string) {
    setZones((prev) => prev.filter((x) => x !== z));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const r = await staffApi<{ zones: string[] }>('/api/admin/zones', {
        method: 'POST',
        body: { zones },
      });
      setZones(r.zones);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    const sel = zones.filter((z) => picked[z]);
    if (sel.length === 0) return;
    setBusy(true);
    try {
      const r = await staffApi<{ labels: ZoneLabel[] }>('/api/admin/zone-labels', {
        method: 'POST',
        body: { zones: sel },
      });
      setLabels(r.labels);
    } finally {
      setBusy(false);
    }
  }

  const pickedCount = zones.filter((z) => picked[z]).length;

  return (
    <>
      <p className="muted small no-print">
        Les racks et étagères du dépôt (ex. <code>R-01-A</code>). On imprime une étiquette QR par
        emplacement : à l&apos;inventaire, le magasinier scanne l&apos;étiquette du rack puis chaque
        machine posée dessus — l&apos;emplacement est enregistré automatiquement.
      </p>

      <div className="card card-body stack no-print">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="stack" style={{ gap: 4 }}>
            <span className="small muted">Ajouter un emplacement</span>
            <input
              placeholder="R-03-B"
              value={one}
              onChange={(e) => setOne(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && one.trim()) {
                  addZones([one]);
                  setOne('');
                }
              }}
              style={{ maxWidth: 160 }}
            />
          </label>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (one.trim()) {
                addZones([one]);
                setOne('');
              }
            }}
          >
            Ajouter
          </button>

          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />

          <label className="stack" style={{ gap: 4 }}>
            <span className="small muted">Série : de</span>
            <input
              placeholder="R-01-A"
              value={rFrom}
              onChange={(e) => setRFrom(e.target.value)}
              style={{ maxWidth: 130 }}
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            <span className="small muted">à</span>
            <input
              placeholder="R-01-F"
              value={rTo}
              onChange={(e) => setRTo(e.target.value)}
              style={{ maxWidth: 130 }}
            />
          </label>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              addZones(expandRange(rFrom, rTo));
              setRFrom('');
              setRTo('');
            }}
          >
            Générer la série
          </button>
        </div>

        {undeclaredUsed.length > 0 && (
          <p className="small">
            Déjà utilisés sur des exemplaires :{' '}
            {undeclaredUsed.map((z) => (
              <button key={z} className="btn btn-ghost btn-sm" onClick={() => addZones([z])}>
                + {z}
              </button>
            ))}
          </p>
        )}

        <div className="etq-picker">
          {zones.length === 0 && <span className="muted small">Aucun emplacement pour l&apos;instant.</span>}
          {zones.map((z) => (
            <span key={z} className={`etq-chip${picked[z] ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={!!picked[z]}
                onChange={(e) => setPicked((p) => ({ ...p, [z]: e.target.checked }))}
              />
              <code>{z}</code>
              <button
                className="btn btn-ghost btn-sm"
                title="Retirer"
                onClick={() => removeZone(z)}
                style={{ padding: '0 6px', lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Enregistrement…' : dirty ? 'Enregistrer la liste' : 'Liste enregistrée'}
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-primary btn-sm"
            disabled={busy || pickedCount === 0}
            onClick={generate}
          >
            Générer {pickedCount} étiquette(s)
          </button>
        </div>
      </div>

      {labels.length > 0 && (
        <div className="row no-print" style={{ gap: 10, alignItems: 'center' }}>
          <strong>{labels.length} étiquette(s) prêtes</strong>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            🖨 Imprimer
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setLabels([])}>
            Effacer
          </button>
        </div>
      )}

      <div className="zlabel-sheet">
        {labels.map((l) => (
          <div key={l.code} className="zlabel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.qrDataUrl} alt="" />
            <span className="zlabel__code">{l.code}</span>
            <span className="zlabel__brand">BRICOLOC · EMPLACEMENT</span>
          </div>
        ))}
      </div>
    </>
  );
}
