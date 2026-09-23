'use client';
import { useTranslations } from 'next-intl';
import { useCart } from '@/lib/providers';
import { usePriceDisplay } from '@/lib/usePriceDisplay';
import { formatEUR } from '@bricoloc/shared';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';
import type { LinkedProduct } from '@/lib/types';

/** Carte accessoire/consommable — entièrement facultative, avec son propre
 * stepper de quantité une fois ajoutée (pas de logique de panier parallèle :
 * lit et modifie le même panier que le reste du site). */
export function AccessoryCard({ item }: { item: LinkedProduct }) {
  const { cart, addItem, setQty, removeItem } = useCart();
  const { display } = usePriceDisplay();
  const t = useTranslations('product');
  const inCart = cart?.items.find((i) => i.productId === item.id);
  const qty = inCart?.quantity ?? 0;
  const defaultQty = item.quantity || 1;

  return (
    <li className="acard">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image || PLACEHOLDER_IMG} alt="" className="acard__img" loading="lazy" />
      <div className="acard__body">
        <span className="acard__name">
          {item.brand && <strong>{item.brand} · </strong>}
          {item.name}
        </span>
        {item.shortDescription && <span className="acard__utility">{item.shortDescription}</span>}
        <span className="acard__price">
          {formatEUR(display(item.dailyPrice))}
          {item.isConsumable ? ` ${t('perUnit')}` : ` ${t('perDay')}`}
        </span>
      </div>
      {qty > 0 ? (
        <div className="acard__added">
          <div className="qty">
            <button
              type="button"
              aria-label="Diminuer la quantité"
              onClick={() => (qty <= 1 ? removeItem(item.id) : setQty(item.id, qty - 1))}
            >
              −
            </button>
            <output>{qty}</output>
            <button type="button" aria-label="Ajouter une unité" onClick={() => setQty(item.id, qty + 1)}>
              +
            </button>
          </div>
          <span className="acard__addedlabel">✓ {t('addedToCartShort')}</span>
        </div>
      ) : (
        <button
          type="button"
          className="acard__addbtn"
          onClick={() => addItem(item.id, defaultQty)}
          aria-label={`${t('addAccessory')} ${item.name}`}
        >
          +
        </button>
      )}
    </li>
  );
}
