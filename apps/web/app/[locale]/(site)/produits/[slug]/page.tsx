import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { formatEUR } from '@bricoloc/shared';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { ProductDetail, ProductSummary } from '@/lib/types';
import { ProductPurchasePanel } from '@/components/ProductPurchasePanel';
import { ProductCard } from '@/components/ProductCard';
import { ProductGallery } from '@/components/ProductGallery';
import { ReviewSection } from '@/components/ReviewSection';
import { StarRating } from '@/components/StarRating';
import { AddToCartButton } from '@/components/AddToCartButton';

export const dynamic = 'force-dynamic';

async function load(slug: string, locale: string) {
  try {
    return await api<{ product: ProductDetail; similar: ProductSummary[] }>(
      `/api/catalog/products/${slug}?locale=${locale}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const data = await load(slug, locale);
  if (!data) return { title: 'Produit introuvable' };
  const p = data.product;
  return {
    title: p.seo?.title || p.name,
    description: p.seo?.description || p.shortDescription || p.description || undefined,
    openGraph: {
      title: p.name,
      description: p.shortDescription ?? undefined,
      images: p.image ? [p.image] : undefined,
      type: 'website',
    },
  };
}

function priceTiers(p: ProductDetail) {
  return [
    { key: 'priceDay', total: p.dailyPrice, unit: 1 },
    { key: 'priceWeek', total: p.weekPrice ?? p.dailyPrice * 4, unit: 7 },
    { key: 'priceMonth', total: p.monthPrice ?? p.dailyPrice * 12, unit: 30 },
  ];
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const data = await load(slug, locale);
  if (!data) notFound();
  const { product, similar } = data;
  const t = await getTranslations('product');
  const isLoiselet = product.supplier === 'LOISELET';

  const allLinked = [...product.recommendedAccessories, ...product.consumables, ...product.ppe];
  // « pièces » = consommables/accessoires à acheter (réf. fournisseur) ; « accessoires » = louables.
  const parts = allLinked.filter((a) => a.supplierRef || a.partSupplier);
  const accessories = allLinked.filter((a) => !a.supplierRef && !a.partSupplier);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
    image: product.images,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    ...(product.rating && product.rating.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating.avg,
            reviewCount: product.rating.count,
          },
        }
      : {}),
    offers: {
      '@type': 'Offer',
      price: product.dailyPrice,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <div className="section container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="breadcrumb small muted">
        <Link href="/catalogue">{t('breadcrumbCatalogue')}</Link>
        {product.category && (
          <>
            {' / '}
            <Link href={`/catalogue?category=${product.category.slug}`}>
              {product.category.name}
            </Link>
          </>
        )}
        {' / '}
        <span>{product.name}</span>
      </nav>

      <div className="pdetail">
        <div className="pdetail__media">
          <ProductGallery images={product.images} alt={product.name} />
        </div>

        <div className="pdetail__head">
          {product.brand && <span className="eyebrow">{product.brand}</span>}
          <h1>{product.name}</h1>
          {product.rating && product.rating.count > 0 && (
            <a href="#avis" className="pdetail__rating">
              <StarRating value={product.rating.avg} />
              <span className="small muted">
                {product.rating.avg.toFixed(1)} · {t('basedOn', { count: product.rating.count })}
              </span>
            </a>
          )}
          {isLoiselet && (
            <p className="pdetail__partner">
              <span className="badge">{t('partnerBadge')}</span> {t('onRequest')}
              {product.deliveryPolicy === 'QUOTE_ONLY' && <> · {t('quoteOnly')}</>}
            </p>
          )}
          {product.shortDescription && <p className="pdetail__lead">{product.shortDescription}</p>}

          <div className="ptiers">
            {priceTiers(product).map((tier) => (
              <div key={tier.key} className="ptier">
                <span className="ptier__label">{t(tier.key)}</span>
                <span className="ptier__price">{formatEUR(tier.total)}</span>
                <span className="ptier__vat small muted">{t('vatExcl')}</span>
              </div>
            ))}
          </div>
          {product.deposit > 0 && (
            <p className="small muted">
              {t('deposit')} : <strong>{formatEUR(product.deposit)}</strong> — {t('depositHint')}
            </p>
          )}
        </div>

        <div className="pdetail__buy">
          <ProductPurchasePanel product={product} />
        </div>

        <div className="pdetail__body">
          {product.description && <p className="measure">{product.description}</p>}

          {product.recommendedUses.length > 0 && (
            <details className="pacc" open>
              <summary>{t('recommendedUses')}</summary>
              <ul>
                {product.recommendedUses.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </details>
          )}

          {Object.keys(product.specs).length > 0 && (
            <details className="pacc" open>
              <summary>{t('specs')}</summary>
              <table className="table">
                <tbody>
                  {Object.entries(product.specs).map(([k, v]) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          {product.includedAccessories.length > 0 && (
            <details className="pacc">
              <summary>{t('included')}</summary>
              <ul>
                {product.includedAccessories.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
          )}

          {product.packItems.length > 0 && (
            <details className="pacc" open>
              <summary>{t('packContent')}</summary>
              <ul>
                {product.packItems.map((pi) => (
                  <li key={pi.id}>
                    {pi.quantity} × <Link href={`/produits/${pi.slug}`}>{pi.name}</Link>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <details className="pacc">
            <summary>{t('documents')}</summary>
            <p className="small muted">
              {product.manualUrl ? (
                <a href={product.manualUrl}>{t('manual')}</a>
              ) : (
                t('noManual')
              )}
            </p>
            {product.documents.map((d) => (
              <p key={d.url} className="small">
                <a href={d.url}>{d.label}</a>
              </p>
            ))}
          </details>
        </div>
      </div>

      {accessories.length > 0 && (
        <section className="complete">
          <h2>{t('complete')}</h2>
          <p className="muted">{t('completeHint')}</p>
          <ul className="complete__grid">
            {accessories.map((a) => (
              <li key={a.id} className="card card-body">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.image && <img src={a.image} alt="" className="complete__img" loading="lazy" />}
                <div>
                  <Link href={`/produits/${a.slug}`}>{a.name}</Link>
                  <div className="small muted">
                    {formatEUR(a.dailyPrice)}
                    {a.isConsumable ? '' : ` ${t('perDay')}`}
                  </div>
                </div>
                <AddToCartButton productId={a.id} small />
              </li>
            ))}
          </ul>
        </section>
      )}

      {parts.length > 0 && (
        <section className="complete">
          <h2>{t('partsTitle')}</h2>
          <p className="muted">{t('partsHint')}</p>
          <ul className="parts-list">
            {parts.map((p) => (
              <li key={p.id} className="parts-list__item">
                <div className="parts-list__main">
                  <span className="parts-list__name">
                    {p.brand && <strong>{p.brand} · </strong>}
                    {p.name}
                  </span>
                  {p.shortDescription && (
                    <span className="small muted">{p.shortDescription}</span>
                  )}
                  <span className="small muted">
                    {p.supplierRef && <>{t('partsRef')} {p.supplierRef}</>}
                    {p.supplierListPrice != null && (
                      <> · {t('partsPrice')} {formatEUR(p.supplierListPrice)}</>
                    )}
                  </span>
                </div>
                {p.supplierUrl ? (
                  <a
                    className="btn btn-outline btn-sm"
                    href={p.supplierUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {p.partSupplier ? t('partsBuyAt', { shop: p.partSupplier }) : t('addAccessory')}
                  </a>
                ) : (
                  p.partSupplier && (
                    <span className="tag">{t('partsBuyAt', { shop: p.partSupplier })}</span>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReviewSection slug={product.slug} />

      {product.complementary.length > 0 && (
        <section className="section">
          <h2>{t('similar')}</h2>
          <div className="grid grid-cards carousel">
            {product.complementary.map((c) => (
              <div key={c.id} className="card card-body">
                <Link href={`/produits/${c.slug}`}>{c.name}</Link>
                <div className="small muted">
                  {formatEUR(c.dailyPrice)} {t('perDay')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="section">
          <h2>{t('similar')}</h2>
          <div className="grid grid-cards carousel">
            {similar.map((s) => (
              <ProductCard key={s.id} p={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
