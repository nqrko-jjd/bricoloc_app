'use client';
import { useEffect, useState } from 'react';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminZones() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ name: '', postalPrefixes: '', baseFee: 25, perKm: 0 });
  const load = () =>
    staffApi<{ zones: any[] }>('/api/admin/delivery-zones').then((r) => setRows(r.zones));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <h1>Zones de livraison</h1>
      <p className="muted small">
        Préfixes de codes postaux belges. Une adresse hors de toute zone active est refusée.
      </p>
      <form
        className="card card-pad row"
        onSubmit={async (e) => {
          e.preventDefault();
          await staffApi('/api/admin/delivery-zones', {
            method: 'POST',
            body: {
              name: f.name,
              postalPrefixes: f.postalPrefixes.split(',').map((s) => s.trim()).filter(Boolean),
              baseFee: f.baseFee,
              perKm: f.perKm,
              active: true,
            },
          });
          setF({ name: '', postalPrefixes: '', baseFee: 25, perKm: 0 });
          await load();
        }}
      >
        <div className="field">
          <label>Nom</label>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Préfixes CP (virgules)</label>
          <input
            value={f.postalPrefixes}
            onChange={(e) => setF({ ...f, postalPrefixes: e.target.value })}
            placeholder="10, 11, 12"
            required
          />
        </div>
        <div className="field">
          <label>Frais de base</label>
          <input
            type="number"
            value={f.baseFee}
            onChange={(e) => setF({ ...f, baseFee: Number(e.target.value) })}
          />
        </div>
        <button className="btn btn-primary btn-sm">Ajouter</button>
      </form>
      <div className="card card-body table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Préfixes</th>
              <th>Frais</th>
              <th>Actif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((z) => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td className="small">{(z.postalPrefixes as string[]).join(', ')}</td>
                <td>{z.baseFee} €</td>
                <td>{z.active ? '✔' : '—'}</td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      await staffApi(`/api/admin/delivery-zones/${z.id}`, { method: 'DELETE' });
                      await load();
                    }}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
