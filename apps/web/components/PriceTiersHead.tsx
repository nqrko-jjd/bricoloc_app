'use client';
import { useTranslations } from 'next-intl';
import { formatEUR } from '@bricoloc/shared';
import type { ProductDetail } from '@/lib/types';
import { usePriceDisplay } from '@/lib/usePriceDisplay';

function priceTiers(p: ProductDetail) {
  return [
    { key: 'priceDay', total: p.dailyPrice, unit: 1 },
    { key: 'priceWeek', total: p.weekPrice ?? p.dailyPrice * 4, unit: 7 },
    { key: 'priceMonth', total: p.monthPrice ?? p.dailyPrice * 12, unit: 30 },
  ];
}

export function PriceTiersHead({ product }: { product: ProductDetail }) {
  const t = useTranslations('product');
  const { isPro, display } = usePriceDisplay();

  return (
    <div className="ptiers">
      {priceTiers(product).map((tier) => (
        <div key={tier.key} className="ptier">
          <span className="ptier__label">{t(tier.key)}</span>
          <span className="ptier__price">{formatEUR(display(tier.total))}</span>
          <span className="ptier__vat small muted">{isPro ? t('vatExcl') : t('vatIncl')}</span>
        </div>
      ))}
    </div>
  );
}
