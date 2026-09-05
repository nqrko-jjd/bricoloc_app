'use client';
import { useEffect, useState } from 'react';
import { staffApi } from '@/lib/staff';
import { api } from '@/lib/api';
import { formatEUR } from '@bricoloc/shared';

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
  relatedSlugs: [] as string[],
  relatedCategorySlug: '',
  featured: false,
  published: true,
};

function RelatedProductsPicker({
  value,
  onChange,
  products,
}: {
  value: string[];
  onChange: (slugs: string[]) => void;
  products: { slug: string; name: string; dailyPrice: number; kind: string }[];
}) {
  const [q, setQ] = useState('');
  const machines = products.filter((p) => p.kind === 'MACHINE');
  const selected = value
    .map((slug) => machines.find((p) => p.slug === slug))
    .filter((p): p is (typeof machines)[number] => !!p);
  const options = machines.filter(
    (p) => !value.includes(p.slug) && p.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="field">
      <label>Machines mises en avant (choix manuel)</label>
      {selected.length > 0 && (
        <ul className="stack" style={{ gap: 6, margin: '0 0 8px', padding: 0, listStyle: 'none' }}>
          {selected.map((s) => (
            <li
              key={s.slug}
              className="row"
              style={{ alignItems: 'center', gap: 8, background: 'var(--surface-2)', borderRadius: 8, padding: '6px 10px' }}
            >
              <span style={{ flex: 1 }}>{s.name}</span>
              <span className="small muted">{formatEUR(s.dailyPrice)}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onChange(value.filter((slug) => slug !== s.slug))}
                aria-label={`Retirer ${s.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une machine…" />
      {q && (
        <ul
          className="stack"
          style={{ gap: 2, margin: '4px 0 0', padding: 0, listStyle: 'none', maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}
        >
          {options.length === 0 ? (
            <li className="small muted" style={{ padding: '6px 10px' }}>Aucun résultat.</li>
          ) : (
            options.slice(0, 20).map((o) => (
              <li key={o.slug}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => {
                    onChange([...value, o.slug]);
                    setQ('');
                  }}
                >
                  + {o.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function AdminConseils() {
  const [guides, setGuides] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [products, setProducts] = useState<{ slug: string; name: string; dailyPrice: number; kind: string }[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<{ slug: string; name: string }[]>([]);

  const load = () => staffApi<{ guides: any[] }>('/api/admin/guides').then((r) => setGuides(r.guides));
  useEffect(() => {
    load();
    staffApi<{ products: { slug: string; name: string; dailyPrice: number; kind: string }[] }>(
      '/api/admin/products',
    ).then((r) => setProducts(r.products));
    api<{ categories: { slug: string; name: string }[] }>('/api/catalog/categories?locale=fr').then((r) =>
      setCatalogCategories(r.categories.filter((c) => c.slug !== 'bricopack')),
    );
  }, []);

  function edit(g: any) {
    setEditing(g.slug);
    setDraft({
      ...g,
      relatedSlugs: Array.isArray(g.relatedSlugs) ? g.relatedSlugs : [],
      relatedCategorySlug: g.relatedCategorySlug ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(retranslate = false) {
    await staffApi('/api/admin/guides', {
      method: 'POST',
      body: {
        ...draft,
        readMinutes: Number(draft.readMinutes) || 5,
        relatedSlugs: Array.isArray(draft.relatedSlugs) ? draft.relatedSlugs : [],
        relatedCategorySlug: draft.relatedCategorySlug || null,
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
        <RelatedProductsPicker
          value={draft.relatedSlugs}
          onChange={(slugs) => setDraft({ ...draft, relatedSlugs: slugs })}
          products={products}
        />
        <div className="field">
          <label>Catégorie de repli (complète automatiquement jusqu'à 4 machines)</label>
          <p className="small muted" style={{ margin: '0 0 6px' }}>
            Si le choix manuel ci-dessus est vide ou incomplet, les meilleures machines de cette
            catégorie viennent compléter la liste — l'article n'affiche jamais une section vide.
          </p>
          <select {...F('relatedCategorySlug')}>
            <option value="">— Aucune —</option>
            {catalogCategories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
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
