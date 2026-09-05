'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useSession } from './providers';

/**
 * TTC par défaut pour tout le monde, HTVA uniquement pour les comptes PRO
 * (qui récupèrent la TVA — c'est le prix hors taxe qui les intéresse).
 */
export function usePriceDisplay() {
  const { user } = useSession();
  const [vatRate, setVatRate] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ vatRate: number }>('/api/public/config')
      .then((c) => {
        if (!cancelled) setVatRate(c.vatRate);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
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
