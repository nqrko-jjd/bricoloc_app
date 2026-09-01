'use client';
import { useEffect, useState } from 'react';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdminContenus() {
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const load = () =>
    staffApi<{ content: any[] }>('/api/admin/content').then((r) => setRows(r.content));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="stack">
      <h1>Contenus du site</h1>
      <p className="muted small">
        Pages éditoriales : fonctionnement, Click &amp; Collect, livraison, pros, FAQ, mentions
        légales, conditions générales…
      </p>
      <div className="two-col">
        <div className="card card-body">
          <table className="table">
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSel(c)}>
                      {c.key} ({c.locale})
                    </button>
                  </td>
                  <td className="small">{c.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setSel({ key: '', locale: 'fr', title: '', body: '' })}
          >
            + Nouveau contenu
          </button>
        </div>
        {sel && (
          <div className="card card-pad stack">
            <div className="field">
              <label>Clé</label>
              <input
                value={sel.key}
                onChange={(e) => setSel({ ...sel, key: e.target.value })}
                disabled={!!sel.id}
              />
            </div>
            <div className="field">
              <label>Titre</label>
              <input value={sel.title ?? ''} onChange={(e) => setSel({ ...sel, title: e.target.value })} />
            </div>
            <div className="field">
              <label>Contenu</label>
              <textarea
                rows={10}
                value={sel.body}
                onChange={(e) => setSel({ ...sel, body: e.target.value })}
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={async () => {
                await staffApi('/api/admin/content', {
                  method: 'PUT',
                  body: { key: sel.key, locale: sel.locale ?? 'fr', title: sel.title, body: sel.body },
                });
                setSel(null);
                await load();
              }}
            >
              Enregistrer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
