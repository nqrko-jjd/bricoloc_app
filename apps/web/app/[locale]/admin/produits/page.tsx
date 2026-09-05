'use client';
import { Fragment, useEffect, useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { staffApi } from '@/lib/staff';
import { ImageDropzone } from '@/components/admin/ImageDropzone';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';
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
  isNew: false,
  images: [] as string[],
  // Complétez votre location (fiche produit + borne) : liens vers d'autres produits.
  recommendedAccessoryIds: [] as string[],
  consumableIds: [] as string[],
  ppeIds: [] as string[],
  complementaryProductIds: [] as string[],
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
  const [mergingSlug, setMergingSlug] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');

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
      published: p.published ?? true,
      isNew: p.isNew ?? false,
      images: p.images,
      recommendedAccessoryIds: p.recommendedAccessories.map((x) => x.id),
      consumableIds: p.consumables.map((x) => x.id),
      ppeIds: p.ppe.map((x) => x.id),
      complementaryProductIds: p.complementary.map((x) => x.id),
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
        isNew: form.isNew,
        images: form.images,
        recommendedAccessoryIds: form.recommendedAccessoryIds,
        consumableIds: form.consumableIds,
        ppeIds: form.ppeIds,
        complementaryProductIds: form.complementaryProductIds,
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

  async function remove(p: ProductDetail) {
    if (!confirm(`Supprimer définitivement « ${p.name} » ?`)) return;
    try {
      await staffApi(`/api/admin/products/${p.slug}`, { method: 'DELETE' });
      setMsg('Produit supprimé.');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function merge(dup: ProductDetail, targetSlug: string) {
    if (!targetSlug) return;
    const target = products.find((p) => p.slug === targetSlug);
    if (!confirm(`Fusionner « ${dup.name} » dans « ${target?.name ?? targetSlug} » ? Stock, réservations et avis seront réattribués, puis « ${dup.name} » sera supprimé.`)) return;
    try {
      await staffApi(`/api/admin/products/${dup.slug}/merge-into`, {
        method: 'POST',
        body: { targetSlug },
      });
      setMsg(`Fusionné dans « ${target?.name ?? targetSlug} ».`);
      setMergingSlug(null);
      setMergeTarget('');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  const shown = products
    .filter((p) => p.kind !== 'PACK')
    .filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));

  // Doublons possibles : même nom normalisé (casse/accents/espaces ignorés).
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const nameCounts = new Map<string, number>();
  for (const p of products) {
    if (p.kind === 'PACK') continue;
    const key = normalize(p.name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const isDuplicate = (p: ProductDetail) => (nameCounts.get(normalize(p.name)) ?? 0) > 1;

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
              <option value="ACCESSORY">Accessoire</option>
              <option value="CONSUMABLE">Consommable</option>
              <option value="PPE">Protection</option>
            </select>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              Les BricoPacks se gèrent depuis l&apos;onglet « BricoPacks ».
            </p>
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

        {form.kind === 'MACHINE' && (
          <fieldset className="card card-body" style={{ margin: 0 }}>
            <legend className="small" style={{ fontWeight: 700 }}>
              Complétez votre location — proposé sur la fiche produit, la borne et l&apos;appli
            </legend>
            <div className="stack" style={{ gap: 14 }}>
              <LinkPicker
                label="Accessoires nécessaires"
                hint="ex. rotabuse pour un nettoyeur haute pression"
                candidates={products.filter((p) => p.kind === 'ACCESSORY')}
                value={form.recommendedAccessoryIds}
                onChange={(v) => set('recommendedAccessoryIds', v)}
              />
              <LinkPicker
                label="Consommables"
                hint="ex. disques diamant pour une disqueuse, mèches SDS+ pour un perforateur"
                candidates={products.filter((p) => p.kind === 'CONSUMABLE')}
                value={form.consumableIds}
                onChange={(v) => set('consumableIds', v)}
              />
              <LinkPicker
                label="Équipements de protection (EPI)"
                hint="ex. masque, lunettes, gants"
                candidates={products.filter((p) => p.kind === 'PPE')}
                value={form.ppeIds}
                onChange={(v) => set('ppeIds', v)}
              />
              <LinkPicker
                label="Machines complémentaires"
                hint="ex. proposer un aspirateur avec une ponceuse"
                candidates={products.filter((p) => p.kind === 'MACHINE' && p.slug !== form.slug)}
                value={form.complementaryProductIds}
                onChange={(v) => set('complementaryProductIds', v)}
              />
            </div>
          </fieldset>
        )}

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
        {form.kind === 'MACHINE' && (
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={form.isNew}
              onChange={(e) => set('isNew', e.target.checked)}
            />
            <span className="small">Badge « Nouveauté » (accueil, catalogue)</span>
          </label>
        )}
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
                <th></th>
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
                <Fragment key={p.id}>
                  <tr>
                    <td>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.image || PLACEHOLDER_IMG}
                        alt=""
                        style={{ width: 36, height: 36, objectFit: 'contain', background: '#f4f4f8', borderRadius: 6 }}
                      />
                    </td>
                    <td>
                      {p.name}
                      {isDuplicate(p) && (
                        <span
                          className="badge badge-warn"
                          style={{ marginLeft: 8 }}
                          title="Un autre produit porte un nom quasi identique"
                        >
                          ⚠ doublon possible
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge">{p.kind}</span>
                    </td>
                    <td>{p.category?.name ?? '—'}</td>
                    <td>{formatEUR(p.dailyPrice)}</td>
                    <td>{formatEUR(p.deposit)}</td>
                    <td>{p.totalStock}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => edit(p)}>
                        Modifier
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setMergingSlug(mergingSlug === p.slug ? null : p.slug);
                          setMergeTarget('');
                        }}
                      >
                        Fusionner
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(p)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                  {mergingSlug === p.slug && (
                    <tr>
                      <td colSpan={8}>
                        <div className="row" style={{ gap: 8, alignItems: 'center', padding: '6px 0' }}>
                          <span className="small">Fusionner « {p.name} » dans :</span>
                          <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
                            <option value="">— Choisir le produit à garder —</option>
                            {products
                              .filter((o) => o.kind === p.kind && o.slug !== p.slug)
                              .map((o) => (
                                <option key={o.slug} value={o.slug}>
                                  {o.name}
                                </option>
                              ))}
                          </select>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={!mergeTarget}
                            onClick={() => merge(p, mergeTarget)}
                          >
                            Confirmer la fusion
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setMergingSlug(null)}>
                            Annuler
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Recherche + ajoute des produits liés (accessoires/consommables/EPI/machines). */
function LinkPicker({
  label,
  hint,
  candidates,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  candidates: ProductDetail[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const selected = value
    .map((id) => candidates.find((c) => c.id === id))
    .filter((c): c is ProductDetail => !!c);
  const options = candidates.filter(
    (c) => !value.includes(c.id) && c.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="field">
      <label>{label}</label>
      <p className="small muted" style={{ margin: '0 0 6px' }}>
        {hint}
      </p>
      {selected.length > 0 && (
        <ul className="stack" style={{ gap: 6, margin: '0 0 8px', padding: 0, listStyle: 'none' }}>
          {selected.map((s) => (
            <li
              key={s.id}
              className="row"
              style={{
                alignItems: 'center',
                gap: 8,
                background: 'var(--surface-2)',
                borderRadius: 8,
                padding: '6px 10px',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image || PLACEHOLDER_IMG}
                alt=""
                style={{ width: 28, height: 28, objectFit: 'contain', background: '#f4f4f8', borderRadius: 6, flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{s.name}</span>
              <span className="small muted">{formatEUR(s.dailyPrice)}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onChange(value.filter((id) => id !== s.id))}
                aria-label={`Retirer ${s.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row" style={{ gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit…"
          style={{ flex: 1 }}
        />
      </div>
      {q && (
        <ul
          className="stack"
          style={{
            gap: 2,
            margin: '4px 0 0',
            padding: 0,
            listStyle: 'none',
            maxHeight: 180,
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          {options.length === 0 ? (
            <li className="small muted" style={{ padding: '6px 10px' }}>
              Aucun résultat.
            </li>
          ) : (
            options.slice(0, 20).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}
                  onClick={() => {
                    onChange([...value, o.id]);
                    setQ('');
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={o.image || PLACEHOLDER_IMG}
                    alt=""
                    style={{ width: 24, height: 24, objectFit: 'contain', background: '#f4f4f8', borderRadius: 5, flexShrink: 0 }}
                  />
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
