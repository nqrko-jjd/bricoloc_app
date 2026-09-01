import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentLocale } from './i18n';

/**
 * URL de l'API BRICOLOC.
 * Priorite :
 *  1. EXPO_PUBLIC_API_URL (variable d'env explicite)
 *  2. En dev via Expo Go : l'IP LAN de la machine qui lance Metro (auto-detectee),
 *     port 4000  ->  fonctionne tel quel sur un vrai telephone.
 *  3. app.json > expo.extra.apiUrl
 *  4. http://localhost:4000 (simulateur / dernier recours)
 */
const API_PORT = 4000;

function devLanHost(): string | undefined {
  // Expo expose l'hote de dev sous la forme "192.168.1.27:8081"
  const raw =
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  const host = raw?.split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') return undefined;
  return host;
}

const configuredApiUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (devLanHost() ? `http://${devLanHost()}:${API_PORT}` : undefined) ||
  (configuredApiUrl && configuredApiUrl !== 'http://localhost:4000' ? configuredApiUrl : undefined) ||
  'http://localhost:4000';

// eslint-disable-next-line no-console
if (__DEV__) console.log('[BRICOLOC] API_URL =', API_URL);

export const TOKEN_KEY = 'bricoloc_token';
export const CART_KEY = 'bricoloc_cart_key';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface Opts {
  method?: string;
  body?: unknown;
  token?: string | null;
  cartKey?: string | null;
}

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = opts.token ?? (await AsyncStorage.getItem(TOKEN_KEY));
  const cartKey = opts.cartKey ?? (await AsyncStorage.getItem(CART_KEY));
  if (token) headers.authorization = `Bearer ${token}`;
  if (cartKey) headers['x-cart-key'] = cartKey;

  // Ajoute ?locale= sur les GET du catalogue (contenus traduits par l'API).
  let url = `${API_URL}${path}`;
  if ((opts.method ?? 'GET') === 'GET' && /\/api\/(catalog|products|public\/content)/.test(path) && !/[?&]locale=/.test(path)) {
    url += `${path.includes('?') ? '&' : '?'}locale=${currentLocale()}`;
  }

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.message || json?.message || `Erreur ${res.status}`);
  }
  return json as T;
}
