'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatEUR } from '@bricoloc/shared';
import type { ProductSummary } from '@/lib/types';
import { AvailabilityBadge } from './AvailabilityBadge';
import { AddToCartButton } from './AddToCartButton';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';
import { productHref } from '@/lib/productHref';
import { Heart } from './icons';

export function ProductCard({ p }: { p: ProductSummary }) {
  const t = useTranslations('catalogue');
  const href = productHref(p);

  return (
    <article className="pcard">
      <Link href={href} className="pcard__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image || PLACEHOLDER_IMG}
          alt={p.name}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG;
          }}
        />
        {p.brand ? <span className="pcard__brand">{p.brand}</span> : null}
        <span className="pcard__heart" aria-hidden>
          <Heart />
        </span>
      </Link>

      <div className="pcard__body">
        {p.category ? <span className="pcard__cat">{p.category.name}</span> : null}
        <h3 className="pcard__name">
          <Link href={href}>{p.name}</Link>
        </h3>
        <div className="pcard__price">
          {formatEUR(p.dailyPrice)}
          <small>/ {p.isConsumable ? t('perUnit') : t('perDay')}</small>
        </div>
        {p.rating && p.rating.count > 0 ? (
          <span className="pcard__rating">
            ★ {p.rating.avg.toFixed(1)} <span>({p.rating.count})</span>
          </span>
        ) : null}
        <div className="pcard__foot">
          <AvailabilityBadge a={p.availability} />
          <AddToCartButton productId={p.id} small />
        </div>
      </div>
    </article>
  );
}
