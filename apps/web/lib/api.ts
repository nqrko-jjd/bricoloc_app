export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

export interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  cartKey?: string | null;
  cache?: RequestCache;
  next?: { revalidate?: number };
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.cartKey) headers['x-cart-key'] = opts.cartKey;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache ?? (opts.next ? undefined : 'no-store'),
    next: opts.next,
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      (json && (json.error?.message || json.message)) || `Erreur ${res.status}`;
    throw new ApiError(res.status, message, json);
  }
  return json as T;
}

/** Variante cote client : lit le token/cartKey depuis le navigateur. */
export function clientApi<T = unknown>(
  path: string,
  opts: Omit<ApiOptions, 'token' | 'cartKey'> & { auth?: 'user' | 'staff' | 'none' } = {},
): Promise<T> {
  const auth = opts.auth ?? 'user';
  const token =
    typeof window === 'undefined'
      ? null
      : auth === 'staff'
        ? localStorage.getItem('bricoloc_staff_token')
        : auth === 'user'
          ? localStorage.getItem('bricoloc_token')
          : null;
  const cartKey =
    typeof window === 'undefined' ? null : localStorage.getItem('bricoloc_cart_key');
  return api<T>(path, { ...opts, token, cartKey });
}
