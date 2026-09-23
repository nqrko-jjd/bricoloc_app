'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatEUR, formatDateBE } from '@bricoloc/shared';
import { useCart } from '@/lib/providers';
import { durationLabel } from '@/lib/dates';
import { productHref } from '@/lib/productHref';
import { PLACEHOLDER_IMG } from '@/lib/placeholder';
import { Price } from './Price';

/**
 * Panneau latéral du panier — s'ouvre par-dessus la page en cours (fiche
 * produit, catalogue…) sans navigation, pour continuer les achats sans
 * perdre son contexte. Lit et modifie le MÊME panier que /panier — aucune
 * logique de panier parallèle.
 */
export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, setQty, removeItem } = useCart();
  const t = useTranslations('cartDrawer');

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDrawer();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  const items = cart?.items ?? [];
  const tools = items.filter((it) => !it.isConsumable && it.kind !== 'ACCESSORY' && it.kind !== 'PPE');
  const extras = items.filter((it) => it.isConsumable || it.kind === 'ACCESSORY' || it.kind === 'PPE');
  const period = cart?.period;

  return (
    <div className="cartdrawer-overlay" onClick={closeDrawer}>
      <aside
        className="cartdrawer"
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cartdrawer__head">
          <div>
            <strong>{t('title')}</strong>
            <span className="small muted">{t('itemCount', { count: cart?.itemCount ?? 0 })}</span>
          </div>
          <button type="button" className="cartdrawer__close" onClick={closeDrawer} aria-label={t('close')}>
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <p className="muted">{t('empty')}</p>
        ) : (
          <div className="cartdrawer__body">
            {period && (
              <p className="cartdrawer__period">
                📅 {formatDateBE(period.start)} → {formatDateBE(period.end)} ({durationLabel(period.start, period.end)})
              </p>
            )}

            {tools.length > 0 && (
              <div className="cartdrawer__group">
                <span className="cartdrawer__grouplabel">{t('rentalGroup')}</span>
                {tools.map((it) => (
                  <CartDrawerLine key={it.id} it={it} setQty={setQty} removeItem={removeItem} />
                ))}
              </div>
            )}

            {extras.length > 0 && (
              <div className="cartdrawer__group">
                <span className="cartdrawer__grouplabel">{t('extrasGroup')}</span>
                {extras.map((it) => (
                  <CartDrawerLine key={it.id} it={it} setQty={setQty} removeItem={removeItem} />
                ))}
              </div>
            )}

            {cart?.fulfilmentMode && (
              <p className="small muted" style={{ margin: 0 }}>
                {cart.fulfilmentMode === 'DELIVERY' ? t('modeDelivery') : t('modePickup')}
              </p>
            )}

            <p className="cartdrawer__note">{t('note')}</p>

            {cart?.quote && (
              <div className="cartdrawer__total">
                <span>{t('total')}</span>
                <strong>{formatEUR(cart.quote.totals.totalTVAC)} TVAC</strong>
              </div>
            )}
          </div>
        )}

        <div className="cartdrawer__foot">
          <button type="button" className="btn btn-outline" onClick={closeDrawer}>
            {t('continueShopping')}
          </button>
          <Link href="/commande" className="btn btn-primary" onClick={closeDrawer}>
            {t('continueBooking')}
          </Link>
        </div>
      </aside>
    </div>
  );
}

function CartDrawerLine({
  it,
  setQty,
  removeItem,
}: {
  it: { id: string; productId: string; name: string; slug: string; kind: string; image: string | null; quantity: number; dailyPrice: number; isConsumable: boolean };
  setQty: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
}) {
  return (
    <div className="cartdrawer__line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={it.image || PLACEHOLDER_IMG} alt="" />
      <div className="cartdrawer__lineinfo">
        <Link href={productHref(it)}>{it.name}</Link>
        <span className="small muted">
          <Price amountHT={it.dailyPrice} /> {it.isConsumable ? '/ pièce' : '/ jour'}
        </span>
      </div>
      <div className="qty">
        <button
          type="button"
          aria-label="Diminuer la quantité"
          onClick={() => (it.quantity <= 1 ? removeItem(it.productId) : setQty(it.productId, it.quantity - 1))}
        >
          −
        </button>
        <output>{it.quantity}</output>
        <button type="button" aria-label="Augmenter la quantité" onClick={() => setQty(it.productId, it.quantity + 1)}>
          +
        </button>
      </div>
    </div>
  );
}
