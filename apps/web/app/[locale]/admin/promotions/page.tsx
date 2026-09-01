'use client';
import { useEffect, useState } from 'react';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminPromotions() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ code: '', kind: 'PERCENT', value: 10, minTotalHT: 0, active: true });
  const load = () =>
    staffApi<{ promotions: any[] }>('/api/admin/promotions').then((r) => setRows(r.promotions));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <h1>Promotions</h1>
      <form
        className="card card-pad row"
        onSubmit={async (e) => {
          e.preventDefault();
          await staffApi('/api/admin/promotions', { method: 'POST', body: f });
          setF({ code: '', kind: 'PERCENT', value: 10, minTotalHT: 0, active: true });
          await load();
        }}
      >
        <div className="field">
          <label>Code</label>
          <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="PERCENT">Pourcentage</option>
            <option value="AMOUNT">Montant €</option>
          </select>
        </div>
        <div className="field">
          <label>Valeur</label>
          <input
            type="number"
            value={f.value}
            onChange={(e) => setF({ ...f, value: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Min. HTVA</label>
          <input
            type="number"
            value={f.minTotalHT}
            onChange={(e) => setF({ ...f, minTotalHT: Number(e.target.value) })}
          />
        </div>
        <button className="btn btn-primary btn-sm">Enregistrer</button>
      </form>
      <div className="card card-body table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Valeur</th>
              <th>Min HTVA</th>
              <th>Actif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.code}</strong>
                </td>
                <td>{p.kind}</td>
                <td>{p.value}</td>
                <td>{p.minTotalHT}</td>
                <td>{p.active ? '✔' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
