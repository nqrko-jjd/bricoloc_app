'use client';
import { useConfig } from './useConfig';
import { useSession } from './providers';

/**
 * TTC par défaut pour tout le monde, HTVA uniquement pour les comptes PRO
 * (qui récupèrent la TVA — c'est le prix hors taxe qui les intéresse).
 * `useConfig()` dédoublonne l'appel réseau : un seul fetch même si des
 * dizaines de cartes produit l'utilisent sur la même page.
 */
export function usePriceDisplay() {
  const { user } = useSession();
  const config = useConfig();

  const isPro = user?.customerType === 'PRO';
  const rate = config?.vatRate ?? 0.21;

  return {
    isPro,
    vatRate: rate,
    display: (amountHT: number) => (isPro ? amountHT : amountHT * (1 + rate)),
  };
}
