'use client';
import { use, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatEUR, formatDateBE } from '@bricoloc/shared';
import { API_URL } from '@/lib/api';
import { staffApi, useStaff } from '@/lib/staff';
import { StatusBadge } from '@/components/StatusBadge';
import { Avatar } from '@/components/admin/Avatar';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ID_LABEL: Record<string, string> = {
  NONE: 'Non fournie',
  PENDING: 'À vérifier',
  VERIFIED: 'Validée',
  REJECTED: 'Refusée',
};

function IdDocCard({
  id,
  c,
  token,
  onChange,
  setMsg,
}: {
  id: string;
  c: any;
  token: string | null;
  onChange: () => void;
  setMsg: (s: string) => void;
}) {
  const [img, setImg] = useState<string | null>(null);
  const [why, setWhy] = useState('');
  const status = c.idDocStatus ?? 'NONE';

  useEffect(() => {
    if (status === 'NONE') return;
    let url: string | null = null;
    fetch(`${API_URL}/api/admin/customers/${id}/id-document/file`, {
      headers: { authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b) {
          url = URL.createObjectURL(b);
          setImg(url);
        }
      })
      .catch(() => {});
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, status, token, c.idDocUploadedAt]);

  async function review(next: 'VERIFIED' | 'REJECTED') {
    await staffApi(`/api/admin/customers/${id}/id-document/review`, {
      method: 'POST',
      body: { status: next, note: why },
    });
    setMsg(next === 'VERIFIED' ? 'Pièce d’identité validée.' : 'Pièce d’identité refusée.');
    onChange();
  }

  return (
    <div className="card card-body stack">
      <div className="spread">
        <h3>Pièce d’identité</h3>
        <span
          className={`badge${status === 'VERIFIED' ? ' badge-ok' : status === 'REJECTED' ? ' badge-warn' : ''}`}
        >
          {ID_LABEL[status] ?? status}
        </span>
      </div>
      {status === 'NONE' ? (
        <p className="small muted">Le client n’a pas encore transmis de carte d’identité.</p>
      ) : (
        <>
          {img ? (
            <a href={img} target="_blank" rel="noreferrer">
              <img
                src={img}
                alt="Carte d’identité"
                style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </a>
          ) : (
            <p className="small muted">Chargement de l’image…</p>
          )}
          {c.idDocUploadedAt && (
            <p className="small muted">Reçue le {formatDateBE(c.idDocUploadedAt)}</p>
          )}
          {status !== 'VERIFIED' && (
            <input
              placeholder="Motif du refus (optionnel)"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
            />
          )}
          <div className="row">
            {status !== 'VERIFIED' && (
              <button className="btn btn-primary btn-sm" onClick={() => review('VERIFIED')}>
                Valider
              </button>
            )}
            {status !== 'REJECTED' && (
              <button className="btn btn-outline btn-sm" onClick={() => review('REJECTED')}>
                Refuser
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                if (!confirm('Supprimer définitivement la copie de la pièce d’identité ?')) return;
                await staffApi(`/api/admin/customers/${id}/id-document`, { method: 'DELETE' });
                setMsg('Pièce d’identité supprimée.');
                onChange();
              }}
            >
              Supprimer (RGPD)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useStaff();
  const [c, setC] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');
  const [addr, setAddr] = useState({ label: '', line1: '', postalCode: '', city: '' });

  async function load() {
    const r = await staffApi<{ customer: any; stats: any }>(`/api/admin/customers/${id}`);
    setC(r.customer);
    setStats(r.stats);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function patch(body: Record<string, unknown>, ok = 'Enregistré.') {
    await staffApi(`/api/admin/customers/${id}`, { method: 'PATCH', body });
    setMsg(ok);
    await load();
  }

  if (!c) return <p className="loading-dark"><span className="spinner" /> Chargement…</p>;

  return (
    <div className="stack">
      <p className="small"><Link href="/admin/clients">← Clients</Link></p>
      <div className="spread">
        <h1 className="row" style={{ gap: 12, alignItems: 'center' }}>
          <Avatar firstName={c.firstName} lastName={c.lastName} size={44} />
          {c.firstName} {c.lastName}{' '}
          <span className="badge">{c.customerType}</span>
        </h1>
        <div className="pill-row">
          <span className="badge">{stats?.reservations} réservations</span>
          <span className="badge badge-ok">{formatEUR(stats?.spent ?? 0)} dépensés</span>
          {stats?.openTickets > 0 && <span className="badge badge-warn">{stats.openTickets} ticket(s)</span>}
        </div>
      </div>
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="two-col">
        <div className="stack">
          <div className="card card-body">
            <h3>Coordonnées</h3>
            <div className="field-2">
              <label className="field small">Prénom
                <input defaultValue={c.firstName} onBlur={(e) => patch({ firstName: e.target.value })} />
              </label>
              <label className="field small">Nom
                <input defaultValue={c.lastName} onBlur={(e) => patch({ lastName: e.target.value })} />
              </label>
            </div>
            <label className="field small">Téléphone
              <input defaultValue={c.phone} onBlur={(e) => patch({ phone: e.target.value })} />
            </label>
            <p className="small muted">E-mail : {c.email} · Inscrit le {formatDateBE(c.createdAt)}</p>
            <div className="field-2">
              <label className="field small">Type
                <select defaultValue={c.customerType} onChange={(e) => patch({ customerType: e.target.value })}>
                  <option value="PARTICULIER">Particulier</option>
                  <option value="PRO">Pro</option>
                </select>
              </label>
              <label className="field small">Remise négociée (0–1)
                <input type="number" step="0.05" defaultValue={c.negotiatedDiscountPct ?? ''}
                  onBlur={(e) => patch({ negotiatedDiscountPct: e.target.value || 0 })} />
              </label>
            </div>
            {c.customerType === 'PRO' && (
              <div className="field-2">
                <label className="field small">Société
                  <input defaultValue={c.companyName ?? ''} onBlur={(e) => patch({ companyName: e.target.value })} />
                </label>
                <label className="field small">N° TVA
                  <input defaultValue={c.vatNumber ?? ''} onBlur={(e) => patch({ vatNumber: e.target.value })} />
                </label>
              </div>
            )}
          </div>

          <div className="card card-body">
            <h3>Adresses</h3>
            {(c.addresses ?? []).map((a: any) => (
              <div key={a.id} className="line small">
                <span>
                  {a.label ? `${a.label} — ` : ''}{a.line1}, {a.postalCode} {a.city}
                  {a.isConstructionSite ? ' (chantier)' : ''}
                </span>
                <button className="btn btn-ghost btn-sm"
                  onClick={async () => { await staffApi(`/api/admin/addresses/${a.id}`, { method: 'DELETE' }); load(); }}>
                  ×
                </button>
              </div>
            ))}
            <div className="row" style={{ marginTop: 8 }}>
              <input placeholder="Libellé" value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} style={{ width: 100 }} />
              <input placeholder="Rue et n°" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} style={{ flex: 1 }} />
              <input placeholder="CP" value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} style={{ width: 70 }} />
              <input placeholder="Ville" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} style={{ width: 110 }} />
              <button className="btn btn-outline btn-sm"
                onClick={async () => {
                  if (!addr.line1 || !addr.city) return;
                  await staffApi(`/api/admin/customers/${id}/addresses`, { method: 'POST', body: addr });
                  setAddr({ label: '', line1: '', postalCode: '', city: '' });
                  load();
                }}>+ Ajouter</button>
            </div>
          </div>

          <div className="card card-body">
            <h3>Note interne</h3>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              style={{ width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 6 }} />
            <button className="btn btn-outline btn-sm" style={{ marginTop: 6 }}
              onClick={async () => { await staffApi(`/api/admin/customers/${id}/note`, { method: 'PUT', body: { text: note } }); setMsg('Note enregistrée.'); }}>
              Enregistrer la note
            </button>
          </div>
        </div>

        <div className="stack">
          <IdDocCard id={id} c={c} token={token()} onChange={load} setMsg={setMsg} />

          <div className="card card-body">
            <h3>Réservations</h3>
            {(c.reservations ?? []).map((r: any) => (
              <div key={r.id} className="line small">
                <Link href={`/admin/reservations/${r.id}`}>{r.number}</Link>
                <span><StatusBadge status={r.status} /> {formatEUR(r.totals?.totalTVAC ?? 0)}</span>
              </div>
            ))}
            {(c.reservations ?? []).length === 0 && <p className="small muted">Aucune réservation.</p>}
          </div>

          <div className="card card-body">
            <h3>Factures</h3>
            {(c.reservations ?? []).flatMap((r: any) => r.invoices ?? []).map((inv: any) => (
              <p key={inv.id} className="small">
                <a href={`${API_URL}/api/admin/invoices/${inv.id}/pdf?token=${token()}`} target="_blank" rel="noreferrer">
                  {inv.number} ({inv.kind})
                </a>
              </p>
            ))}
          </div>

          <div className="card card-body">
            <h3>Tickets</h3>
            {(c.supportTickets ?? []).map((t: any) => (
              <p key={t.id} className="small">
                <span className="badge">{t.status}</span> {t.subject}
              </p>
            ))}
            {(c.supportTickets ?? []).length === 0 && <p className="small muted">Aucun ticket.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
