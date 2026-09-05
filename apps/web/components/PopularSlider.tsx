'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatEUR } from '@bricoloc/shared';
import { Link } from '@/i18n/navigation';
import { Heart as IHeart, ArrowUpRight as IArrowUpRight } from './icons';
import type { ProductSummary } from '@/lib/types';

/**
 * « Ce que louent nos clients » : grille sur desktop/tablette, slider une
 * carte à la fois sur mobile (trop long à défiler verticalement) avec une
 * ligne de puces discrète en dessous (façon Kiloutou) pour signaler qu'on
 * peut glisser.
 */
export function PopularSlider({
  products,
  showBrand,
  showBadges,
}: {
  products: ProductSummary[];
  showBrand: boolean;
  showBadges: boolean;
}) {
  const t = useTranslations('home');
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (mostVisible) setActive(cards.indexOf(mostVisible.target as HTMLElement));
      },
      { root: track, threshold: [0.5, 0.75, 1] },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [products.length]);

  return (
    <>
      <div className="ctools reveal" ref={trackRef}>
        {products.map((p, i) => (
          <Link key={p.id} href={`/produits/${p.slug}`} className="ctool">
            <div className="ctool__top">
              <span className="ctool__tag">{i === 0 ? t('popularTag') : t('availableTag')}</span>
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
      <div className="ctools__dots" aria-hidden>
        {products.map((_, i) => (
          <span key={i} className={i === active ? 'is-active' : undefined} />
        ))}
      </div>
    </>
  );
}
