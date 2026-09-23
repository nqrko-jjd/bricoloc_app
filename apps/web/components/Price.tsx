'use client';
import { formatEUR } from '@bricoloc/shared';
import { usePriceDisplay } from '@/lib/usePriceDisplay';

/**
 * Affiche un prix stocké HT au bon tarif client : TVAC par défaut (loi belge —
 * prix affiché au grand public = TTC), HTVA pour les comptes PRO qui récupèrent
 * la TVA. Ne JAMAIS afficher `formatEUR(product.dailyPrice)` (ou toute autre
 * valeur HT) directement dans une page visible par un client — passer par ici.
 */
export function Price({
  amountHT,
  suffix,
  showVat = false,
  className,
}: {
  amountHT: number;
  /** Ajouté tel quel après le montant, ex. " / jour". */
  suffix?: string;
  /** Affiche "TVAC"/"HTVA" en petit à côté du montant. */
  showVat?: boolean;
  className?: string;
}) {
  const { display, isPro } = usePriceDisplay();
  return (
    <span className={className}>
      {formatEUR(display(amountHT))}
      {suffix}
      {showVat && <span className="small muted"> {isPro ? 'HTVA' : 'TVAC'}</span>}
    </span>
  );
}
