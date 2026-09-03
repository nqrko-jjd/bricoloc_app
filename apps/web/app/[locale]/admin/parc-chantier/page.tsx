'use client';
import { useEffect, useState } from 'react';
import { formatDateTimeBE } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ParcChantier() {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ code: '', chantierId: '', takenBy: '' });

  const load = () => staffApi<any>('/api/admin/parc').then(setData);
  useEffect(() => {
    load();
  }, []);

  async function sortie() {
    if (!form.code || !form.chantierId) return;
    try {
      await staffApi('/api/admin/parc/loans', { method: 'POST', body: form });
      setMsg(`Sortie enregistrée : ${form.code}`);
      setForm({ code: '', chantierId: form.chantierId, takenBy: form.takenBy });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function retour(id: string) {
    await staffApi(`/api/admin/parc/loans/${id}/return`, { method: 'POST', body: {} });
    setMsg('Retour enregistré.');
    await load();
  }

  if (!data)
    return (
      <p className="loading-dark">
        <span className="spinner" /> Chargement…
      </p>
    );

  const activeChantiers = (data.chantiers ?? []).filter((c: any) => c.active);

  return (
    <div className="stack">
      <h1>Parc chantier — JJD</h1>
      <p className="small muted">
        Parc partagé avec JJD Consult. Les sorties/retours se font normalement depuis le CRM JJD
        (via l’API) ; ce formulaire est un secours. Une machine sortie chantier est automatiquement
        retirée des disponibilités de location Bricoloc.
      </p>
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="card card-pad stack">
        <h3>Sortie chantier (manuelle)</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <input
            placeholder="Code / n° d’exemplaire scanné"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            style={{ flex: 1, minWidth: 180 }}
          />
          <select
            value={form.chantierId}
            onChange={(e) => setForm({ ...form, chantierId: e.target.value })}
          >
            <option value="">— Chantier —</option>
            {activeChantiers.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.client ? ` (${c.client})` : ''}
              </option>
            ))}
          </select>
          <input
            placeholder="Pris par (nom)"
            value={form.takenBy}
            onChange={(e) => setForm({ ...form, takenBy: e.target.value })}
            style={{ width: 150 }}
          />
          <button className="btn btn-primary btn-sm" onClick={sortie}>
            Sortir
          </button>
        </div>
        {activeChantiers.length === 0 && (
          <p className="small muted">
            Aucun chantier synchronisé. Le CRM JJD doit d’abord pousser ses chantiers via l’API.
          </p>
        )}
      </div>

      <div className="card card-pad">
        <h3>Machines sur chantier ({data.activeLoans.length})</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Exemplaire</th>
              <th>Machine</th>
              <th>Chantier</th>
              <th>Depuis</th>
              <th>Par</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.activeLoans.map((l: any) => (
              <tr key={l.id}>
                <td className="small">{l.assetTag}</td>
                <td>{l.product}</td>
                <td>{l.chantier}</td>
                <td className="small">{formatDateTimeBE(l.takenAt)}</td>
                <td className="small">{l.takenBy ?? '—'}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => retour(l.id)}>
                    Retour dépôt
                  </button>
                </td>
              </tr>
            ))}
            {data.activeLoans.length === 0 && (
              <tr>
                <td colSpan={6} className="small muted">
                  Aucune machine sortie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card card-pad">
        <h3>Chantiers ({data.chantiers.length})</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Client</th>
              <th>Réf. JJD</th>
              <th>Machines dehors</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {data.chantiers.map((c: any) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="small">{c.client ?? '—'}</td>
                <td className="small">{c.externalRef ?? '—'}</td>
                <td>{c.toolsOut}</td>
                <td>
                  <span className={`badge${c.active ? ' badge-ok' : ''}`}>
                    {c.active ? 'Actif' : 'Archivé'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.consumption.length > 0 && (
        <div className="card card-pad">
          <h3>Consommables utilisés (50 derniers)</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Qté</th>
                <th>Chantier</th>
                <th>Quand</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {data.consumption.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.product}</td>
                  <td>{c.quantity}</td>
                  <td>{c.chantier}</td>
                  <td className="small">{formatDateTimeBE(c.takenAt)}</td>
                  <td className="small">{c.takenBy ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
