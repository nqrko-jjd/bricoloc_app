'use client';
import { Fragment, useEffect, useState } from 'react';
import { formatDateBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { ScanField } from '@/components/admin/ScanField';

interface StockRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  category: string | null;
  published: boolean;
  total: number;
  availableNow: number;
  reserved: number;
  rented: number;
  maintenance: number;
  damaged: number;
  retired: number;
}
interface ConsumableRow {
  id: string;
  slug: string;
  name: string;
  stockQty: number | null;
  dailyPrice: number;
  partSupplier: string | null;
  published: boolean;
}

interface Unit {
  id: string;
  assetTag: string;
  serialNumber: string | null;
  barcode: string | null;
  qrToken: string;
  state: string;
  storageLocation: string | null;
  immobilisedUntil: string | null;
  nextMaintenanceAt: string | null;
  notes: string | null;
  product: { id: string; name: string; images?: string[] | null };
  reservationUnits: { assignedAt: string; returnedAt: string | null; reservationItem: { reservation: { number: string } } }[];
  damages: { description: string; feeHT: number; resolved: boolean }[];
  maintenances: { type: string; status?: string; description: string; performedAt: string; startAt?: string | null; endAt?: string | null }[];
}

const STATES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'DAMAGED', 'RETIRED'];

function MaintenanceForm({
  unitId,
  onDone,
  setMsg,
}: {
  unitId: string;
  onDone: () => void;
  setMsg: (s: string) => void;
}) {
  const [m, setM] = useState({
    type: 'ENTRETIEN',
    description: '',
    cost: '',
    startAt: '',
    endAt: '',
    blocksAvailability: true,
  });
  const [dmg, setDmg] = useState({ description: '', feeHT: '' });
  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 12 }}>
      <div className="card card-body">
        <strong className="small">Planifier un entretien / une réparation</strong>
        <div className="row" style={{ marginTop: 6 }}>
          <select value={m.type} onChange={(e) => setM({ ...m, type: e.target.value })}>
            <option value="ENTRETIEN">Entretien</option>
            <option value="REPARATION">Réparation</option>
            <option value="CONTROLE">Contrôle</option>
          </select>
          <input
            placeholder="Description"
            value={m.description}
            onChange={(e) => setM({ ...m, description: e.target.value })}
            style={{ flex: 1 }}
          />
          <input placeholder="Coût €" value={m.cost} onChange={(e) => setM({ ...m, cost: e.target.value })} style={{ width: 80 }} />
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <label className="small">
            Immobilisé du{' '}
            <input type="date" value={m.startAt} onChange={(e) => setM({ ...m, startAt: e.target.value })} />
          </label>
          <label className="small">
            au <input type="date" value={m.endAt} onChange={(e) => setM({ ...m, endAt: e.target.value })} />
          </label>
          <label className="small row" style={{ gap: 4 }}>
            <input
              type="checkbox"
              checked={m.blocksAvailability}
              onChange={(e) => setM({ ...m, blocksAvailability: e.target.checked })}
            />
            retire des disponibilités
          </label>
        </div>
        <button
          className="btn btn-outline btn-sm"
          style={{ marginTop: 8 }}
          onClick={async () => {
            if (!m.description) return;
            await staffApi(`/api/admin/units/${unitId}/maintenance`, {
              method: 'POST',
              body: {
                type: m.type,
                description: m.description,
                cost: Number(m.cost) || 0,
                startAt: m.startAt || undefined,
                endAt: m.endAt || undefined,
                blocksAvailability: m.blocksAvailability,
              },
            });
            setMsg('Maintenance enregistrée — l’exemplaire est retiré des disponibilités sur la période.');
            setM({ ...m, description: '', cost: '', startAt: '', endAt: '' });
            onDone();
          }}
        >
          Enregistrer
        </button>
      </div>

      <div className="card card-body">
        <strong className="small">Signaler un dommage</strong>
        <input
          placeholder="Description"
          value={dmg.description}
          onChange={(e) => setDmg({ ...dmg, description: e.target.value })}
          style={{ marginTop: 6, width: '100%' }}
        />
        <input
          placeholder="Frais € HT"
          value={dmg.feeHT}
          onChange={(e) => setDmg({ ...dmg, feeHT: e.target.value })}
          style={{ marginTop: 6, width: '100%' }}
        />
        <button
          className="btn btn-outline btn-sm"
          style={{ marginTop: 8 }}
          onClick={async () => {
            if (!dmg.description) return;
            await staffApi(`/api/admin/units/${unitId}/damage`, {
              method: 'POST',
              body: { description: dmg.description, feeHT: Number(dmg.feeHT) || 0 },
            });
            setMsg('Dommage enregistré.');
            setDmg({ description: '', feeHT: '' });
            onDone();
          }}
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function StockBar({ r }: { r: StockRow }) {
  const seg = (n: number, cls: string) =>
    n > 0 ? <span className={`stockbar__seg ${cls}`} style={{ flexGrow: n }} title={`${n}`} /> : null;
  return (
    <div className="stockbar">
      {seg(r.availableNow, 'is-avail')}
      {seg(r.reserved, 'is-reserved')}
      {seg(r.rented, 'is-rented')}
      {seg(r.maintenance, 'is-maint')}
      {seg(r.damaged + r.retired, 'is-hs')}
    </div>
  );
}

function MachineRow({
  r,
  units,
  onReload,
  setMsg,
}: {
  r: StockRow;
  units: Unit[];
  onReload: () => Promise<void>;
  setMsg: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [maintFor, setMaintFor] = useState<string | null>(null);
  const [scanFor, setScanFor] = useState<string | null>(null);
  const [addN, setAddN] = useState('2');
  const [addLoc, setAddLoc] = useState('');
  const mine = units.filter((u) => u.product.id === r.id);
  const locs = [...new Set(mine.map((u) => u.storageLocation).filter(Boolean))] as string[];

  async function bulkAdd() {
    const n = Math.max(1, Math.min(50, Number(addN) || 1));
    await staffApi('/api/admin/units/bulk', {
      method: 'POST',
      body: { productId: r.id, count: n, storageLocation: addLoc || undefined },
    });
    setMsg(`${n} exemplaire(s) ajouté(s) à « ${r.name} » — QR générés.`);
    await onReload();
  }

  async function setLocation(unitId: string, storageLocation: string) {
    await staffApi(`/api/admin/units/${unitId}`, { method: 'PATCH', body: { storageLocation } });
    await onReload();
  }
  async function relocateAll(storageLocation: string) {
    await staffApi('/api/admin/units/relocate', {
      method: 'POST',
      body: { productId: r.id, storageLocation },
    });
    setMsg(`Emplacement « ${storageLocation || '—'} » appliqué à tous les exemplaires de « ${r.name} ».`);
    await onReload();
  }
  async function renameTag(unitId: string, assetTag: string) {
    try {
      await staffApi(`/api/admin/units/${unitId}`, { method: 'PATCH', body: { assetTag } });
      setMsg(`Identifiant → ${assetTag}`);
      await onReload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
      await onReload();
    }
  }
  async function removeUnit(unitId: string, assetTag: string) {
    if (!confirm(`Supprimer l'exemplaire « ${assetTag} » ?`)) return;
    try {
      await staffApi(`/api/admin/units/${unitId}`, { method: 'DELETE' });
      setMsg(`Exemplaire « ${assetTag} » supprimé.`);
      await onReload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }
  async function removeMachine() {
    if (!confirm(`Supprimer définitivement « ${r.name} » et tous ses exemplaires ?`)) return;
    try {
      await staffApi(`/api/admin/products/${r.slug}`, { method: 'DELETE' });
      setMsg(`« ${r.name} » supprimé.`);
      await onReload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }
  /** Zone scannée = « BRZ-<CODE> » (étiquette d'emplacement) → on ne garde que le code. */
  function scanLocation(unitId: string, raw: string) {
    const m = raw.trim().toUpperCase().match(/^BRZ-(.+)$/);
    setLocation(unitId, m ? m[1] : raw.trim());
  }

  return (
    <>
      <tr className="stock-row" onClick={() => setOpen((v) => !v)}>
        <td>
          <span className="stock-row__caret">{open ? '▾' : '▸'}</span> {r.name}
          {!r.published && <span className="badge" style={{ marginLeft: 6 }}>hors ligne</span>}
        </td>
        <td className="num">
          <strong>{r.availableNow}</strong>
          <span className="small muted"> / {r.total}</span>
        </td>
        <td className="stock-row__bar">
          <StockBar r={r} />
        </td>
        <td className="small muted">
          {locs.length > 0 && <strong style={{ color: 'var(--ink)' }}>📍 {locs.join(', ')} · </strong>}
          {r.rented ? `${r.rented} loc. · ` : ''}
          {r.maintenance ? `${r.maintenance} entr. · ` : ''}
          {r.damaged + r.retired ? `${r.damaged + r.retired} HS` : ''}
          {!r.rented && !r.reserved && !r.maintenance && !r.damaged && !r.retired && locs.length === 0
            ? 'tout dispo'
            : ''}
        </td>
        <td>
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              removeMachine();
            }}
          >
            Supprimer
          </button>
        </td>
      </tr>
      {open && (
        <tr className="stock-detail">
          <td colSpan={5}>
            {r.total === 0 && (
              <p className="small muted">Aucun exemplaire. Ajoutez-en ci-dessous.</p>
            )}
            {mine.length > 0 && (
              <table className="table table--tight">
                <tbody>
                  {mine.map((u) => (
                    <Fragment key={u.id}>
                      <tr>
                        <td>
                          <input
                            key={u.assetTag}
                            defaultValue={u.assetTag}
                            style={{ width: 110, fontWeight: 700 }}
                            onBlur={(e) => {
                              if (e.target.value.trim() && e.target.value !== u.assetTag)
                                renameTag(u.id, e.target.value.trim());
                            }}
                          />
                          {u.serialNumber ? <span className="small muted"> · SN {u.serialNumber}</span> : null}
                        </td>
                        <td>
                          <div className="row" style={{ gap: 4, alignItems: 'center' }}>
                            <input
                              key={u.storageLocation ?? ''}
                              defaultValue={u.storageLocation ?? ''}
                              placeholder="R-01-A"
                              style={{ width: 80 }}
                              onBlur={(e) => {
                                if (e.target.value !== (u.storageLocation ?? '')) setLocation(u.id, e.target.value);
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Scanner l'étiquette d'emplacement"
                              onClick={() => setScanFor(scanFor === u.id ? null : u.id)}
                            >
                              📷
                            </button>
                          </div>
                          {scanFor === u.id && (
                            <div style={{ marginTop: 6 }}>
                              <ScanField
                                placeholder="Scanner l'étiquette du rack…"
                                autoFocus
                                onScan={(code) => {
                                  scanLocation(u.id, code);
                                  setScanFor(null);
                                }}
                              />
                            </div>
                          )}
                        </td>
                        <td>
                          <select
                            defaultValue={u.state}
                            onChange={async (e) => {
                              await staffApi(`/api/admin/units/${u.id}`, {
                                method: 'PATCH',
                                body: { state: e.target.value },
                              });
                              setMsg(`${u.assetTag} → ${e.target.value}`);
                              await onReload();
                            }}
                          >
                            {STATES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="small muted">
                          {u.immobilisedUntil
                            ? `immobilisé → ${formatDateBE(u.immobilisedUntil)}`
                            : u.nextMaintenanceAt
                              ? `entretien prévu ${formatDateBE(u.nextMaintenanceAt)}`
                              : '—'}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setMaintFor(maintFor === u.id ? null : u.id)}
                          >
                            {maintFor === u.id ? 'Fermer' : 'Entretien / réparation'}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => removeUnit(u.id, u.assetTag)}
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                      {maintFor === u.id && (
                        <tr>
                          <td colSpan={5}>
                            <MaintenanceForm
                              unitId={u.id}
                              onDone={async () => {
                                setMaintFor(null);
                                await onReload();
                              }}
                              setMsg={setMsg}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
            {mine.length > 0 && (
              <div className="row" style={{ marginTop: 8, gap: 8, alignItems: 'center' }}>
                <span className="small">Ranger tous en</span>
                <input
                  placeholder="R-01-A"
                  style={{ width: 100 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') relocateAll((e.target as HTMLInputElement).value);
                  }}
                />
                <span className="small muted">(Entrée pour appliquer)</span>
              </div>
            )}
            <div className="row" style={{ marginTop: 10, gap: 8, alignItems: 'center' }}>
              <span className="small">Ajouter</span>
              <input
                type="number"
                value={addN}
                onChange={(e) => setAddN(e.target.value)}
                style={{ width: 64 }}
              />
              <input
                placeholder="emplacement (opt.)"
                value={addLoc}
                onChange={(e) => setAddLoc(e.target.value)}
                style={{ width: 130 }}
              />
              <button className="btn btn-outline btn-sm" onClick={bulkAdd}>
                + exemplaires (QR auto)
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminExemplaires() {
  const [tab, setTab] = useState<'machines' | 'accessories' | 'consumables'>('machines');
  const [stock, setStock] = useState<{ machines: StockRow[]; consumables: ConsumableRow[] }>({
    machines: [],
    consumables: [],
  });
  const [units, setUnits] = useState<Unit[]>([]);
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const [s, u] = await Promise.all([
      staffApi<{ machines: StockRow[]; consumables: ConsumableRow[] }>('/api/admin/stock'),
      staffApi<{ units: Unit[] }>('/api/admin/units'),
    ]);
    setStock(s);
    setUnits(u.units);
  }
  useEffect(() => {
    load();
  }, []);

  const machines = stock.machines
    .filter((m) => (tab === 'accessories' ? m.kind !== 'MACHINE' : m.kind === 'MACHINE'))
    .filter((m) => !filter || m.name.toLowerCase().includes(filter.toLowerCase()));
  const byCat = new Map<string, StockRow[]>();
  for (const m of machines) {
    const k = m.category ?? 'Sans catégorie';
    byCat.set(k, [...(byCat.get(k) ?? []), m]);
  }

  const totAvail = machines.reduce((a, m) => a + m.availableNow, 0);
  const totUnits = machines.reduce((a, m) => a + m.total, 0);

  return (
    <div className="stack">
      <h1>Stock &amp; exemplaires</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      <div className="chips">
        <button
          className={`chip${tab === 'machines' ? ' active' : ''}`}
          onClick={() => setTab('machines')}
        >
          Machines
        </button>
        <button
          className={`chip${tab === 'accessories' ? ' active' : ''}`}
          onClick={() => setTab('accessories')}
        >
          Accessoires &amp; EPI
        </button>
        <button
          className={`chip${tab === 'consumables' ? ' active' : ''}`}
          onClick={() => setTab('consumables')}
        >
          Consommables
        </button>
      </div>

      {(tab === 'machines' || tab === 'accessories') && (
        <>
          <div className="stock-legend small">
            <span>
              <b>{totAvail}</b> disponibles aujourd’hui sur <b>{totUnits}</b> exemplaires
            </span>
            <span className="stockbar__key is-avail">dispo</span>
            <span className="stockbar__key is-reserved">réservé</span>
            <span className="stockbar__key is-rented">en location</span>
            <span className="stockbar__key is-maint">entretien</span>
            <span className="stockbar__key is-hs">HS / retiré</span>
          </div>
          <input
            placeholder={tab === 'machines' ? 'Filtrer une machine…' : 'Filtrer un accessoire…'}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          {[...byCat.entries()].map(([cat, rows]) => (
            <div key={cat} className="card card-body table-wrap">
              <h3 style={{ margin: '0 0 8px' }}>{cat}</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>{tab === 'machines' ? 'Machine' : 'Accessoire'}</th>
                    <th className="num">Dispo</th>
                    <th>Répartition</th>
                    <th>Emplacement</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <MachineRow key={r.id} r={r} units={units} onReload={load} setMsg={setMsg} />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {tab === 'consumables' && (
        <div className="card card-body table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Consommable</th>
                <th>Fournisseur</th>
                <th className="num">Prix unité</th>
                <th className="num">Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stock.consumables.map((c) => (
                <ConsumableStockRow key={c.id} c={c} setMsg={setMsg} onReload={load} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConsumableStockRow({
  c,
  setMsg,
  onReload,
}: {
  c: ConsumableRow;
  setMsg: (s: string) => void;
  onReload: () => Promise<void>;
}) {
  const [qty, setQty] = useState(c.stockQty != null ? String(c.stockQty) : '');
  const dirty = qty !== (c.stockQty != null ? String(c.stockQty) : '');
  return (
    <tr>
      <td>
        {c.name}
        {!c.published && <span className="badge" style={{ marginLeft: 6 }}>hors ligne</span>}
      </td>
      <td className="small muted">{c.partSupplier ?? '—'}</td>
      <td className="num">{c.dailyPrice ? `${c.dailyPrice.toFixed(2)} €` : '—'}</td>
      <td className="num">
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={{ width: 72 }}
          placeholder="—"
        />
      </td>
      <td>
        {dirty && (
          <button
            className="btn btn-outline btn-sm"
            onClick={async () => {
              await staffApi(`/api/admin/products/${c.slug}/stock`, {
                method: 'PATCH',
                body: { stockQty: Number(qty) || 0 },
              });
              setMsg(`Stock « ${c.name} » → ${qty || 0}`);
              await onReload();
            }}
          >
            Enregistrer
          </button>
        )}
      </td>
    </tr>
  );
}
