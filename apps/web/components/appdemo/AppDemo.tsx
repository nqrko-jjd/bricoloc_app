'use client';
import { useEffect, useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { api } from '@/lib/api';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';
import type { Category, ProductDetail, ProductSummary } from '@/lib/types';
import {
  Home,
  Grid,
  CalendarClock,
  User,
  Search,
  Heart,
  ChevronLeft,
  CATEGORY_ICON,
  PackageIcon,
} from '@/components/icons';

type Pack = {
  slug: string;
  name: string;
  dailyPrice: number;
  toolCount?: number;
  image: string | null;
  popular?: boolean;
};

type Tab = 'home' | 'catalogue' | 'reservations' | 'profil';
type View =
  | { tab: 'home' }
  | { tab: 'catalogue'; category?: string }
  | { tab: 'product'; slug: string; from: 'home' | 'catalogue' }
  | { tab: 'reservations' }
  | { tab: 'profil' };

/** Démo navigable de l'appli mobile, dans un vrai navigateur — pour présenter
 * sans dépendre d'Expo Go / d'un téléphone. Données réelles du catalogue en
 * lecture ; « Ajouter au panier » / « Réserver » restent visuels (pas de
 * panier ni de compte réels engagés). */
export function AppDemo() {
  const [view, setView] = useState<View>({ tab: 'home' });
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  const activeTab: Tab = view.tab === 'product' ? (view.from === 'catalogue' ? 'catalogue' : 'home') : view.tab;

  return (
    <div className="appdemo-page">
      <a href="/" className="appdemo-exit">
        ← Quitter la démo
      </a>
      <div className="appdemo-screen">
        <div className="appdemo-scroll">
          {view.tab === 'home' && (
            <HomeScreen
              onOpenCatalogue={(category) => setView({ tab: 'catalogue', category })}
              onOpenProduct={(slug) => setView({ tab: 'product', slug, from: 'home' })}
            />
          )}
          {view.tab === 'catalogue' && (
            <CatalogueScreen
              initialCategory={view.category}
              onOpenProduct={(slug) => setView({ tab: 'product', slug, from: 'catalogue' })}
            />
          )}
          {view.tab === 'product' && (
            <ProductScreen
              slug={view.slug}
              onBack={() => setView({ tab: view.from })}
              onOpenProduct={(slug) => setView({ tab: 'product', slug, from: view.from })}
              onAdd={() => showToast('Ajouté au panier')}
              onReserve={() => showToast('Réservation — démo uniquement')}
            />
          )}
          {view.tab === 'reservations' && <ReservationsScreen />}
          {view.tab === 'profil' && <ProfilScreen />}
        </div>

        {toast && <div className="appdemo-toast">{toast}</div>}

        <nav className="appdemo-tabbar">
          <button
            type="button"
            className={`appdemo-tab${activeTab === 'home' ? ' is-active' : ''}`}
            onClick={() => setView({ tab: 'home' })}
          >
            <Home />
            Accueil
          </button>
          <button
            type="button"
            className={`appdemo-tab${activeTab === 'catalogue' ? ' is-active' : ''}`}
            onClick={() => setView({ tab: 'catalogue' })}
          >
            <Grid />
            Catalogue
          </button>
          <button
            type="button"
            className={`appdemo-tab${activeTab === 'reservations' ? ' is-active' : ''}`}
            onClick={() => setView({ tab: 'reservations' })}
          >
            <CalendarClock />
            Réservations
          </button>
          <button
            type="button"
            className={`appdemo-tab${activeTab === 'profil' ? ' is-active' : ''}`}
            onClick={() => setView({ tab: 'profil' })}
          >
            <User />
            Profil
          </button>
        </nav>
      </div>
    </div>
  );
}

function HomeScreen({
  onOpenCatalogue,
  onOpenProduct,
}: {
  onOpenCatalogue: (category?: string) => void;
  onOpenProduct: (slug: string) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [popular, setPopular] = useState<ProductSummary[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);

  useEffect(() => {
    api<{ categories: Category[] }>('/api/catalog/categories?locale=fr').then((r) =>
      setCategories(r.categories.filter((c) => c.slug !== 'bricopack')),
    );
    api<{ products: ProductSummary[] }>('/api/catalog/products?pageSize=6&sort=name&kind=MACHINE&locale=fr').then(
      (r) => setPopular((r.products ?? []).slice(0, 4)),
    );
    api<{ packs: Pack[] }>('/api/public/bricopacks?locale=fr')
      .then((r) => setPacks([...(r.packs ?? [])].sort((a, b) => Number(!!b.popular) - Number(!!a.popular)).slice(0, 8)))
      .catch(() => setPacks([]));
  }, []);

  return (
    <>
      <div className="appdemo-topbar">
        <strong style={{ fontWeight: 900, color: '#EE2C24', fontSize: 15 }}>
          BRICO<span style={{ color: '#08065D' }}>LOC</span>
        </strong>
        <Heart style={{ width: 22, height: 22, color: '#14123F' }} />
      </div>

      <div className="appdemo-greet">
        <h2>Bonjour !</h2>
        <p>Prêt à réaliser vos projets ?</p>
      </div>

      <button type="button" className="appdemo-search" onClick={() => onOpenCatalogue()}>
        <Search />
        Rechercher un outil…
      </button>

      <div className="appdemo-sectionhead">
        <h3>Catégories</h3>
        <button onClick={() => onOpenCatalogue()}>Tout voir</button>
      </div>
      <div className="appdemo-catrow">
        {categories.slice(0, 10).map((c) => {
          const Icon = CATEGORY_ICON[c.slug] ?? PackageIcon;
          return (
            <button key={c.slug} type="button" className="appdemo-cat" onClick={() => onOpenCatalogue(c.slug)}>
              <span className="appdemo-cat__ic">
                <Icon />
              </span>
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>

      {packs.length > 0 && (
        <>
          <div className="appdemo-sectionhead">
            <h3>BricoPacks</h3>
            <button onClick={() => onOpenCatalogue()}>Tout voir</button>
          </div>
          <div className="appdemo-packrow">
            {packs.map((p) => (
              <button key={p.slug} type="button" className="appdemo-pack" onClick={() => onOpenCatalogue()}>
                <span className="appdemo-pack__img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image || PLACEHOLDER_IMG} alt="" />
                </span>
                <span className="appdemo-pack__body">
                  <b>{p.name}</b>
                  {p.toolCount ? <span style={{ fontSize: 11, color: '#5B5F7A' }}>{p.toolCount} outils</span> : null}
                  <strong>
                    {formatEUR(p.dailyPrice)} <small>/ jour</small>
                  </strong>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="appdemo-sectionhead">
        <h3>Populaires</h3>
        <button onClick={() => onOpenCatalogue()}>Tout voir</button>
      </div>
      <div className="appdemo-grid">
        {popular.map((p) => (
          <ProductMini key={p.id} p={p} onOpen={() => onOpenProduct(p.slug)} />
        ))}
      </div>
    </>
  );
}

function ProductMini({ p, onOpen }: { p: ProductSummary; onOpen: () => void }) {
  return (
    <button type="button" className="appdemo-mini" onClick={onOpen}>
      <span className="appdemo-mini__img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image || PLACEHOLDER_IMG} alt="" />
      </span>
      <span className="appdemo-mini__body">
        <b>{p.name}</b>
        <strong>
          {formatEUR(p.dailyPrice)} <small>/ jour</small>
        </strong>
        {p.rating && p.rating.count > 0 ? (
          <span className="appdemo-mini__rating">
            ★ {p.rating.avg.toFixed(1)} ({p.rating.count})
          </span>
        ) : null}
      </span>
    </button>
  );
}

function CatalogueScreen({
  initialCategory,
  onOpenProduct,
}: {
  initialCategory?: string;
  onOpenProduct: (slug: string) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(initialCategory ?? '');

  useEffect(() => {
    api<{ categories: Category[] }>('/api/catalog/categories?locale=fr').then((r) =>
      setCategories(r.categories.filter((c) => c.slug !== 'bricopack')),
    );
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      const sp = new URLSearchParams({ pageSize: '20', sort: 'name', kind: 'MACHINE', locale: 'fr' });
      if (q) sp.set('q', q);
      if (cat) sp.set('category', cat);
      api<{ products: ProductSummary[] }>(`/api/catalog/products?${sp}`).then((r) => setProducts(r.products));
    }, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [q, cat]);

  const chips = [{ slug: '', name: 'Tout' }, ...categories];

  return (
    <>
      <div className="appdemo-topbar">
        <strong style={{ fontWeight: 900, color: '#EE2C24', fontSize: 15 }}>
          BRICO<span style={{ color: '#08065D' }}>LOC</span>
        </strong>
      </div>
      <h2 className="appdemo-cattitle">Le catalogue</h2>
      <div className="appdemo-search" style={{ marginTop: 14 }}>
        <Search />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un outil…"
          style={{ border: 'none', background: 'none', outline: 'none', font: 'inherit', color: '#14123F', width: '100%' }}
        />
      </div>
      <div className="appdemo-chips">
        {chips.map((c) => (
          <button
            key={c.slug || 'all'}
            type="button"
            className={`appdemo-chip${cat === c.slug ? ' is-on' : ''}`}
            onClick={() => setCat(c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="appdemo-grid" style={{ marginTop: 16 }}>
        {products.map((p) => (
          <ProductMini key={p.id} p={p} onOpen={() => onOpenProduct(p.slug)} />
        ))}
        {products.length === 0 && (
          <p style={{ gridColumn: '1/-1', color: '#5B5F7A', textAlign: 'center', marginTop: 30, fontSize: 13.5 }}>
            Aucun résultat.
          </p>
        )}
      </div>
    </>
  );
}

function ProductScreen({
  slug,
  onBack,
  onOpenProduct,
  onAdd,
  onReserve,
}: {
  slug: string;
  onBack: () => void;
  onOpenProduct: (slug: string) => void;
  onAdd: () => void;
  onReserve: () => void;
}) {
  const [data, setData] = useState<{ product: ProductDetail; similar: ProductSummary[] } | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setData(null);
    api<{ product: ProductDetail; similar: ProductSummary[] }>(`/api/catalog/products/${slug}?locale=fr`).then(
      setData,
    );
  }, [slug]);

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#5B5F7A', fontSize: 13.5 }}>Chargement…</div>
    );
  }
  const p = data.product;
  const linked = [...p.recommendedAccessories, ...p.ppe].slice(0, 3);
  const tiers = [
    { label: 'Jour', value: p.dailyPrice },
    { label: 'Semaine', value: p.weekPrice },
    { label: 'Mois', value: p.monthPrice },
  ].filter((t): t is { label: string; value: number } => t.value != null);

  return (
    <>
      <div className="appdemo-topbar">
        <button type="button" className="appdemo-backbtn" onClick={onBack} aria-label="Retour">
          <ChevronLeft />
        </button>
        <Heart style={{ width: 22, height: 22, color: '#14123F' }} />
      </div>
      <div className="appdemo-prodimg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image || PLACEHOLDER_IMG} alt="" />
      </div>
      <div className="appdemo-prodbody">
        <h2>{p.name}</h2>
        {p.rating && p.rating.count > 0 && (
          <p className="rating">
            ★ {p.rating.avg.toFixed(1)} ({p.rating.count} avis)
          </p>
        )}
        {tiers.length > 0 && (
          <div className="appdemo-tiers">
            {tiers.map((t) => (
              <div key={t.label}>
                <span>{t.label}</span>
                <b>{formatEUR(t.value)}</b>
              </div>
            ))}
          </div>
        )}
        {p.shortDescription && <p className="appdemo-desc">{p.shortDescription}</p>}

        {linked.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <b style={{ fontSize: 14, color: '#14123F' }}>Complétez votre location</b>
            {linked.map((l) => (
              <div key={l.id} className="appdemo-linked">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.image || PLACEHOLDER_IMG} alt="" />
                <div style={{ flex: 1 }}>
                  <div className="appdemo-linked__name">{l.name}</div>
                  <div className="appdemo-linked__price">{formatEUR(l.dailyPrice)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {data.similar.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <b style={{ fontSize: 14, color: '#14123F' }}>Dans la même catégorie</b>
            <div className="appdemo-packrow" style={{ padding: '12px 0 4px', margin: 0 }}>
              {data.similar.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="appdemo-mini"
                  style={{ width: 140, flexShrink: 0 }}
                  onClick={() => onOpenProduct(s.slug)}
                >
                  <span className="appdemo-mini__img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.image || PLACEHOLDER_IMG} alt="" />
                  </span>
                  <span className="appdemo-mini__body">
                    <b>{s.name}</b>
                    <strong>{formatEUR(s.dailyPrice)}</strong>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="appdemo-actionbar">
        <div className="price">
          {formatEUR(p.dailyPrice)}
          <small>/ jour</small>
        </div>
        <div className="appdemo-stepper">
          <button type="button" onClick={() => setQty((v) => Math.max(1, v - 1))}>
            −
          </button>
          <span>{qty}</span>
          <button type="button" onClick={() => setQty((v) => v + 1)}>
            +
          </button>
        </div>
        <button
          type="button"
          className="appdemo-cta"
          onClick={() => {
            onAdd();
            onReserve();
          }}
        >
          Réserver
        </button>
      </div>
    </>
  );
}

function ReservationsScreen() {
  return (
    <div className="appdemo-empty">
      <div className="appdemo-topbar" style={{ padding: 0, marginBottom: 8 }}>
        <strong style={{ fontWeight: 900, color: '#EE2C24', fontSize: 15 }}>
          BRICO<span style={{ color: '#08065D' }}>LOC</span>
        </strong>
      </div>
      <h2>Mes réservations</h2>
      <p>Connectez-vous pour retrouver vos réservations, QR codes et factures — accessibles aussi hors-ligne.</p>
      <button type="button" className="appdemo-cta">
        Se connecter
      </button>
      <div className="appdemo-demo-note">
        Démo de présentation — les données de compte réelles ne sont pas connectées ici.
      </div>
    </div>
  );
}

function ProfilScreen() {
  return (
    <div className="appdemo-empty">
      <div className="appdemo-topbar" style={{ padding: 0, marginBottom: 8 }}>
        <strong style={{ fontWeight: 900, color: '#EE2C24', fontSize: 15 }}>
          BRICO<span style={{ color: '#08065D' }}>LOC</span>
        </strong>
      </div>
      <h2>Mon compte</h2>
      <p>Connectez-vous ou créez un compte pour réserver, suivre vos locations et recevoir des notifications.</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="appdemo-cta">
          Se connecter
        </button>
      </div>
      <div className="appdemo-demo-note">Version de démonstration du site — pour présenter l&apos;appli mobile.</div>
    </div>
  );
}
