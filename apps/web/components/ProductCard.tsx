'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatEUR } from '@bricoloc/shared';
import type { ProductSummary } from '@/lib/types';
import { AvailabilityBadge } from './AvailabilityBadge';
import { AddToCartButton } from './AddToCartButton';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';

export function ProductCard({ p }: { p: ProductSummary }) {
  const t = useTranslations('catalogue');
  const KIND_LABEL: Record<string, string> = {
    MACHINE: t('kindMachine'),
    ACCESSORY: t('kindAccessory'),
    CONSUMABLE: t('kindConsumable'),
    PPE: t('kindPpe'),
    PACK: t('kindPack'),
  };
  return (
    <div className="card product-card">
      <Link href={`/produits/${p.slug}`}>
        <img
          className="thumb"
          src={p.image || PLACEHOLDER_IMG}
          alt={p.name}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG;
          }}
        />
      </Link>
      <div className="pc-body">
        <div className="row" style={{ gap: 6 }}>
          <span className="tag">{KIND_LABEL[p.kind] ?? p.kind}</span>
          {p.category && <span className="tag">{p.category.name}</span>}
        </div>
        <h3>
          <Link href={`/produits/${p.slug}`}>{p.name}</Link>
        </h3>
        {p.shortDescription && <p className="small muted">{p.shortDescription}</p>}
        <div className="price">
          {formatEUR(p.dailyPrice)}{' '}
          <small>/ {p.isConsumable ? t('perUnit') : t('perDay')}</small>
        </div>
        {!p.isConsumable && (
          <div className="small muted">
            {t('deposit')} {formatEUR(p.deposit)}
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'grid', gap: 8, paddingTop: 8 }}>
          <AvailabilityBadge a={p.availability} />
          <AddToCartButton productId={p.id} small />
        </div>
      </div>
    </div>
  );
}
