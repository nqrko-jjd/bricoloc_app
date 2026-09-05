'use client';
import { useEffect, useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { api } from '@/lib/api';
import type { Availability, ProductDetail } from '@/lib/types';
import { useCart } from '@/lib/providers';
import { usePriceDisplay } from '@/lib/usePriceDisplay';
import { AvailabilityBadge } from './AvailabilityBadge';

function daysBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const { cart, addItem, setPeriod } = useCart();
  const { isPro, display } = usePriceDisplay();
  const [qty, setQty] = useState(1);
  const [avail, setAvail] = useState<Availability | null>(product.availability ?? null);
  const [extras, setExtras] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [extending, setExtending] = useState(false);

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
      const n = Object.values(extras).filter(Boolean).length;
      setMsg(`Ajouté au panier${n ? ` avec ${n} article(s) associé(s)` : ''}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  const sortedTiers = [...product.tiers].sort((a, b) => a.minDays - b.minDays);
  const billedDays = cart?.period ? daysBetween(cart.period.start, cart.period.end) : null;
  const currentTier =
    billedDays != null
      ? [...sortedTiers].reverse().find((t) => t.minDays <= billedDays) ?? null
      : null;
  const nextTier = billedDays != null ? sortedTiers.find((t) => t.minDays > billedDays) : null;
  const currentPerDay = currentTier?.perDay ?? product.dailyPrice;

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
    <div className="card card-pad summary">
      <div className="price" style={{ fontSize: '1.6rem' }}>
        {formatEUR(display(currentPerDay))}{' '}
        <small>/ {product.isConsumable ? 'unité' : 'jour'}</small>
        {currentTier && currentTier.minDays > 1 && (
          <span className="ppanel__tierbadge">-{Math.round((1 - currentTier.perDay / product.dailyPrice) * 100)}%</span>
        )}
        <span className="small muted" style={{ marginLeft: 8 }}>
          {isPro ? 'HTVA' : 'TVAC'}
        </span>
      </div>
      {!product.isConsumable && (
        <p className="small muted">
          Week-end {product.weekendPrice ? formatEUR(display(product.weekendPrice)) : '—'} · Semaine{' '}
          {product.weekPrice ? formatEUR(display(product.weekPrice)) : '—'} · Caution{' '}
          {formatEUR(product.deposit)}
        </p>
      )}

      {sortedTiers.length > 0 && (
        <div className="ppanel__tiers">
          {sortedTiers.map((t) => (
            <span
              key={t.minDays}
              className={`ppanel__tier${currentTier?.minDays === t.minDays ? ' is-active' : ''}`}
            >
              {t.minDays}j <strong>{formatEUR(display(t.perDay))}</strong>
            </span>
          ))}
        </div>
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

      <div style={{ margin: '12px 0' }}>
        <AvailabilityBadge a={avail} />
      </div>

      <div className="field" style={{ maxWidth: 120 }}>
        <label>Quantité</label>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
        />
      </div>

      {linked.length > 0 && (
        <div style={{ margin: '14px 0' }}>
          <strong style={{ color: 'var(--loc)', fontSize: '0.9rem' }}>
            Ajouter en un geste
          </strong>
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

      <button
        className="btn btn-primary btn-block"
        onClick={addAll}
        disabled={busy || avail?.status === 'UNAVAILABLE'}
      >
        {busy ? '…' : 'Ajouter au panier'}
      </button>
      {msg && (
        <p className="small" style={{ marginTop: 8, color: 'var(--ok)' }}>
          {msg} <a href="/panier">Voir le panier →</a>
        </p>
      )}
      {!cart?.period && (
        <p className="small muted" style={{ marginTop: 8 }}>
          Aucune date choisie — vous pourrez les indiquer avant de valider le panier.
        </p>
      )}
    </div>
  );
}
