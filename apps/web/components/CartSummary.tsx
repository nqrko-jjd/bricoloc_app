'use client';
import { formatEUR } from '@bricoloc/shared';
import type { Quote } from '@/lib/types';

export function CartSummary({ quote, title = 'Récapitulatif' }: { quote: Quote | null; title?: string }) {
  if (!quote) {
    return (
      <div className="card card-pad summary">
        <h3>{title}</h3>
        <p className="small muted">
          Indiquez vos dates pour calculer le prix de location, les réductions longue durée et
          la TVA.
        </p>
      </div>
    );
  }
  const t = quote.totals;
  return (
    <div className="card card-pad summary">
      <h3>{title}</h3>
      <div className="line">
        <span>Location HTVA</span>
        <span>{formatEUR(t.rentalHT)}</span>
      </div>
      {t.discountHT > 0 && (
        <div className="line" style={{ color: 'var(--ok)' }}>
          <span>Remise {quote.promoLabel ?? ''}</span>
          <span>- {formatEUR(t.discountHT)}</span>
        </div>
      )}
      {t.deliveryFeeHT > 0 && (
        <div className="line">
          <span>Livraison HTVA</span>
          <span>{formatEUR(t.deliveryFeeHT)}</span>
        </div>
      )}
      {quote.deliveryReason && (
        <p className="small muted" style={{ margin: 0 }}>
          {quote.deliveryReason}
        </p>
      )}
      <div className="line">
        <span>Total HTVA</span>
        <span>{formatEUR(t.totalHT)}</span>
      </div>
      <div className="line">
        <span>TVA {Math.round(t.vatRate * 100)} %</span>
        <span>{formatEUR(t.vatAmount)}</span>
      </div>
      <div className="line total">
        <span>Total TVAC</span>
        <span>{formatEUR(t.totalTVAC)}</span>
      </div>
      <div className="line deposit">
        <span>Caution (restituée)</span>
        <span>{formatEUR(t.depositsTotal)}</span>
      </div>
      <div className="line" style={{ fontWeight: 700 }}>
        <span>À régler maintenant</span>
        <span>{formatEUR(t.amountDue)}</span>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Tarifs de démonstration — fictifs.
      </p>
    </div>
  );
}
