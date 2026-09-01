'use client';
import { useEffect, useState } from 'react';
import { staffApi, useStaff } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ROLES = ['ADMIN', 'RESPONSABLE', 'COMPTOIR', 'PREPARATEUR', 'LIVREUR', 'TECHNICIEN', 'COMPTABILITE'];

export default function AdminEquipe() {
  const { staff } = useStaff();
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'COMPTOIR' });
  const [err, setErr] = useState('');
  const load = () =>
    staffApi<{ staff: any[] }>('/api/admin/staff')
      .then((r) => setRows(r.staff))
      .catch(() => setErr('Accès réservé aux rôles ADMIN / RESPONSABLE.'));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <h1>Équipe BRICOLOC</h1>
      {err && <div className="alert alert-warn">{err}</div>}
      {staff?.role === 'ADMIN' && (
        <form
          className="card card-pad row"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr('');
            try {
              await staffApi('/api/admin/staff', { method: 'POST', body: f });
              setF({ name: '', email: '', password: '', role: 'COMPTOIR' });
              await load();
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Erreur');
            }
          }}
        >
          <div className="field">
            <label>Nom</label>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              required
              minLength={8}
            />
          </div>
          <div className="field">
            <label>Rôle</label>
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-sm">Créer</button>
        </form>
      )}
      <div className="card card-body table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail</th>
              <th>Rôle</th>
              <th>Actif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="small">{s.email}</td>
                <td>
                  <span className="badge">{s.role}</span>
                </td>
                <td>{s.active ? '✔' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Rôles : administrateur, responsable, employé au comptoir, préparateur, livreur,
        technicien, comptabilité. Chaque rôle a des accès dédiés (préparation, livraison,
        maintenance, facturation…).
      </p>
    </div>
  );
}
