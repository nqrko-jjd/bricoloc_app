'use client';
import { useTranslations } from 'next-intl';
import { formatEUR } from '@bricoloc/shared';
import type { ProductDetail } from '@/lib/types';
import { usePriceDisplay } from '@/lib/usePriceDisplay';

/** Un seul prix, mis en avant (le tarif jour) — le détail des paliers dégressifs
 * vit dans le panneau d'achat, pas ici : on évite de répéter le prix deux fois. */
export function ProductPriceHead({ product }: { product: ProductDetail }) {
  const t = useTranslations('product');
  const { isPro, display } = usePriceDisplay();

  return (
    <p className="pdetail__price">
      <span className="pdetail__price-label">{t('startingFrom')}</span>
      <strong>{formatEUR(display(product.dailyPrice))}</strong>
      <span className="pdetail__price-unit">
        {product.isConsumable ? t('perUnit') : t('perDay')} · {isPro ? t('vatExcl') : t('vatIncl')}
      </span>
    </p>
  );
}
