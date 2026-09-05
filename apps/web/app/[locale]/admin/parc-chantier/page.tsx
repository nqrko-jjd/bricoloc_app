'use client';
import { useEffect, useState } from 'react';
import { formatDateTimeBE, formatEUR } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { ScanField } from '@/components/admin/ScanField';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ParcChantier() {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ code: '', chantierId: '', takenBy: '' });
  const [chantierQ, setChantierQ] = useState('');
  const [chantierPickOpen, setChantierPickOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

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
        <div style={{ maxWidth: 420 }}>
          <ScanField
            placeholder="Scanner ou taper le code de l’exemplaire…"
            autoFocus={false}
            onScan={(code) => setForm((f) => ({ ...f, code }))}
          />
          {form.code && <p className="small muted" style={{ margin: '4px 0 0' }}>Code saisi : <strong>{form.code}</strong></p>}
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ position: 'relative', minWidth: 240 }}>
            <input
              placeholder="Rechercher un chantier…"
              value={
                chantierPickOpen
                  ? chantierQ
                  : (activeChantiers.find((c: any) => c.id === form.chantierId)?.name ?? '')
              }
              onFocus={() => {
                setChantierPickOpen(true);
                setChantierQ('');
              }}
              onBlur={() => setTimeout(() => setChantierPickOpen(false), 150)}
              onChange={(e) => setChantierQ(e.target.value)}
              style={{ width: '100%' }}
            />
            {chantierPickOpen && (
              <div
                className="card card-body"
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  maxHeight: 220, overflowY: 'auto', padding: 4, marginTop: 2,
                }}
              >
                {activeChantiers
                  .filter((c: any) =>
                    !chantierQ ||
                    c.name.toLowerCase().includes(chantierQ.toLowerCase()) ||
                    (c.client ?? '').toLowerCase().includes(chantierQ.toLowerCase()),
                  )
                  .map((c: any) => (
                    <button
                      type="button"
                      key={c.id}
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                      onClick={() => {
                        setForm({ ...form, chantierId: c.id });
                        setChantierPickOpen(false);
                      }}
                    >
                      {c.name}
                      {c.client ? ` (${c.client})` : ''}
                    </button>
                  ))}
                {activeChantiers.length === 0 && (
                  <p className="small muted" style={{ padding: '4px 8px' }}>Aucun chantier synchronisé.</p>
                )}
              </div>
            )}
          </div>
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
        <p className="small muted" style={{ margin: '0 0 8px' }}>
          Coût interne = tarif de location Bricoloc × jours dehors — imputation indicative pour
          arbitrer une éventuelle refacturation interne JJD ↔ Bricoloc, pas une facture.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Exemplaire</th>
              <th>Machine</th>
              <th>Chantier</th>
              <th>Depuis</th>
              <th className="num">Coût interne</th>
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
                <td className="num small">
                  {formatEUR(l.estCostHT)}
                  <span className="muted"> ({l.daysOut} j)</span>
                </td>
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
                <td colSpan={7} className="small muted">
                  Aucune machine sortie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card card-pad">
        <div className="spread" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>
            Chantiers ({(showArchived ? data.chantiers : activeChantiers).length}
            {!showArchived && data.chantiers.length > activeChantiers.length
              ? ` / ${data.chantiers.length}`
              : ''}
            )
          </h3>
          {data.chantiers.length > activeChantiers.length && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived((v) => !v)}>
              {showArchived
                ? 'Masquer les archivés'
                : `Voir aussi les archivés (${data.chantiers.length - activeChantiers.length})`}
            </button>
          )}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Client</th>
              <th>Réf. JJD</th>
              <th>Machines dehors</th>
              <th className="num">Coût interne cumulé</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {(showArchived ? data.chantiers : activeChantiers).map((c: any) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="small">{c.client ?? '—'}</td>
                <td className="small">{c.externalRef ?? '—'}</td>
                <td>{c.toolsOut}</td>
                <td className="num small">{c.internalCostHT > 0 ? formatEUR(c.internalCostHT) : '—'}</td>
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
