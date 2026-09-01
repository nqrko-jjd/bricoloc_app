'use client';
import { useEffect, useState } from 'react';
import { formatDateBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminClients() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () =>
    staffApi<{ customers: any[] }>('/api/admin/customers').then((r) => setRows(r.customers));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <h1>Clients</h1>
      <div className="card card-body table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail</th>
              <th>Type</th>
              <th>Société</th>
              <th>Remise négociée</th>
              <th>Réservations</th>
              <th>Depuis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.firstName} {c.lastName}
                </td>
                <td className="small">{c.email}</td>
                <td>
                  <select
                    defaultValue={c.customerType}
                    onChange={async (e) => {
                      await staffApi(`/api/admin/customers/${c.id}`, {
                        method: 'PATCH',
                        body: { customerType: e.target.value },
                      });
                      await load();
                    }}
                  >
                    <option value="PARTICULIER">Particulier</option>
                    <option value="PRO">Pro</option>
                  </select>
                </td>
                <td className="small">{c.companyName ?? '—'}</td>
                <td>
                  <input
                    type="number"
                    step="0.05"
                    defaultValue={c.negotiatedDiscountPct ?? ''}
                    style={{ width: 70 }}
                    onBlur={async (e) => {
                      await staffApi(`/api/admin/customers/${c.id}`, {
                        method: 'PATCH',
                        body: { negotiatedDiscountPct: e.target.value || 0 },
                      });
                    }}
                  />
                </td>
                <td>{c._count?.reservations ?? 0}</td>
                <td className="small">{formatDateBE(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
