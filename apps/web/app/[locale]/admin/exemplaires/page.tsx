'use client';
import { Fragment, useEffect, useState } from 'react';
import { formatDateBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import type { ProductDetail } from '@/lib/types';

interface Unit {
  id: string;
  assetTag: string;
  serialNumber: string | null;
  barcode: string | null;
  qrToken: string;
  state: string;
  immobilisedUntil: string | null;
  nextMaintenanceAt: string | null;
  notes: string | null;
  product: { id: string; name: string };
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

export default function AdminExemplaires() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [f, setF] = useState({ productId: '', assetTag: '', serialNumber: '' });
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  async function load() {
    const [u, p] = await Promise.all([
      staffApi<{ units: Unit[] }>('/api/admin/units'),
      staffApi<{ products: ProductDetail[] }>('/api/admin/products?kind=MACHINE'),
    ]);
    setUnits(u.units);
    setProducts(p.products);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <h1>Exemplaires &amp; maintenance</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      <form
        className="card card-pad row"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await staffApi('/api/admin/units', { method: 'POST', body: f });
            setMsg(`Exemplaire ${f.assetTag} enregistré (QR généré).`);
            setF({ productId: '', assetTag: '', serialNumber: '' });
            await load();
          } catch (err) {
            setMsg(err instanceof Error ? err.message : 'Erreur');
          }
        }}
      >
        <div className="field">
          <label>Machine</label>
          <select
            value={f.productId}
            onChange={(e) => setF({ ...f, productId: e.target.value })}
            required
          >
            <option value="">—</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Identifiant (asset tag)</label>
          <input
            value={f.assetTag}
            onChange={(e) => setF({ ...f, assetTag: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>N° de série</label>
          <input
            value={f.serialNumber}
            onChange={(e) => setF({ ...f, serialNumber: e.target.value })}
          />
        </div>
        <button className="btn btn-primary btn-sm">Ajouter</button>
      </form>

      <div className="card card-body table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Machine</th>
              <th>N° série</th>
              <th>QR</th>
              <th>État</th>
              <th>Prochaine maintenance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <Fragment key={u.id}>
                <tr
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setOpen(u.id);
                  }}
                >
                  <td>{u.assetTag}</td>
                  <td>{u.product.name}</td>
                  <td className="small">{u.serialNumber ?? '—'}</td>
                  <td className="small">{u.qrToken.slice(0, 10)}…</td>
                  <td>
                    <select
                      defaultValue={u.state}
                      onChange={async (e) => {
                        await staffApi(`/api/admin/units/${u.id}`, {
                          method: 'PATCH',
                          body: { state: e.target.value },
                        });
                        setMsg(`${u.assetTag} → ${e.target.value}`);
                        await load();
                      }}
                    >
                      {STATES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="small">
                    {u.immobilisedUntil
                      ? `immobilisé jusqu’au ${formatDateBE(u.immobilisedUntil)}`
                      : u.nextMaintenanceAt
                        ? formatDateBE(u.nextMaintenanceAt)
                        : '—'}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setOpen(open === u.id ? null : u.id)}
                    >
                      {open === u.id ? 'Fermer' : 'Actions'}
                    </button>
                  </td>
                </tr>
                {open === u.id && (
                  <tr>
                    <td colSpan={7} style={{ background: 'var(--bg-alt)' }}>
                      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div>
                          <strong className="small">Locations</strong>
                          <ul className="small">
                            {u.reservationUnits.map((ru, i) => (
                              <li key={i}>
                                {ru.reservationItem.reservation.number} —{' '}
                                {ru.returnedAt ? 'rendu' : 'en cours'}
                              </li>
                            ))}
                            {u.reservationUnits.length === 0 && <li>—</li>}
                          </ul>
                        </div>
                        <div>
                          <strong className="small">Dommages</strong>
                          <ul className="small">
                            {u.damages.map((d, i) => (
                              <li key={i}>
                                {d.description} ({d.feeHT} €){d.resolved ? ' ✔' : ''}
                              </li>
                            ))}
                            {u.damages.length === 0 && <li>—</li>}
                          </ul>
                        </div>
                        <div>
                          <strong className="small">Entretiens / réparations</strong>
                          <ul className="small">
                            {u.maintenances.map((m, i) => (
                              <li key={i}>
                                {formatDateBE(m.performedAt)} — {m.type} : {m.description}
                                {m.startAt && m.endAt
                                  ? ` (${formatDateBE(m.startAt)}→${formatDateBE(m.endAt)})`
                                  : ''}
                              </li>
                            ))}
                            {u.maintenances.length === 0 && <li>—</li>}
                          </ul>
                        </div>
                      </div>

                      <MaintenanceForm unitId={u.id} onDone={load} setMsg={setMsg} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
