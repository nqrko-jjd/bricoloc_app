import { api } from './api';

const KEY = 'bricoloc_kiosk_cart';

export function kioskCartKey(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem(KEY);
}

export async function ensureKioskCart(): Promise<string> {
  let key = kioskCartKey();
  if (!key) {
    const r = await api<{ cartKey: string }>('/api/cart/new', { method: 'POST' });
    key = r.cartKey;
    localStorage.setItem(KEY, key);
  }
  return key;
}

export function resetKioskSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  // Efface toute donnee personnelle saisie sur la borne.
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('bricoloc_kiosk')) localStorage.removeItem(k);
  }
}

export function kioskApi<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  return api<T>(path, { ...opts, cartKey: kioskCartKey() });
}
