import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Category, ProductSummary } from '@/lib/types';
import { HomeDatePicker } from '@/components/HomeDatePicker';
import { ProductCard } from '@/components/ProductCard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [{ categories }, { products }] = await Promise.all([
    api<{ categories: Category[] }>('/api/catalog/categories'),
    api<{ products: ProductSummary[] }>('/api/catalog/products?pageSize=8&sort=name'),
  ]);

  return (
    <>
      <section className="hero">
        <div className="container two-col" style={{ alignItems: 'center' }}>
          <div className="stack">
            <span className="kicker">C&apos;est BRICOLOC</span>
            <h1>Le bon outil. Au bon moment.</h1>
            <p>
              Louez des machines et de l&apos;outillage professionnel, contrôlé et entretenu.
              Réservation en ligne 24h/24, retrait rapide en Click &amp; Collect ou livraison
              sur chantier.
            </p>
            <div className="row">
              <Link href="/catalogue" className="btn btn-primary btn-lg">
                Parcourir le catalogue
              </Link>
              <Link href="/pro" className="btn btn-outline btn-lg" style={{ color: '#fff', borderColor: '#fff' }}>
                Je suis un pro
              </Link>
            </div>
          </div>
          <HomeDatePicker />
        </div>
      </section>

      <section className="section container">
        <h2>Nos catégories</h2>
        <div className="chips" style={{ marginTop: 16 }}>
          {categories.map((c) => (
            <Link key={c.slug} href={`/catalogue?category=${c.slug}`} className="chip">
              {c.name} {c.productCount ? `(${c.productCount})` : ''}
            </Link>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="spread">
          <h2>Machines populaires</h2>
          <Link href="/catalogue" className="btn btn-ghost btn-sm">
            Tout voir
          </Link>
        </div>
        <div className="grid grid-cards" style={{ marginTop: 16 }}>
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <section className="section" style={{ background: 'var(--white)' }}>
        <div className="container grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          {[
            ['📅', 'Réservation 24h/24', 'Choisissez vos dates une seule fois pour toute la commande.'],
            ['⚡', 'Prêt en 2 heures', 'Selon disponibilité, votre matériel est préparé rapidement.'],
            ['🚚', 'Livraison chantier', 'À domicile ou sur chantier dans la zone desservie.'],
            ['🛠️', 'Matériel contrôlé', 'Chaque exemplaire est suivi, entretenu et vérifié.'],
          ].map(([icon, title, text]) => (
            <div key={title} className="stack">
              <div style={{ fontSize: '2rem' }}>{icon}</div>
              <h3>{title}</h3>
              <p className="muted small">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
