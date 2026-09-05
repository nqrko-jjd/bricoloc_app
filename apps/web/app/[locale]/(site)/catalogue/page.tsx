'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Category, ProductSummary } from '@/lib/types';
import { useCart } from '@/lib/providers';
import { useRouter } from '@/i18n/navigation';
import { ProductCard } from '@/components/ProductCard';
import { PageHeader } from '@/components/PageHeader';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';

function CatalogueInner() {
  const params = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('catalogue');
  const { cart } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 24;

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  // Par défaut on ne montre que les machines : accessoires/consommables/EPI
  // servent à compléter une location, pas à parcourir seuls.
  const kind = params.get('kind') ?? 'MACHINE';
  const sort = params.get('sort') ?? 'name';
  const onlyAvailable = params.get('onlyAvailable') === 'true';
  const periodStart = cart?.period?.start ?? '';
  const periodEnd = cart?.period?.end ?? '';

  useEffect(() => {
    api<{ categories: Category[] }>(`/api/catalog/categories?locale=${locale}`).then((r) =>
      setCategories(r.categories),
    );
  }, [locale]);

  // Tout changement de filtre remet la pagination à zéro.
  useEffect(() => {
    setPage(1);
  }, [q, category, kind, sort, onlyAvailable, periodStart, periodEnd, locale]);

  useEffect(() => {
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (category) sp.set('category', category);
    if (kind && kind !== 'ALL') sp.set('kind', kind);
    sp.set('sort', sort);
    sp.set('locale', locale);
    sp.set('page', String(page));
    sp.set('pageSize', String(PAGE_SIZE));
    if (cart?.period) {
      sp.set('start', cart.period.start);
      sp.set('end', cart.period.end);
      if (onlyAvailable) sp.set('onlyAvailable', 'true');
    }
    let cancelled = false;
    api<{ products: ProductSummary[]; total: number }>(`/api/catalog/products?${sp}`)
      .then((r) => {
        if (cancelled) return;
        setProducts((prev) => (page === 1 ? r.products : [...prev, ...r.products]));
        setTotal(r.total);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingMore(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, category, kind, sort, page, onlyAvailable, periodStart, periodEnd, locale]);

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
    <>
      <PageHeader
        title={t('title')}
        titleAccent={t('titleAccent')}
        lead={cart?.period ? t('subtitleDated') : t('subtitle')}
      />
      <div className="container page-body">
      <div className="card card-body" style={{ marginBottom: '18px' }}>
        <div className="filters">
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>{t('search')}</label>
            <SearchAutocomplete
              key={q}
              variant="plain"
              placeholder={t('searchPlaceholder')}
              initial={q}
            />
          </div>
          <div className="field">
            <label>{t('type')}</label>
            <select value={kind} onChange={(e) => update({ kind: e.target.value })}>
              <option value="ALL">{t('typeAll')}</option>
              <option value="MACHINE">{t('typeMachine')}</option>
              <option value="ACCESSORY">{t('typeAccessory')}</option>
              <option value="CONSUMABLE">{t('typeConsumable')}</option>
              <option value="PPE">{t('typePpe')}</option>
            </select>
          </div>
          <div className="field">
            <label>{t('sort')}</label>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="name">{t('sortName')}</option>
              <option value="price_asc">{t('sortPriceAsc')}</option>
              <option value="price_desc">{t('sortPriceDesc')}</option>
            </select>
          </div>
          {cart?.period && (
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => update({ onlyAvailable: e.target.checked ? 'true' : null })}
              />
              <span className="small">{t('onlyAvailable')}</span>
            </label>
          )}
        </div>
        <div className="chips" style={{ marginTop: 14 }}>
          <button
            className={`chip${!category ? ' active' : ''}`}
            onClick={() => update({ category: null })}
          >
            {t('allCategories')}
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
          <span className="spinner" /> {t('loading')}
        </p>
      ) : products.length === 0 ? (
        <div className="alert alert-info">{t('empty')}</div>
      ) : (
        <>
          <p className="small muted">{t('count', { count: total })}</p>
          <div className="grid grid-cards">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          {products.length < total && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
              <button
                className="btn btn-outline"
                disabled={loadingMore}
                onClick={() => setPage((p) => p + 1)}
              >
                {loadingMore ? (
                  <>
                    <span className="spinner" /> {t('loading')}
                  </>
                ) : (
                  t('loadMore', { count: total - products.length })
                )}
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </>
  );
}

export default function CataloguePage() {
  return (
    <Suspense fallback={<div className="section container" />}>
      <CatalogueInner />
    </Suspense>
  );
}
