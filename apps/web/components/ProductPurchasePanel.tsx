'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatEUR } from '@bricoloc/shared';
import { api } from '@/lib/api';
import { toLocalInput, fromLocalInput } from '@/lib/dates';
import type { Availability, ProductDetail } from '@/lib/types';
import { useCart } from '@/lib/providers';
import { usePriceDisplay } from '@/lib/usePriceDisplay';
import { AvailabilityBadge } from './AvailabilityBadge';
import { WeekendOfferNote } from './WeekendOfferNote';
import { Home, Truck } from './icons';

function daysBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const { cart, addItem, setPeriod, setFulfilment, openDrawer } = useCart();
  const { isPro, display } = usePriceDisplay();
  const t = useTranslations('product');
  const tBar = useTranslations('dateBar');
  const [qty, setQty] = useState(1);
  const [avail, setAvail] = useState<Availability | null>(product.availability ?? null);
  const [extras, setExtras] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [extending, setExtending] = useState(false);
  const [localStart, setLocalStart] = useState(cart?.period ? toLocalInput(cart.period.start) : '');
  const [localEnd, setLocalEnd] = useState(cart?.period ? toLocalInput(cart.period.end) : '');

  useEffect(() => {
    setLocalStart(cart?.period ? toLocalInput(cart.period.start) : '');
    setLocalEnd(cart?.period ? toLocalInput(cart.period.end) : '');
  }, [cart?.period]);

  function applyDates(start: string, end: string) {
    if (!start || !end) return;
    setPeriod({ start: fromLocalInput(start), end: fromLocalInput(end) });
  }

  useEffect(() => {
    if (!cart?.period) {
      setAvail(null);
      return;
    }
    api<{ results: { availableQty: number; status: string; requestedQty: number }[] }>(
      '/api/availability/check',
      {
        method: 'POST',
        body: { period: cart.period, items: [{ productId: product.id, quantity: qty }] },
      },
    ).then((r) => setAvail(r.results[0] as unknown as Availability));
  }, [cart?.period, qty, product.id]);

  const linked = [
    ...product.recommendedAccessories.map((x) => ({ ...x, group: 'Accessoire' })),
    ...product.consumables
      .filter((x) => x.dailyPrice > 0)
      .map((x) => ({ ...x, group: 'Consommable' })),
    ...product.ppe.map((x) => ({ ...x, group: 'Protection' })),
  ];

  async function addAll() {
    setBusy(true);
    setMsg('');
    try {
      await addItem(product.id, qty);
      for (const l of linked) {
        if (extras[l.id]) await addItem(l.id, l.quantity || 1);
      }
      setDone(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  function continueShopping() {
    setDone(false);
    document.getElementById('accessoires')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const sortedTiers = [...product.tiers].sort((a, b) => a.minDays - b.minDays);
  const billedDays = cart?.period ? daysBetween(cart.period.start, cart.period.end) : null;
  const currentTier =
    billedDays != null
      ? [...sortedTiers].reverse().find((t) => t.minDays <= billedDays) ?? null
      : null;
  const nextTier = billedDays != null ? sortedTiers.find((t) => t.minDays > billedDays) : null;
  const currentPerDay = currentTier?.perDay ?? product.dailyPrice;
  const estimatedTotal = currentPerDay * qty * (product.isConsumable ? 1 : billedDays ?? 1);
  const isDelivery = cart?.fulfilmentMode === 'DELIVERY';

  async function extendToNextTier() {
    if (!cart?.period || !nextTier || !billedDays) return;
    setExtending(true);
    try {
      const daysNeeded = nextTier.minDays - billedDays;
      const newEnd = new Date(cart.period.end);
      newEnd.setDate(newEnd.getDate() + daysNeeded);
      await setPeriod({ start: cart.period.start, end: newEnd.toISOString() });
    } finally {
      setExtending(false);
    }
  }

  return (
    <div className="ppanel">
      <div className="field">
        <label>{t('whenNeeded')}</label>
        <div className="field-2">
          <div className="field">
            <label className="small muted">{tBar('start')}</label>
            <input
              type="datetime-local"
              value={localStart}
              onChange={(e) => {
                setLocalStart(e.target.value);
                applyDates(e.target.value, localEnd);
              }}
            />
          </div>
          <div className="field">
            <label className="small muted">{tBar('return')}</label>
            <input
              type="datetime-local"
              value={localEnd}
              min={localStart || undefined}
              onChange={(e) => {
                setLocalEnd(e.target.value);
                applyDates(localStart, e.target.value);
              }}
            />
          </div>
        </div>
      </div>

      {cart?.period && <AvailabilityBadge a={avail} />}

      {!product.isConsumable && (
        <WeekendOfferNote start={cart?.period?.start} end={cart?.period?.end} />
      )}

      {nextTier && billedDays != null && (
        <button
          type="button"
          className="ppanel__upsell"
          onClick={extendToNextTier}
          disabled={extending}
        >
          🔥 {extending ? '…' : (
            <>
              +{nextTier.minDays - billedDays} jour(s) → {formatEUR(display(nextTier.perDay))}/jour
              <span className="ppanel__upsell-was"> au lieu de {formatEUR(display(currentPerDay))}</span>
            </>
          )}
        </button>
      )}

      <div className="field">
        <label>{t('howReceive')}</label>
        <div className="ppanel__mode">
          <button
            type="button"
            className={`ppanel__modecard${!isDelivery ? ' is-active' : ''}`}
            onClick={() => setFulfilment({ mode: 'PICKUP' })}
          >
            <Home />
            <strong>{t('pickupMode')}</strong>
            <span className="small muted">{t('pickupModeHint')}</span>
          </button>
          <button
            type="button"
            className={`ppanel__modecard${isDelivery ? ' is-active' : ''}`}
            onClick={() => setFulfilment({ mode: 'DELIVERY' })}
          >
            <Truck />
            <strong>{t('deliveryMode')}</strong>
            <span className="small muted">{t('deliveryModeHint')}</span>
          </button>
        </div>
        {isDelivery && (
          <p className="small muted" style={{ margin: 0 }}>
            {t('deliveryDetailsAtCheckout')}
          </p>
        )}
      </div>

      <div className="field">
        <label>{t('quantity')}</label>
        <div className="qty">
          <button
            type="button"
            aria-label="Retirer une unité"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <output>{qty}</output>
          <button type="button" aria-label="Ajouter une unité" onClick={() => setQty((q) => q + 1)}>
            +
          </button>
        </div>
      </div>

      {linked.length > 0 && (
        <div>
          <strong style={{ color: 'var(--navy)', fontSize: '0.9rem' }}>Ajouter en un geste</strong>
          <div className="stack" style={{ gap: 6, marginTop: 8 }}>
            {linked.map((l) => (
              <label key={l.id} className="row" style={{ gap: 8, fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={!!extras[l.id]}
                  onChange={(e) => setExtras((s) => ({ ...s, [l.id]: e.target.checked }))}
                />
                <span>
                  {l.name}{' '}
                  <span className="muted">
                    ({l.group} · {formatEUR(display(l.dailyPrice))})
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="ppanel__total">
        <span>{t('estimatedTotal')}</span>
        <strong>
          {formatEUR(display(estimatedTotal))} <small className="muted">{isPro ? t('vatExcl') : t('vatIncl')}</small>
        </strong>
      </div>

      <button
        className={`btn btn-block btn-lg${done ? ' btn-secondary' : ' btn-primary'}`}
        onClick={addAll}
        disabled={busy || done || avail?.status === 'UNAVAILABLE'}
      >
        {busy ? '…' : done ? `✓ ${t('addedToCart')}` : t('addToCartCta')}
      </button>
      {msg && (
        <p className="small" style={{ margin: 0, color: 'var(--err)' }}>
          {msg}
        </p>
      )}
      {done && (
        <div className="ppanel__done">
          <p className="ppanel__done-title">✓ {t('addedTitle')}</p>
          <p className="small muted" style={{ margin: '4px 0 12px' }}>
            {t('addedHint')}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={continueShopping}>
              {t('continueShopping')}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={openDrawer}>
              {t('viewCart', { count: cart?.itemCount ?? 1 })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
