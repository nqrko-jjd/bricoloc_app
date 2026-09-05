import { getTranslations, setRequestLocale } from 'next-intl/server';
import { formatEUR } from '@bricoloc/shared';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { loadContent } from '@/lib/content';
import type { Category, GuideSummary, ProductSummary, PublicConfig } from '@/lib/types';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { DegressivePricing } from '@/components/DegressivePricing';
import { PhoneDemo } from '@/components/PhoneDemo';
import {
  CATEGORY_ICON,
  ArrowUpRight,
  ArrowUpRight as IArrowUpRight,
  Heart as IHeart,
  Clock as IClock,
  Truck as ITruck,
  ShieldCheck as IShieldCheck,
  Search as ISearch,
  Sparkles,
  CalendarClock,
  PackageIcon,
} from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tg = await getTranslations('guides');

  const [{ categories }, popularRes, featuredRes, packsRes, guidesRes, content, config] = await Promise.all([
    api<{ categories: Category[] }>(`/api/catalog/categories?locale=${locale}`, {
      next: { revalidate: 120 },
    }),
    api<{ products: ProductSummary[]; total: number }>(
      `/api/catalog/products?pageSize=8&sort=name&locale=${locale}`,
      { next: { revalidate: 60 } },
    ),
    // Sélection manuelle (admin → Accueil) ; vide = on garde le tri par défaut ci-dessus.
    api<{ products: ProductSummary[] }>(`/api/public/home-featured?locale=${locale}`, {
      next: { revalidate: 60 },
    }).catch(() => ({ products: [] as ProductSummary[] })),
    api<{ products: ProductSummary[] }>(
      `/api/catalog/products?kind=PACK&pageSize=6&locale=${locale}`,
      { next: { revalidate: 120 } },
    ).catch(() => ({ products: [] as ProductSummary[] })),
    api<{ guides: GuideSummary[] }>(`/api/public/guides?locale=${locale}`, {
      next: { revalidate: 120 },
    }).catch(() => ({ guides: [] as GuideSummary[] })),
    loadContent('home.', locale),
    api<PublicConfig>('/api/public/config', { next: { revalidate: 300 } }).catch(
      () => null as PublicConfig | null,
    ),
  ]);

  const popular = featuredRes.products.length
    ? featuredRes.products.slice(0, 3)
    : (popularRes.products ?? []).filter((p) => p.image).slice(0, 3);
  const showBrand = config?.homeShowBrand === true;
  const showBadges = config?.homeShowBadges !== false;
  const packs = (packsRes.products ?? []).slice(0, 5);
  const toolCount = Math.max(10, Math.floor((popularRes.total ?? 80) / 10) * 10);
  const guides = (guidesRes.guides ?? []).slice(0, 3);
  // BricoPacks a déjà sa propre mise en avant plus bas — pas la peine de la
  // dupliquer ici parmi les catégories de machines.
  const cats = categories.filter((c) => c.slug !== 'bricopack');

  const catLabel = (slug: string) => {
    try {
      return tg(`cat_${slug}` as never) as string;
    } catch {
      return slug;
    }
  };

  return (
    <>
      {/* ─────────────── HERO ─────────────── */}
      <section className="chero">
        <div className="chero__imgwrap">
          <img className="chero__img" src="/img/home/hero.webp" alt="" />
        </div>
        <div className="chero__text">
          <span className="kicker">— {t('heroEyebrow')}</span>
          <h1>
            {content.t('home.hero.title', t('heroTitle'))}
            <br />
            <i>{content.t('home.hero.accent', t('heroTitleAccent'))}</i>
          </h1>
          <p className="chero__intro">{content.t('home.hero.subtitle', t('heroLead'))}</p>
          <SearchAutocomplete
            variant="hero"
            placeholder={t('searchPlaceholder')}
            cta={t('heroCtaCatalogue')}
          />
        </div>
        <div className="chero__stat">
          <strong>{toolCount}+</strong>
          <span>{t('statToolsSub')}</span>
        </div>
      </section>

      {/* ─────────────── CONFIANCE ─────────────── */}
      <div className="ctrust reveal">
        <div>
          <IClock /> {t('trustDispo')}
        </div>
        <div>
          <ITruck /> {t('trustDelivery')}
        </div>
        <div>
          <IShieldCheck /> {t('trustChecked')}
        </div>
        <div>
          <IHeart /> {t('trustRating')}
        </div>
      </div>

      {/* ─────────────── CATÉGORIES ─────────────── */}
      <section className="csection">
        <div className="csection__head">
          <div>
            <span className="kicker">— {t('exploreEyebrow')}</span>
            <h2>
              {t('exploreTitle')} <i>{t('exploreAccent')}</i>
            </h2>
          </div>
          <Link href="/catalogue" className="csection__link">
            {t('exploreCta', { count: toolCount })} <IArrowUpRight />
          </Link>
        </div>
        <div className="ccats reveal">
          {cats.map((c, i) => {
            const Icon = CATEGORY_ICON[c.slug] ?? Sparkles;
            return (
              <Link key={c.slug} href={`/catalogue?category=${c.slug}`}>
                <span className="ccats__num">{String(i + 1).padStart(2, '0')}</span>
                <span className="ccats__go" aria-hidden>
                  →
                </span>
                <Icon className="ccats__icon" />
                <span className="ccats__name">{c.name}</span>
                {c.productCount ? (
                  <span className="ccats__count">
                    {c.productCount} {t('exploreTools')}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ─────────────── LE + LOUÉ ─────────────── */}
      {popular.length > 0 && (
        <section className="csection" style={{ paddingTop: 0 }}>
          <div className="csection__head">
            <div>
              <span className="kicker">— {t('popularEyebrow')}</span>
              <h2>{t('popularTitle')}</h2>
            </div>
            <Link href="/catalogue" className="csection__link">
              {t('seeAll')} <IArrowUpRight />
            </Link>
          </div>
          <div className="ctools reveal">
            {popular.map((p, i) => (
              <Link key={p.id} href={`/produits/${p.slug}`} className="ctool">
                <div className="ctool__top">
                  <span className="ctool__tag">
                    {i === 0 ? t('popularTag') : t('availableTag')}
                  </span>
                  <IHeart />
                </div>
                {showBadges && (p.isNew || p.inPack) && (
                  <div className="ctool__flags">
                    {p.isNew && <span className="ctool__flag ctool__flag--new">{t('badgeNew')}</span>}
                    {p.inPack && <span className="ctool__flag">{t('badgeInPack')}</span>}
                  </div>
                )}
                <div className="ctool__art">
                  {showBrand && p.brand && <span className="ctool__badge">{p.brand}</span>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image ?? ''} alt={p.name} loading="lazy" />
                </div>
                <span className="ctool__cat">{p.category?.name ?? ''}</span>
                <span className="ctool__name">{p.name}</span>
                <div className="ctool__foot">
                  <p>
                    {t('from')}
                    <br />
                    <b>{formatEUR(p.dailyPrice)}</b> {t('perDay')}
                  </p>
                  <span className="ctool__go" aria-hidden>
                    <IArrowUpRight />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────── NOTRE DIFFÉRENCE : LIVRAISON + BRICOPACKS ─────────────── */}
      <section className="cdiff">
        <div className="csection__head">
          <div>
            <span className="kicker">— {t('diffEyebrow')}</span>
            <h2>
              {t('diffTitle')} <i>{t('diffAccent')}</i>
            </h2>
          </div>
        </div>
        <div className="cdiff__grid reveal">
          <div className="cdiff__card cdiff__card--delivery">
            <ITruck />
            <h3>{t('diffDeliveryTitle')}</h3>
            <p>{t('diffDeliveryText')}</p>
            <ul className="cdiff__points">
              <li>{t('diffDeliveryPoint1')}</li>
              <li>{t('diffDeliveryPoint2')}</li>
            </ul>
            <Link href="/livraison" className="csection__link">
              {t('trustDelivery')} <IArrowUpRight />
            </Link>
          </div>
          <div className="cdiff__card cdiff__card--pack">
            <PackageIcon />
            <h3>{t('diffPackTitle')}</h3>
            <p>{t('diffPackText')}</p>
            {packs.length > 0 && (
              <div className="cdiff__packs">
                {packs.map((p) => (
                  <Link key={p.id} href={`/bricopacks/${p.slug}`} className="cdiff__pack">
                    <span>{p.name.replace(/^BricoPack\s*/i, '')}</span>
                    <b>
                      {t('diffFrom')} {formatEUR(p.dailyPrice)}
                    </b>
                  </Link>
                ))}
              </div>
            )}
            <p className="cdiff__compose">{t('diffComposeText')}</p>
            <div className="cdiff__composeLinks">
              <Link href="/bricopacks" className="csection__link">
                {t('diffPackCta')} <IArrowUpRight />
              </Link>
              <Link href="/bricopacks#composer" className="csection__link">
                {t('diffComposeCta')} <IArrowUpRight />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── PRIX DÉGRESSIFS ─────────────── */}
      <section className="csection" style={{ paddingBlock: 0 }}>
        <div className="csaving reveal">
          <div>
            <span className="kicker">— {t('degressiveEyebrow')}</span>
            <h2>
              {t('degressiveTitle')} <i>{t('degressiveTitleAccent')}</i>
            </h2>
            <p className="csaving__lead">{t('degressiveText')}</p>
          </div>
          <DegressivePricing />
        </div>
      </section>

      {/* ─────────────── 3 ÉTAPES ─────────────── */}
      <section className="csection">
        <div className="csection__head">
          <div>
            <span className="kicker">— {t('stepsEyebrow')}</span>
            <h2>
              {t('stepsTitle')} <i>{t('stepsAccent')}</i>
            </h2>
          </div>
        </div>
        <div className="csteps reveal">
          {[
            { Icon: ISearch, key: '1' },
            { Icon: CalendarClock, key: '2' },
            { Icon: PackageIcon, key: '3' },
          ].map(({ Icon, key }) => (
            <article key={key} className="cstep">
              <span className="cstep__n">0{key}</span>
              <Icon />
              <h3>{t(`step${key}Title` as never)}</h3>
              <p>{content.t(`home.step${key}.text`, t(`step${key}Text` as never))}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─────────────── L'APP ─────────────── */}
      <section className="capp">
        <div className="capp__text reveal">
          <span className="kicker">— {t('appEyebrow')}</span>
          <h2>
            {t('appTitle')} <i>{t('appTitleAccent')}</i>
          </h2>
          <p>{t('appText')}</p>
          <ul className="capp__list">
            <li>{t('appF1')}</li>
            <li>{t('appF2')}</li>
            <li>{t('appF3')}</li>
          </ul>
          <Link href="/application" className="csection__link" style={{ color: '#fff' }}>
            {t('appCta')} <IArrowUpRight />
          </Link>
        </div>
        <div className="capp__phones reveal">
          <PhoneDemo />
        </div>
      </section>

      {/* ─────────────── CONSEILS & DIY ─────────────── */}
      {guides.length > 0 && (
        <section className="csection">
          <div className="csection__head">
            <div>
              <span className="kicker">— {t('adviceEyebrow')}</span>
              <h2>
                {t('adviceHeading')} <i>{t('adviceHeadingAccent')}</i>
              </h2>
            </div>
            <Link href="/conseils" className="csection__link">
              {t('adviceSeeAll')} <IArrowUpRight />
            </Link>
          </div>
          <div className="guide-grid reveal">
            {guides.map((g) => (
              <Link key={g.slug} href={`/conseils/${g.slug}`} className="guide-card" data-tone={g.tone}>
                <span className="guide-card__meta">
                  <span>{catLabel(g.category)}</span>
                  <span>◷ {g.readMinutes} min</span>
                </span>
                <span className="guide-card__title">{g.title}</span>
                <span className="guide-card__excerpt">{g.excerpt}</span>
                <span className="guide-card__cta">
                  {t('adviceRead')} →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────── TÉMOIGNAGE ─────────────── */}
      <figure className="cquote reveal">
        <span className="cquote__mark">“</span>
        <blockquote>{t('testimonialQuote')}</blockquote>
        <figcaption>
          {t('testimonialAuthor')} <span aria-hidden>★★★★★</span>
        </figcaption>
      </figure>

      {/* ─────────────── CTA ─────────────── */}
      <section className="ccta reveal">
        <div>
          <span className="kicker" style={{ color: '#fff', opacity: 0.7 }}>
            — {t('ctaEyebrow')}
          </span>
          <h2>
            {content.title('home.cta.title', t('ctaTitle'))} <i>{t('ctaAccent')}</i>
          </h2>
        </div>
        <Link href="/catalogue">
          {t('ctaButton')} <ArrowUpRight />
        </Link>
      </section>
    </>
  );
}
