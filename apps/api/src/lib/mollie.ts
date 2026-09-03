/**
 * Client Mollie minimal (REST v2, aucune dépendance).
 * Activé dès que `MOLLIE_API_KEY` est présent (clé `test_…` = mode test, pas de
 * vrai argent ; clé `live_…` = production). Sinon on reste en paiement mock.
 */
const KEY = process.env.MOLLIE_API_KEY?.trim() || '';
const BASE = 'https://api.mollie.com/v2';

export const mollieEnabled = (): boolean => KEY.length > 0;
export const mollieTestMode = (): boolean => KEY.startsWith('test_');

interface MollieAmount {
  currency: string;
  value: string; // "12.34"
}
export interface MolliePayment {
  id: string;
  status: 'open' | 'pending' | 'authorized' | 'paid' | 'canceled' | 'expired' | 'failed';
  amount: MollieAmount;
  description: string;
  metadata?: Record<string, unknown> | null;
  _links?: { checkout?: { href: string } };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json?.detail || json?.title || `Erreur Mollie ${res.status}`;
    throw new Error(`Mollie: ${detail}`);
  }
  return json as T;
}

const eur = (n: number): MollieAmount => ({ currency: 'EUR', value: n.toFixed(2) });

export function createPayment(opts: {
  amount: number;
  description: string;
  redirectUrl: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<MolliePayment> {
  return call<MolliePayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: eur(opts.amount),
      description: opts.description,
      redirectUrl: opts.redirectUrl,
      ...(opts.webhookUrl ? { webhookUrl: opts.webhookUrl } : {}),
      ...(opts.metadata ? { metadata: opts.metadata } : {}),
    }),
  });
}

export function getPayment(id: string): Promise<MolliePayment> {
  return call<MolliePayment>(`/payments/${encodeURIComponent(id)}`);
}

/** Remboursement total ou partiel (utilisé pour la caution encaissée-puis-rendue). */
export function createRefund(paymentId: string, amount: number, description = 'Remboursement'): Promise<unknown> {
  return call(`/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: 'POST',
    body: JSON.stringify({ amount: eur(amount), description }),
  });
}
