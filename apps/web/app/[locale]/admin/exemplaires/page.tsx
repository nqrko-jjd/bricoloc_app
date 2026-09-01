'use client';
import { Fragment, useEffect, useState } from 'react';
import { formatDateBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import type { ProductDetail } from '@/lib/types';

interface Unit {
  id: string;
  assetTag: string;
  serialNumber: string | null;
  qrToken: string;
  state: string;
  nextMaintenanceAt: string | null;
  product: { id: string; name: string };
  reservationUnits: { assignedAt: string; returnedAt: string | null; reservationItem: { reservation: { number: string } } }[];
  damages: { description: string; feeHT: number; resolved: boolean }[];
  maintenances: { type: string; description: string; performedAt: string }[];
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
                <tr>
                  <td>{u.assetTag}</td>
                  <td>{u.product.name}</td>
                  <td className="small">{u.serialNumber ?? '—'}</td>
                  <td className="small">{u.qrToken}</td>
                  <td>
                    <span
                      className={`badge ${
                        u.state === 'AVAILABLE'
                          ? 'badge-ok'
                          : u.state === 'RENTED'
                            ? 'badge'
                            : 'badge-warn'
                      }`}
                    >
                      {u.state}
                    </span>
                  </td>
                  <td className="small">
                    {u.nextMaintenanceAt ? formatDateBE(u.nextMaintenanceAt) : '—'}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setOpen(open === u.id ? null : u.id)}
                    >
                      {open === u.id ? 'Fermer' : 'Historique'}
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
                          <strong className="small">Entretiens</strong>
                          <ul className="small">
                            {u.maintenances.map((m, i) => (
                              <li key={i}>
                                {formatDateBE(m.performedAt)} — {m.type} : {m.description}
                              </li>
                            ))}
                            {u.maintenances.length === 0 && <li>—</li>}
                          </ul>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={async () => {
                              const description = prompt('Description de l’entretien ?');
                              if (!description) return;
                              await staffApi(`/api/admin/units/${u.id}/maintenance`, {
                                method: 'POST',
                                body: { type: 'ENTRETIEN', description },
                              });
                              await load();
                            }}
                          >
                            + Entretien
                          </button>
                        </div>
                      </div>
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
