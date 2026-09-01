import { getTranslations, setRequestLocale } from 'next-intl/server';
import { formatEUR } from '@bricoloc/shared';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { loadContent } from '@/lib/content';
import type { Category, ProductSummary } from '@/lib/types';
import { HomeDatePicker } from '@/components/HomeDatePicker';
import { ProductCard } from '@/components/ProductCard';

export const dynamic = 'force-dynamic';

/** Tâches → catégorie ciblée + visuel. Le lien retombe sur /catalogue si la catégorie n'existe pas encore. */
const TASKS = [
  { key: 'demolir', label: 'Démolir, percer', img: 'task-demolir', cat: 'forer-casser' },
  { key: 'beton', label: 'Béton & pierre', img: 'task-beton', cat: 'beton-pierre' },
  { key: 'bois', label: 'Travailler le bois', img: 'task-bois', cat: 'travail-du-bois' },
  { key: 'peindre', label: 'Peindre & enduire', img: 'task-peindre', cat: 'peintures-finitions' },
  { key: 'poncer', label: 'Poncer', img: 'task-poncer', cat: 'travail-du-bois' },
  { key: 'chauffer', label: 'Chauffer & assécher', img: 'task-chauffer', cat: 'chauffage-deshumidification' },
  { key: 'jardin', label: 'Jardin & extérieur', img: 'task-jardin', cat: 'exterieur' },
  { key: 'nettoyer', label: 'Nettoyer', img: 'task-nettoyer', cat: 'nettoyage' },
];

const BRANDS = [
  'Makita', 'Bosch', 'Metabo', 'Milwaukee', 'DeWalt', 'Hikoki', 'Festool', 'Hilti',
  'Flex', 'Husqvarna', 'Stihl', 'Karcher', 'Nilfisk', 'Spit', 'Rubi', 'Rothenberger',
  'Geberit', 'Atika', 'Eibenstock', 'Master', 'Eurom', 'Paslode', 'Prebena', 'Stanley',
];

const FAQ = {
  price: [
    ['Comment est calculé le prix ?', 'Au jour, à la semaine (4× le tarif jour) ou au mois (12× le tarif jour). Les dates de la commande fixent la durée facturée.'],
    ['La caution, c’est quoi ?', 'Une empreinte bancaire : le montant est bloqué sans être débité, puis libéré au retour si tout est en ordre. En Click & Collect, la caution peut être laissée en espèces.'],
    ['Y a-t-il une réduction longue durée ?', 'Oui, les tarifs sont dégressifs et une remise s’applique automatiquement pour les professionnels.'],
  ],
  delivery: [
    ['Click & Collect, comment ça marche ?', 'Vous réservez en ligne, on prépare le matériel, vous le retirez au dépôt de Ruisbroek (Sint-Pieters-Leeuw) aux horaires d’ouverture.'],
    ['Vous livrez sur chantier ?', 'Oui, dans la zone desservie. Le tarif est calculé automatiquement depuis votre adresse (distance depuis le dépôt).'],
    ['Offre week-end ?', 'Retrait le vendredi ou samedi, retour le lundi matin : une seule journée facturée.'],
  ],
  gear: [
    ['Le matériel est-il fiable ?', 'Chaque machine est suivie à l’exemplaire, entretenue et contrôlée avant chaque location.'],
    ['Les accessoires sont-ils fournis ?', 'Les accessoires de base sont inclus. Les consommables adaptés (mèches, disques, papier abrasif…) sont proposés sur chaque fiche.'],
    ['Et si je casse quelque chose ?', 'On l’évalue au retour ; seule la remise en état est facturée, prélevée sur la caution.'],
  ],
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tn = await getTranslations('nav');

  const [{ categories }, popularRes, packsRes, content] = await Promise.all([
    api<{ categories: Category[] }>('/api/catalog/categories', { next: { revalidate: 120 } }),
    api<{ products: ProductSummary[] }>('/api/catalog/products?pageSize=8&sort=name', {
      next: { revalidate: 60 },
    }),
    api<{ products: ProductSummary[] }>('/api/catalog/products?kind=PACK&pageSize=6', {
      next: { revalidate: 120 },
    }).catch(() => ({ products: [] as ProductSummary[] })),
    loadContent('home.', locale),
  ]);
  const popular = popularRes.products ?? [];
  const packs = packsRes.products ?? [];
  const catLink = (slug: string) =>
    categories.some((c) => c.slug === slug) ? `/catalogue?category=${slug}` : '/catalogue';

  return (
    <>
      {/* ─────────────── HERO ─────────────── */}
      <section className="home-hero">
        <div className="home-hero__bg" aria-hidden />
        <div className="container home-hero__inner">
          <div className="home-hero__copy">
            <span className="eyebrow">{t('heroEyebrow')}</span>
            <h1>{content.t('home.hero.title', 'Le bon outil. Au bon moment.')}</h1>
            <p className="home-hero__lead">
              {content.t(
                'home.hero.subtitle',
                'Louez des machines et de l’outillage professionnel, contrôlé et entretenu. Réservation en ligne 24h/24, retrait rapide en Click & Collect ou livraison sur chantier.',
              )}
            </p>
            <div className="row">
              <Link href="/catalogue" className="btn btn-primary btn-lg">
                {t('heroCtaCatalogue')}
              </Link>
              <Link href="/pro" className="btn btn-outline btn-lg home-hero__pro">
                {t('heroCtaPro')}
              </Link>
            </div>
          </div>
          <div className="home-hero__search">
            <HomeDatePicker />
          </div>
        </div>
        <div className="home-weekend container">
          <strong>{t('weekend')}</strong>
          <span>{content.t('home.weekend.text', t('weekendText'))}</span>
        </div>
      </section>

      {/* ─────────────── COMMENT VOUS AIDER ─────────────── */}
      <section className="section container">
        <div className="section-head reveal">
          <h2>{t('helpTitle')}</h2>
          <p className="muted">{content.t('home.help.subtitle', t('helpSubtitle'))}</p>
        </div>
        <ul className="taskgrid">
          {TASKS.map((task, i) => (
            <li key={task.key} className="reveal" data-reveal-delay={i * 45}>
              <Link href={catLink(task.cat)} className="taskcard">
                <img src={`/img/home/${task.img}.webp`} alt="" loading="lazy" />
                <span className="taskcard__label">
                  {content.t(`home.task.${task.key}`, task.label)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ─────────────── LES PLUS LOUÉS ─────────────── */}
      {popular.length > 0 && (
        <section className="section section--alt">
          <div className="container">
            <div className="spread reveal">
              <h2>{t('popularTitle')}</h2>
              <Link href="/catalogue" className="btn btn-ghost btn-sm">
                {t('seeAll')}
              </Link>
            </div>
            <div className="grid grid-cards reveal" style={{ marginTop: 20 }}>
              {popular.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────── CATÉGORIES (bento) ─────────────── */}
      <section className="section container">
        <div className="section-head reveal">
          <h2>{t('categoriesTitle')}</h2>
        </div>
        <ul className="catbento">
          {categories.map((c, i) => (
            <li
              key={c.slug}
              className={`catbento__item reveal${i % 5 === 0 ? ' catbento__item--wide' : ''}`}
              data-reveal-delay={i * 40}
              style={c.image ? { backgroundImage: `url(${c.image})` } : undefined}
            >
              <Link href={`/catalogue?category=${c.slug}`}>
                <span className="catbento__name">{c.name}</span>
                {c.productCount ? (
                  <span className="catbento__count">{c.productCount}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ─────────────── 3 ÉTAPES ─────────────── */}
      <section className="section section--navy">
        <div className="container">
          <h2 className="reveal">{t('stepsTitle')}</h2>
          <ol className="steps3">
            {[1, 2, 3].map((n) => (
              <li key={n} className="reveal" data-reveal-delay={(n - 1) * 90}>
                <span className="steps3__num">{n}</span>
                <h3>{t(`step${n}Title`)}</h3>
                <p>{content.t(`home.step${n}.text`, t(`step${n}Text`))}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─────────────── BRICOPACKS ─────────────── */}
      <section className="section container">
        <div className="home-packs">
          <div className="home-packs__intro reveal">
            <span className="eyebrow">BricoPacks</span>
            <h2>{t('packsTitle')}</h2>
            <p className="muted">{content.t('home.packs.text', t('packsText'))}</p>
            <Link href="/catalogue?category=bricopack" className="btn btn-secondary">
              {t('seeAll')}
            </Link>
          </div>
          <div className="home-packs__grid reveal">
            {(packs.length > 0 ? packs : []).slice(0, 4).map((p) => (
              <Link key={p.id} href={`/produits/${p.slug}`} className="home-pack">
                <img src={p.image || '/img/home/pack.webp'} alt={p.name} loading="lazy" />
                <div>
                  <h3>{p.name}</h3>
                  <span className="price">
                    {t('from')} {formatEUR(p.dailyPrice)} {t('perDay')}
                  </span>
                </div>
              </Link>
            ))}
            {packs.length === 0 && (
              <div className="home-pack home-pack--empty">
                <img src="/img/home/pack.webp" alt="" loading="lazy" />
                <div>
                  <h3>Bientôt disponibles</h3>
                  <span className="muted small">Les BricoPacks arrivent au catalogue.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────── FAQ 3 colonnes ─────────────── */}
      <section className="section section--alt">
        <div className="container">
          <div className="section-head reveal">
            <h2>{t('faqTitle')}</h2>
          </div>
          <div className="faq3">
            {(['price', 'delivery', 'gear'] as const).map((col) => (
              <div key={col} className="faq3__col reveal">
                <h3>{t(col === 'price' ? 'faqPrice' : col === 'delivery' ? 'faqDelivery' : 'faqGear')}</h3>
                {FAQ[col].map(([q, a]) => (
                  <details key={q}>
                    <summary>{q}</summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
          <p className="center" style={{ marginTop: 24 }}>
            <Link href="/faq" className="btn btn-ghost btn-sm">
              {tn('faq')}
            </Link>
          </p>
        </div>
      </section>

      {/* ─────────────── CONSEILS & SAV ─────────────── */}
      <section className="section container">
        <div className="home-advice reveal">
          <div>
            <span className="eyebrow">{t('adviceTitle')}</span>
            <h2>{content.title('home.advice.title', t('adviceTitle'))}</h2>
            <p className="muted">{content.t('home.advice.text', t('adviceText'))}</p>
          </div>
          <div className="row">
            <Link href="/conseils" className="btn btn-outline">
              {t('adviceCta')}
            </Link>
            <Link href="/contact" className="btn btn-ghost">
              {t('contactCta')}
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────── POINTS FORTS ─────────────── */}
      <section className="section section--navy">
        <div className="container">
          <h2 className="reveal">{t('strengthsTitle')}</h2>
          <div className="strengths">
            {[
              ['24/7', content.t('home.strength.1', 'Réservation en ligne, à toute heure')],
              ['3', content.t('home.strength.2', 'Langues : FR · NL · EN')],
              ['1', content.t('home.strength.3', 'Prix, une seule date pour toute la commande')],
              ['100%', content.t('home.strength.4', 'Matériel suivi, entretenu et contrôlé')],
            ].map(([n, label], i) => (
              <div key={i} className="reveal" data-reveal-delay={i * 80}>
                <span className="strengths__num">{n}</span>
                <p>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── MARQUES ─────────────── */}
      <section className="section container">
        <div className="section-head reveal">
          <h2>{t('brandsTitle')}</h2>
        </div>
        <div className="brandstrip reveal" aria-label={t('brandsTitle')}>
          {[...BRANDS, ...BRANDS].map((b, i) => (
            <span key={i}>{b}</span>
          ))}
        </div>
      </section>

      {/* ─────────────── CTA FINAL ─────────────── */}
      <section className="home-cta">
        <div className="home-cta__bg" aria-hidden />
        <div className="container home-cta__inner reveal">
          <h2>{content.title('home.cta.title', t('ctaTitle'))}</h2>
          <p>{content.t('home.cta.text', t('ctaText'))}</p>
          <Link href="/catalogue" className="btn btn-primary btn-lg">
            {t('ctaButton')}
          </Link>
        </div>
      </section>
    </>
  );
}
