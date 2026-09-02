'use client';
import { useEffect, useState } from 'react';
import { formatEUR } from '@bricoloc/shared';
import { api } from '@/lib/api';
import type { Availability, ProductDetail } from '@/lib/types';
import { useCart } from '@/lib/providers';
import { AvailabilityBadge } from './AvailabilityBadge';

export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const { cart, addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [avail, setAvail] = useState<Availability | null>(product.availability ?? null);
  const [extras, setExtras] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="card card-pad summary">
      <div className="price" style={{ fontSize: '1.6rem' }}>
        {formatEUR(product.dailyPrice)}{' '}
        <small>/ {product.isConsumable ? 'unité' : 'jour'}</small>
      </div>
      {!product.isConsumable && (
        <p className="small muted">
          Week-end {product.weekendPrice ? formatEUR(product.weekendPrice) : '—'} · Semaine{' '}
          {product.weekPrice ? formatEUR(product.weekPrice) : '—'} · Caution{' '}
          {formatEUR(product.deposit)}
        </p>
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
                    ({l.group} · {formatEUR(l.dailyPrice)})
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

      {product.tiers.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong style={{ color: 'var(--loc)', fontSize: '0.9rem' }}>Tarifs dégressifs</strong>
          <table className="table" style={{ marginTop: 6 }}>
            <tbody>
              {product.tiers.map((t) => (
                <tr key={t.minDays}>
                  <td>Dès {t.minDays} j</td>
                  <td>{formatEUR(t.perDay)} / jour</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
