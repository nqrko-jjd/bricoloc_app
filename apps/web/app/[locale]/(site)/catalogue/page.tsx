'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Category, ProductSummary } from '@/lib/types';
import { useCart } from '@/lib/providers';
import { ProductCard } from '@/components/ProductCard';

function CatalogueInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { cart } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const kind = params.get('kind') ?? '';
  const sort = params.get('sort') ?? 'name';
  const onlyAvailable = params.get('onlyAvailable') === 'true';
  const page = Number(params.get('page') ?? '1');

  useEffect(() => {
    api<{ categories: Category[] }>('/api/catalog/categories').then((r) =>
      setCategories(r.categories),
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (category) sp.set('category', category);
    if (kind) sp.set('kind', kind);
    sp.set('sort', sort);
    sp.set('page', String(page));
    sp.set('pageSize', '18');
    if (cart?.period) {
      sp.set('start', cart.period.start);
      sp.set('end', cart.period.end);
      if (onlyAvailable) sp.set('onlyAvailable', 'true');
    }
    api<{ products: ProductSummary[]; total: number }>(`/api/catalog/products?${sp}`)
      .then((r) => {
        setProducts(r.products);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  }, [q, category, kind, sort, page, onlyAvailable, cart?.period]);

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete('page');
    router.push(`/catalogue?${sp}`);
  }

  return (
    <div className="section container">
      <h1>Catalogue</h1>
      <p className="muted">
        {cart?.period
          ? 'Disponibilités et prix calculés pour la période choisie.'
          : 'Parcourez librement. Vous indiquerez vos dates avant de valider le panier.'}
      </p>

      <div className="card card-body" style={{ margin: '18px 0' }}>
        <div className="filters">
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>Recherche</label>
            <input
              defaultValue={q}
              placeholder="marteau, ponceuse, nettoyeur…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') update({ q: (e.target as HTMLInputElement).value });
              }}
            />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={kind} onChange={(e) => update({ kind: e.target.value })}>
              <option value="">Tous</option>
              <option value="MACHINE">Machines</option>
              <option value="PACK">Packs</option>
              <option value="ACCESSORY">Accessoires</option>
              <option value="CONSUMABLE">Consommables</option>
              <option value="PPE">Protections</option>
            </select>
          </div>
          <div className="field">
            <label>Tri</label>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="name">Nom</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>
          {cart?.period && (
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => update({ onlyAvailable: e.target.checked ? 'true' : null })}
              />
              <span className="small">Uniquement disponibles</span>
            </label>
          )}
        </div>
        <div className="chips" style={{ marginTop: 14 }}>
          <button
            className={`chip${!category ? ' active' : ''}`}
            onClick={() => update({ category: null })}
          >
            Toutes catégories
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              className={`chip${category === c.slug ? ' active' : ''}`}
              onClick={() => update({ category: c.slug })}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="loading-dark">
          <span className="spinner" /> Chargement…
        </p>
      ) : products.length === 0 ? (
        <div className="alert alert-info">
          Aucun article ne correspond{cart?.period ? ' sur cette période' : ''}.
        </div>
      ) : (
        <>
          <p className="small muted">{total} article(s)</p>
          <div className="grid grid-cards">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CataloguePage() {
  return (
    <Suspense fallback={<div className="section container">Chargement…</div>}>
      <CatalogueInner />
    </Suspense>
  );
}
