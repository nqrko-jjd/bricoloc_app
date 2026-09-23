'use client';
import { formatEUR } from '@bricoloc/shared';
import type { Quote } from '@/lib/types';

export function CartSummary({ quote, title = 'Récapitulatif' }: { quote: Quote | null; title?: string }) {
  if (!quote) {
    return (
      <div className="card card-pad summary card--flat">
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
    <div className="card card-pad summary card--flat">
      <h3>{title}</h3>
      <div className="line">
        <span>Location HTVA</span>
        <span>{formatEUR(t.rentalHT)}</span>
      </div>
      {(t.composedPackDiscountHT ?? 0) > 0 && (
        <div className="line" style={{ color: 'var(--ok)' }}>
          <span>
            Pack composé
            {quote.composedPack ? ` · ${quote.composedPack.machineCount} machines` : ''}
            {t.composedPackPct ? ` (−${Math.round(t.composedPackPct * 100)} %)` : ''}
          </span>
          <span>- {formatEUR(t.composedPackDiscountHT!)}</span>
        </div>
      )}
      {(t.promoDiscountHT ?? (t.discountHT - (t.composedPackDiscountHT ?? 0))) > 0 && (
        <div className="line" style={{ color: 'var(--ok)' }}>
          <span>Code promo {quote.promoLabel ?? ''}</span>
          <span>
            - {formatEUR(t.promoDiscountHT ?? t.discountHT - (t.composedPackDiscountHT ?? 0))}
          </span>
        </div>
      )}
      {quote.composedPack?.next && (
        <p className="small" style={{ margin: '2px 0 6px', color: 'var(--primary)', fontWeight: 700 }}>
          + {quote.composedPack.next.minMachines - quote.composedPack.machineCount} machine
          {quote.composedPack.next.minMachines - quote.composedPack.machineCount > 1 ? 's' : ''} → −
          {Math.round(quote.composedPack.next.pct * 100)} %
        </p>
      )}
      {quote.deliveryQuote ? (
        <>
          <div className="line">
            <span>Livraison + reprise standard</span>
            <span>{formatEUR(quote.deliveryQuote.breakdown.standardPriceTVAC)} TVAC</span>
          </div>
          {quote.deliveryQuote.breakdown.premiumFeeTVAC > 0 && (
            <div className="line">
              <span>
                Supplément premium
                {quote.deliveryQuote.premiumOut && quote.deliveryQuote.premiumReturn
                  ? ' (aller + retour)'
                  : quote.deliveryQuote.premiumOut
                    ? ' (aller)'
                    : ' (retour)'}
              </span>
              <span>{formatEUR(quote.deliveryQuote.breakdown.premiumFeeTVAC)} TVAC</span>
            </div>
          )}
          {quote.deliveryQuote.breakdown.saturdaySurchargeTVAC > 0 && (
            <div className="line">
              <span>Supplément samedi</span>
              <span>{formatEUR(quote.deliveryQuote.breakdown.saturdaySurchargeTVAC)} TVAC</span>
            </div>
          )}
          <div className="line" style={{ fontWeight: 700 }}>
            <span>Total transport TVAC</span>
            <span>{formatEUR(quote.deliveryQuote.breakdown.finalPriceTVAC)}</span>
          </div>
          {quote.deliveryQuote.breakdown.minApplied && (
            <p className="small muted" style={{ margin: 0 }}>
              Minimum de livraison appliqué.
            </p>
          )}
        </>
      ) : (
        t.deliveryFeeHT > 0 && (
          <div className="line">
            <span>Livraison HTVA</span>
            <span>{formatEUR(t.deliveryFeeHT)}</span>
          </div>
        )
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
