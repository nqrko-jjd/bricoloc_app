'use client';
import { useEffect, useState } from 'react';
import { staffApi } from '@/lib/staff';

/* eslint-disable @typescript-eslint/no-explicit-any */

const CATEGORIES = ['peinture', 'bois', 'exterieur', 'carrelage', 'forer-casser', 'preparation', 'bricopack'];
const TONES = ['navy', 'red', 'light'];

const EMPTY = {
  slug: '',
  category: 'preparation',
  title: '',
  excerpt: '',
  body: '',
  readMinutes: 5,
  tone: 'navy',
  relatedSlugs: '',
  featured: false,
  published: true,
};

export default function AdminConseils() {
  const [guides, setGuides] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = () => staffApi<{ guides: any[] }>('/api/admin/guides').then((r) => setGuides(r.guides));
  useEffect(() => {
    load();
  }, []);

  function edit(g: any) {
    setEditing(g.slug);
    setDraft({
      ...g,
      relatedSlugs: Array.isArray(g.relatedSlugs) ? g.relatedSlugs.join(', ') : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(retranslate = false) {
    await staffApi('/api/admin/guides', {
      method: 'POST',
      body: {
        ...draft,
        readMinutes: Number(draft.readMinutes) || 5,
        relatedSlugs: String(draft.relatedSlugs)
          .split(/[,\s]+/)
          .filter(Boolean),
        retranslate,
      },
    });
    setMsg(retranslate ? 'Enregistré. Traduction NL/EN relancée…' : 'Enregistré.');
    setDraft(EMPTY);
    setEditing(null);
    await load();
    if (retranslate) {
      await staffApi(`/api/admin/guides/${draft.slug}/retranslate`, { method: 'POST' }).catch(() => {});
      setMsg('Traductions NL/EN mises à jour.');
      await load();
    }
  }

  async function remove(slug: string) {
    if (!confirm(`Supprimer le guide « ${slug} » ?`)) return;
    await staffApi(`/api/admin/guides/${slug}`, { method: 'DELETE' });
    await load();
  }

  const F = (k: string) => ({
    value: draft[k] ?? '',
    onChange: (e: any) => setDraft({ ...draft, [k]: e.target.value }),
  });

  return (
    <div className="stack">
      <h1>Magazine « Conseils & DIY »</h1>
      {msg && <div className="alert alert-ok">{msg}</div>}

      <div className="card card-pad">
        <h3>{editing ? `Modifier « ${editing} »` : 'Nouvel article'}</h3>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field">
            <label>Slug (URL)</label>
            <input {...F('slug')} placeholder="poser-un-parquet" disabled={!!editing} />
          </div>
          <div className="field">
            <label>Catégorie</label>
            <select {...F('category')}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Temps de lecture (min)</label>
            <input type="number" {...F('readMinutes')} />
          </div>
          <div className="field">
            <label>Couleur de carte</label>
            <select {...F('tone')}>
              {TONES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Titre</label>
          <input {...F('title')} />
        </div>
        <div className="field">
          <label>Accroche (excerpt)</label>
          <textarea rows={2} {...F('excerpt')} />
        </div>
        <div className="field">
          <label>Contenu — « ## » = sous-titre, « - » = liste</label>
          <textarea rows={12} {...F('body')} />
        </div>
        <div className="field">
          <label>Produits liés (slugs, séparés par des virgules)</label>
          <input {...F('relatedSlugs')} placeholder="ponceuse-girafe, aspirateur-chantier" />
        </div>
        <div className="row" style={{ gap: 18 }}>
          <label className="row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={!!draft.featured}
              onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
            />
            <span className="small">À la une</span>
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={draft.published !== false}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            <span className="small">Publié</span>
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => save(false)}>
            Enregistrer
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => save(true)}>
            Enregistrer + retraduire NL/EN
          </button>
          {editing && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setDraft(EMPTY);
                setEditing(null);
              }}
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      <div className="card card-body">
        <h3>{guides.length} article(s)</h3>
        <table className="table">
          <tbody>
            {guides.map((g) => (
              <tr key={g.slug}>
                <td>
                  <strong>{g.title}</strong>
                  <div className="small muted">
                    {g.category} · {g.readMinutes} min · {g.published ? 'publié' : 'brouillon'}
                    {g.featured ? ' · à la une' : ''}
                    {g.i18n && Object.keys(g.i18n).length ? ' · NL/EN ✓' : ' · NL/EN ✗'}
                  </div>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => edit(g)}>
                    Modifier
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(g.slug)}>
                    ×
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
