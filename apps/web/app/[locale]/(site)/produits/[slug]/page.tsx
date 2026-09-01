import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { formatEUR } from '@bricoloc/shared';
import { api, ApiError } from '@/lib/api';
import type { ProductDetail, ProductSummary } from '@/lib/types';
import { ProductPurchasePanel } from '@/components/ProductPurchasePanel';
import { ProductCard } from '@/components/ProductCard';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  try {
    return await api<{ product: ProductDetail; similar: ProductSummary[] }>(
      `/api/catalog/products/${slug}`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: 'Produit introuvable' };
  return {
    title: data.product.name,
    description: data.product.shortDescription ?? data.product.description ?? undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { product, similar } = data;

  return (
    <div className="section container">
      <p className="small muted">
        <Link href="/catalogue">Catalogue</Link>
        {product.category && (
          <>
            {' / '}
            <Link href={`/catalogue?category=${product.category.slug}`}>
              {product.category.name}
            </Link>
          </>
        )}
        {' / '}
        {product.name}
      </p>

      <div className="two-col" style={{ marginTop: 12 }}>
        <div className="stack">
          <div className="card" style={{ overflow: 'hidden' }}>
            <img
              src={product.image || PLACEHOLDER_IMG}
              alt={product.name}
              style={{ width: '100%' }}
            />
          </div>
          <h1>{product.name}</h1>
          {product.description && <p>{product.description}</p>}

          {product.recommendedUses.length > 0 && (
            <div className="card card-body">
              <h3>Utilisations conseillées</h3>
              <ul>
                {product.recommendedUses.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(product.specs).length > 0 && (
            <div className="card card-body">
              <h3>Caractéristiques</h3>
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
            </div>
          )}

          {product.includedAccessories.length > 0 && (
            <div className="card card-body">
              <h3>Accessoires inclus</h3>
              <ul>
                {product.includedAccessories.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {product.packItems.length > 0 && (
            <div className="card card-body">
              <h3>Contenu du pack</h3>
              <ul>
                {product.packItems.map((p) => (
                  <li key={p.id}>
                    {p.quantity} × <Link href={`/produits/${p.slug}`}>{p.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {product.complementary.length > 0 && (
            <div className="card card-body">
              <h3>Machines complémentaires</h3>
              <div className="grid grid-cards">
                {product.complementary.map((c) => (
                  <div key={c.id} className="card card-body">
                    <Link href={`/produits/${c.slug}`}>{c.name}</Link>
                    <div className="small muted">{formatEUR(c.dailyPrice)} / jour</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card card-body">
            <h3>Mode d&apos;emploi &amp; documents</h3>
            <p className="small muted">
              {product.manualUrl ? (
                <a href={product.manualUrl}>Notice d&apos;utilisation (PDF démo)</a>
              ) : (
                'Notice remise au comptoir. Documents fournis selon le matériel (démo).'
              )}
            </p>
            {product.documents.map((d) => (
              <p key={d.url} className="small">
                <a href={d.url}>{d.label}</a>
              </p>
            ))}
          </div>
        </div>

        <ProductPurchasePanel product={product} />
      </div>

      {similar.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h2>Produits similaires</h2>
          <div className="grid grid-cards">
            {similar.map((s) => (
              <ProductCard key={s.id} p={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
