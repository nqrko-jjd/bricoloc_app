'use client';
import { useEffect, useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import type { ProductDetail, Category } from '@/lib/types';

const EMPTY = {
  slug: '',
  name: '',
  kind: 'MACHINE',
  categorySlug: 'percage-demolition',
  shortDescription: '',
  description: '',
  recommendedUses: '',
  dailyPrice: '30',
  weekendPrice: '',
  weekPrice: '',
  monthPrice: '',
  tiers: '',
  deposit: '200',
  stockQty: '',
  published: true,
  images: [] as string[],
  // Internes
  partSupplier: '',
  supplierRef: '',
  supplierUrl: '',
  supplierListPrice: '',
  purchasePrice: '',
};

export default function AdminProduits() {
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('');

  async function load() {
    const [p, c] = await Promise.all([
      staffApi<{ products: ProductDetail[] }>('/api/admin/products'),
      staffApi<{ categories: Category[] }>('/api/admin/categories'),
    ]);
    setProducts(p.products);
    setCategories(c.categories);
  }
  useEffect(() => {
    load();
  }, []);

  const set = (k: string, v: unknown) => setForm((s) => ({ ...s, [k]: v }));

  function edit(p: ProductDetail) {
    setEditing(p.slug);
    setForm({
      slug: p.slug,
      name: p.name,
      kind: p.kind,
      categorySlug: p.category?.slug ?? '',
      shortDescription: p.shortDescription ?? '',
      description: p.description ?? '',
      recommendedUses: p.recommendedUses.join('\n'),
      dailyPrice: String(p.dailyPrice),
      weekendPrice: p.weekendPrice != null ? String(p.weekendPrice) : '',
      weekPrice: p.weekPrice != null ? String(p.weekPrice) : '',
      monthPrice: p.monthPrice != null ? String(p.monthPrice) : '',
      tiers: p.tiers.length ? JSON.stringify(p.tiers) : '',
      deposit: String(p.deposit),
      stockQty: p.stockQty != null ? String(p.stockQty) : '',
      published: p.isDemo ? true : true,
      images: p.images,
      partSupplier: p.partSupplier ?? '',
      supplierRef: p.supplierRef ?? '',
      supplierUrl: p.supplierUrl ?? '',
      supplierListPrice: p.supplierListPrice != null ? String(p.supplierListPrice) : '',
      purchasePrice: p.purchasePrice != null ? String(p.purchasePrice) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      const body = {
        slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: form.name,
        kind: form.kind,
        categorySlug: form.categorySlug || undefined,
        shortDescription: form.shortDescription || undefined,
        description: form.description || undefined,
        recommendedUses: form.recommendedUses
          ? form.recommendedUses.split('\n').filter(Boolean)
          : [],
        dailyPrice: Number(form.dailyPrice),
        weekendPrice: form.weekendPrice ? Number(form.weekendPrice) : null,
        weekPrice: form.weekPrice ? Number(form.weekPrice) : null,
        monthPrice: form.monthPrice ? Number(form.monthPrice) : null,
        tiers: form.tiers ? JSON.parse(form.tiers) : [],
        deposit: Number(form.deposit),
        published: form.published,
        images: form.images,
        stockQty: form.stockQty ? Number(form.stockQty) : null,
        partSupplier: form.partSupplier || null,
        supplierRef: form.supplierRef || null,
        supplierUrl: form.supplierUrl || null,
        supplierListPrice: form.supplierListPrice ? Number(form.supplierListPrice) : null,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
      };
      await staffApi('/api/admin/products', { method: 'POST', body });
      setMsg(editing ? 'Produit mis à jour.' : 'Produit créé et publié au catalogue.');
      setForm(EMPTY);
      setEditing(null);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  const shown = products.filter(
    (p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="stack">
      <h1>Catalogue &amp; produits</h1>

      <form className="card card-pad stack" onSubmit={submit}>
        <div className="spread">
          <h3>{editing ? `Modifier : ${editing}` : 'Nouveau produit'}</h3>
          {editing && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
            >
              Annuler
            </button>
          )}
        </div>
        {msg && <div className="alert alert-info">{msg}</div>}
        <div className="field-2">
          <div className="field">
            <label>Nom</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="field">
            <label>Slug (URL)</label>
            <input
              value={form.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="auto depuis le nom"
              disabled={!!editing}
            />
          </div>
        </div>
        <div className="field-2">
          <div className="field">
            <label>Type</label>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              <option value="MACHINE">Machine</option>
              <option value="PACK">Pack</option>
              <option value="ACCESSORY">Accessoire</option>
              <option value="CONSUMABLE">Consommable</option>
              <option value="PPE">Protection</option>
            </select>
          </div>
          <div className="field">
            <label>Catégorie</label>
            <select
              value={form.categorySlug}
              onChange={(e) => set('categorySlug', e.target.value)}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Description courte</label>
          <input
            value={form.shortDescription}
            onChange={(e) => set('shortDescription', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Utilisations conseillées (une par ligne)</label>
          <textarea
            rows={2}
            value={form.recommendedUses}
            onChange={(e) => set('recommendedUses', e.target.value)}
          />
        </div>
        <div className="field-2">
          <div className="field">
            <label>Prix jour (HTVA) {form.kind === 'CONSUMABLE' && '= prix unitaire'}</label>
            <input
              type="number"
              step="0.01"
              value={form.dailyPrice}
              onChange={(e) => set('dailyPrice', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Caution</label>
            <input
              type="number"
              step="0.01"
              value={form.deposit}
              onChange={(e) => set('deposit', e.target.value)}
            />
            {form.kind === 'PACK' && (
              <span className="small muted">
                Éditable. Par défaut = somme des cautions des machines du pack.
              </span>
            )}
          </div>
        </div>
        <div className="field-2">
          <div className="field">
            <label>Prix week-end</label>
            <input
              type="number"
              step="0.01"
              value={form.weekendPrice}
              onChange={(e) => set('weekendPrice', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Prix semaine (7 j)</label>
            <input
              type="number"
              step="0.01"
              value={form.weekPrice}
              onChange={(e) => set('weekPrice', e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label>Tarifs dégressifs (JSON : [{'{'}"minDays":1,"perDay":30{'}'}, …])</label>
          <input
            value={form.tiers}
            onChange={(e) => set('tiers', e.target.value)}
            placeholder='[{"minDays":1,"perDay":30},{"minDays":4,"perDay":24}]'
          />
        </div>
        <div className="field">
          <label>Images (glisser-déposer, la 1re est la principale)</label>
          <ImageDropzone value={form.images} onChange={(v) => set('images', v)} />
        </div>

        <fieldset className="card card-body" style={{ margin: 0 }}>
          <legend className="small" style={{ fontWeight: 700 }}>
            Interne — approvisionnement (jamais affiché au client)
          </legend>
          {(form.kind === 'CONSUMABLE' || form.kind === 'ACCESSORY' || form.kind === 'PPE') && (
            <div className="field-2">
              <div className="field">
                <label>Quantité en stock</label>
                <input
                  type="number"
                  value={form.stockQty}
                  onChange={(e) => set('stockQty', e.target.value)}
                  placeholder="ex. 40"
                />
              </div>
              <div className="field">
                <label>Revendeur</label>
                <input
                  value={form.partSupplier}
                  onChange={(e) => set('partSupplier', e.target.value)}
                  placeholder="Cipac, Lecot, Sanimat…"
                />
              </div>
            </div>
          )}
          <div className="field-2">
            <div className="field">
              <label>Référence fournisseur</label>
              <input
                value={form.supplierRef}
                onChange={(e) => set('supplierRef', e.target.value)}
                placeholder="ex. 2608900912"
              />
            </div>
            <div className="field">
              <label>Lien fiche fournisseur</label>
              <input
                value={form.supplierUrl}
                onChange={(e) => set('supplierUrl', e.target.value)}
                placeholder="https://www.cipac.be/…"
              />
            </div>
          </div>
          <div className="field-2">
            <div className="field">
              <label>Prix d&apos;achat / catalogue fournisseur (HTVA)</label>
              <input
                type="number"
                step="0.01"
                value={form.supplierListPrice}
                onChange={(e) => set('supplierListPrice', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Prix d&apos;achat réel négocié (HTVA)</label>
              <input
                type="number"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => set('purchasePrice', e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <label className="row" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => set('published', e.target.checked)}
          />
          <span className="small">Publié (visible sur le site, l&apos;appli et la borne)</span>
        </label>
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          {editing ? 'Enregistrer' : 'Créer le produit'}
        </button>
      </form>

      <div className="card card-body">
        <input
          placeholder="Filtrer…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Catégorie</th>
                <th>Prix/j</th>
                <th>Caution</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <span className="badge">{p.kind}</span>
                  </td>
                  <td>{p.category?.name ?? '—'}</td>
                  <td>{formatEUR(p.dailyPrice)}</td>
                  <td>{formatEUR(p.deposit)}</td>
                  <td>{p.totalStock}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => edit(p)}>
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
