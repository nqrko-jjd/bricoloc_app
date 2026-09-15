'use client';
import { useTranslations } from 'next-intl';
import { formatEUR } from '@bricoloc/shared';
import type { ProductDetail } from '@/lib/types';
import { usePriceDisplay } from '@/lib/usePriceDisplay';

/**
 * 4 paliers : Jour, le meilleur palier dégressif (« Dès Nj », mis en avant),
 * Semaine, Mois. Le palier mis en avant vient des vrais paliers du produit
 * (product.tiers), pas d'un « 3 jours » figé.
 */
function priceTiers(p: ProductDetail) {
  const degressive = p.tiers
    .filter((t) => t.minDays > 1)
    .sort((a, b) => a.minDays - b.minDays)[0];
  return [
    { key: 'priceDay', label: null, total: p.dailyPrice, best: false },
    ...(degressive
      ? [
          {
            key: `from-${degressive.minDays}`,
            label: degressive.minDays,
            total: degressive.perDay,
            best: true,
          },
        ]
      : []),
    { key: 'priceWeek', label: null, total: p.weekPrice ?? p.dailyPrice * 4, best: false },
    { key: 'priceMonth', label: null, total: p.monthPrice ?? p.dailyPrice * 12, best: false },
  ];
}

export function PriceTiersHead({ product }: { product: ProductDetail }) {
  const t = useTranslations('product');
  const { isPro, display } = usePriceDisplay();

  return (
    <div className="ptiers">
      {priceTiers(product).map((tier) => (
        <div key={tier.key} className={`ptier${tier.best ? ' is-best' : ''}`}>
          <span className="ptier__label">
            {tier.label ? t('priceFromDays', { days: tier.label }) : t(tier.key as never)}
          </span>
          <span className="ptier__price">{formatEUR(display(tier.total))}</span>
          <span className="ptier__vat small muted">{isPro ? t('vatExcl') : t('vatIncl')}</span>
        </div>
      ))}
    </div>
  );
}
