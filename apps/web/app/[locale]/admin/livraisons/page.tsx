'use client';
import { useEffect, useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUSES = ['REQUESTED', 'SCHEDULED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'PICKUP_SCHEDULED', 'COLLECTED'];

export default function AdminLivraisons() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () =>
    staffApi<{ deliveries: any[] }>('/api/ops/deliveries').then((r) => setRows(r.deliveries));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <h1>Livraisons</h1>
      <div className="card card-body table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Réservation</th>
              <th>Sens</th>
              <th>Adresse</th>
              <th>Frais</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.reservation?.number}</td>
                <td>{d.direction === 'OUT' ? 'Livraison' : 'Reprise'}</td>
                <td className="small">
                  {d.address
                    ? `${d.address.line1 ?? ''}, ${d.address.postalCode ?? ''} ${d.address.city ?? ''}`
                    : '—'}
                </td>
                <td>{formatEUR(d.feeHT)}</td>
                <td>
                  <select
                    defaultValue={d.status}
                    onChange={async (e) => {
                      await staffApi('/api/ops/deliveries/assign', {
                        method: 'POST',
                        body: { deliveryId: d.id, status: e.target.value },
                      });
                      await load();
                    }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Aucune livraison programmée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
