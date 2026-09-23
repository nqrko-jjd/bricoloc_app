import { useEffect, useState } from 'react';
import { api } from './api';
import { useStore } from './store';

let cachedVatRate: Promise<number> | null = null;

/** Charge le taux de TVA une seule fois pour toute l'appli (mémoïsé, comme le hook web équivalent). */
function loadVatRate(): Promise<number> {
  if (!cachedVatRate) {
    cachedVatRate = api<{ vatRate: number }>('/api/public/config')
      .then((c) => c.vatRate)
      .catch((e) => {
        cachedVatRate = null;
        throw e;
      });
  }
  return cachedVatRate;
}

/**
 * TTC par défaut pour tout le monde, HTVA uniquement pour les comptes PRO
 * (qui récupèrent la TVA — c'est le prix hors taxe qui les intéresse).
 * Équivalent mobile de `apps/web/lib/usePriceDisplay.ts`.
 */
export function usePriceDisplay() {
  const { user } = useStore();
  const [vatRate, setVatRate] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadVatRate()
      .then((r) => alive && setVatRate(r))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const isPro = user?.customerType === 'PRO';
  const rate = vatRate ?? 0.21;

  return {
    isPro,
    vatRate: rate,
    display: (amountHT: number) => (isPro ? amountHT : amountHT * (1 + rate)),
  };
}
