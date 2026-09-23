import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { formatEUR } from '@bricoloc/shared';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import type { ProductDetail, ProductSummary } from '@/lib/types';
import { ProductPurchasePanel } from '@/components/ProductPurchasePanel';
import { ProductPriceHead } from '@/components/ProductPriceHead';
import { Price } from '@/components/Price';
import { ProductCard } from '@/components/ProductCard';
import { ProductGallery } from '@/components/ProductGallery';
import { AccessoryCard } from '@/components/AccessoryCard';
import { ReviewSection } from '@/components/ReviewSection';
import { StarRating } from '@/components/StarRating';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';

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
  // Un BricoPack : sa fiche de présentation est /bricopacks/<slug>.
  if (product.kind === 'PACK') redirect({ href: `/bricopacks/${slug}`, locale });
  const t = await getTranslations('product');
  const isLoiselet = product.supplier === 'LOISELET';

  // Accessoires / EPI louables d'un côté, consommables (achat à l'unité) de l'autre —
  // section 100% facultative, jamais mêlée à l'outil principal.
  const accessories = [...product.recommendedAccessories, ...product.ppe];
  // Uniquement les consommables réellement mis en vente (prix client renseigné).
  const consumables = product.consumables.filter((c) => c.dailyPrice > 0);
  const specsEntries = Object.entries(product.specs);
  const hasDocs = !!product.manualUrl || product.documents.length > 0;
  const hasEssential =
    product.recommendedUses.length > 0 ||
    specsEntries.length > 0 ||
    product.includedAccessories.length > 0 ||
    hasDocs;
  const hasExtra = !!product.description || product.packItems.length > 0;

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
    <div className="section container pdetail-page">
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
          <ProductGallery images={product.images} alt={product.name} tag={product.category?.name} />
        </div>

        <div className="pdetail__head">
          {(product.category?.name || product.brand) && (
            <span className="eyebrow">{product.category?.name ?? product.brand}</span>
          )}
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

          <ProductPriceHead product={product} />
          {product.deposit > 0 && (
            <p className="small muted">
              {t('deposit')} : <strong>{formatEUR(product.deposit)}</strong> — {t('depositHint')}
            </p>
          )}
        </div>

        <div className="pdetail__buy">
          <ProductPurchasePanel product={product} />
        </div>
      </div>

      {hasExtra && (
        <div className="pdetail-extra">
          {product.description && <p className="measure">{product.description}</p>}
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
        </div>
      )}

      {/* Ancre de repli pour « Continuer mes achats » même si l'outil n'a ni
          accessoire ni consommable associé. */}
      <div id="accessoires" />

      {accessories.length > 0 && (
        <section className="complete reveal">
          <span className="eyebrow">{t('completeKicker')}</span>
          <h2>{t('complete')}</h2>
          <p className="muted">{t('completeHint')}</p>
          <ul className="complete__grid">
            {accessories.map((a) => (
              <AccessoryCard key={a.id} item={a} />
            ))}
          </ul>
        </section>
      )}

      {consumables.length > 0 && (
        <section className="complete reveal">
          <span className="eyebrow">{t('consumablesKicker')}</span>
          <h2>{t('consumables')}</h2>
          <p className="muted">{t('consumablesHint')}</p>
          <ul className="complete__grid">
            {consumables.map((c) => (
              <AccessoryCard key={c.id} item={c} />
            ))}
          </ul>
        </section>
      )}

      {hasEssential && (
        <section className="pessential reveal">
          <span className="eyebrow">{t('essentialKicker')}</span>
          <h2>{t('essentialTitle')}</h2>
          <p className="muted measure">{t('essentialHint')}</p>
          <div className="pessential__grid">
            {product.recommendedUses.length > 0 && (
              <article className="pessential__card">
                <h3>{t('recommendedUses')}</h3>
                <ul>
                  {product.recommendedUses.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </article>
            )}
            {specsEntries.length > 0 && (
              <article className="pessential__card">
                <h3>{t('specs')}</h3>
                <dl className="pessential__specs">
                  {specsEntries.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            )}
            {product.includedAccessories.length > 0 && (
              <article className="pessential__card">
                <h3>{t('included')}</h3>
                <ul>
                  {product.includedAccessories.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </article>
            )}
            {hasDocs && (
              <article className="pessential__card">
                <h3>{t('documents')}</h3>
                <p className="small muted">
                  {product.manualUrl ? <a href={product.manualUrl}>{t('manual')}</a> : t('noManual')}
                </p>
                {product.documents.map((d) => (
                  <p key={d.url} className="small">
                    <a href={d.url}>{d.label}</a>
                  </p>
                ))}
              </article>
            )}
          </div>
        </section>
      )}

      {product.complementary.length > 0 && (
        <section className="section reveal">
          <span className="eyebrow">{t('similarKicker')}</span>
          <h2>{t('similar')}</h2>
          <div className="grid grid-cards carousel">
            {product.complementary.map((c) => (
              <article key={c.id} className="pcard">
                <Link href={`/produits/${c.slug}`} className="pcard__media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image || PLACEHOLDER_IMG} alt={c.name} loading="lazy" />
                  {c.brand ? <span className="pcard__brand">{c.brand}</span> : null}
                </Link>
                <div className="pcard__body">
                  <h3 className="pcard__name">
                    <Link href={`/produits/${c.slug}`}>{c.name}</Link>
                  </h3>
                  <div className="pcard__price">
                    <Price amountHT={c.dailyPrice} />
                    <small>{c.isConsumable ? t('perUnit') : ` ${t('perDay')}`}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="section reveal">
          <span className="eyebrow">{t('similarKicker')}</span>
          <h2>{t('similar')}</h2>
          <div className="grid grid-cards carousel">
            {similar.map((s) => (
              <ProductCard key={s.id} p={s} />
            ))}
          </div>
        </section>
      )}

      {/* Avis tout en bas : ils ne doivent pas masquer les produits complémentaires. */}
      <ReviewSection slug={product.slug} />
    </div>
  );
}
