'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, clientApi } from './api';
import type { Cart, CurrentUser } from './types';

/* ----------------------------- Session ----------------------------- */
interface SessionCtx {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => void;
  setToken: (token: string) => Promise<void>;
  refresh: () => Promise<void>;
}
const SessionContext = createContext<SessionCtx | null>(null);

/* ------------------------------ Cart ------------------------------ */
interface CartCtx {
  cart: Cart | null;
  loading: boolean;
  cartKey: string | null;
  reload: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  setQty: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  setPeriod: (period: { start: string; end: string } | null) => Promise<void>;
  setFulfilment: (body: Record<string, unknown>) => Promise<void>;
  applyPromo: (code: string) => Promise<void>;
  clearPromo: () => Promise<void>;
}
const CartContext = createContext<CartCtx | null>(null);

const TOKEN_KEY = 'bricoloc_token';
const CART_KEY = 'bricoloc_cart_key';

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartKey, setCartKey] = useState<string | null>(null);

  const token = () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY));

  const refreshUser = useCallback(async () => {
    const t = token();
    if (!t) {
      setUser(null);
      setSessionLoading(false);
      return;
    }
    try {
      const res = await api<{ user: CurrentUser }>('/api/auth/me', { token: t });
      setUser(res.user);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const reloadCart = useCallback(async () => {
    let key = typeof window !== 'undefined' ? localStorage.getItem(CART_KEY) : null;
    try {
      if (!key) {
        const created = await api<{ cartKey: string }>('/api/cart/new', {
          method: 'POST',
          token: token(),
        });
        key = created.cartKey;
        localStorage.setItem(CART_KEY, key);
      }
      setCartKey(key);
      const c = await api<Cart>('/api/cart', { cartKey: key, token: token() });
      setCart(c);
    } catch {
      /* garde l'etat precedent */
    } finally {
      setCartLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    reloadCart();
  }, [refreshUser, reloadCart]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ token: string; user: CurrentUser }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      localStorage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);
      await reloadCart();
    },
    [reloadCart],
  );

  const register = useCallback(
    async (data: Record<string, unknown>) => {
      const res = await api<{ token: string; user: CurrentUser }>('/api/auth/register', {
        method: 'POST',
        body: data,
      });
      localStorage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);
      await reloadCart();
    },
    [reloadCart],
  );

  const setToken = useCallback(
    async (t: string) => {
      localStorage.setItem(TOKEN_KEY, t);
      await refreshUser();
      await reloadCart();
    },
    [refreshUser, reloadCart],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CART_KEY);
    setUser(null);
    setCart(null);
    reloadCart();
  }, [reloadCart]);

  const mutateCart = useCallback(
    async (fn: () => Promise<Cart>) => {
      const c = await fn();
      setCart(c);
    },
    [],
  );

  const cartApi = useMemo<CartCtx>(
    () => ({
      cart,
      loading: cartLoading,
      cartKey,
      reload: reloadCart,
      addItem: (productId, quantity = 1) =>
        mutateCart(() =>
          clientApi<Cart>('/api/cart/items', {
            method: 'POST',
            body: { productId, quantity },
          }),
        ),
      setQty: (productId, quantity) =>
        mutateCart(() =>
          clientApi<Cart>(`/api/cart/items/${productId}`, {
            method: 'PATCH',
            body: { quantity },
          }),
        ),
      removeItem: (productId) =>
        mutateCart(() =>
          clientApi<Cart>(`/api/cart/items/${productId}`, { method: 'DELETE' }),
        ),
      setPeriod: (period) =>
        mutateCart(() =>
          clientApi<Cart>('/api/cart/period', { method: 'PUT', body: { period } }),
        ),
      setFulfilment: (body) =>
        mutateCart(() =>
          clientApi<Cart>('/api/cart/fulfilment', { method: 'PUT', body }),
        ),
      applyPromo: (code) =>
        mutateCart(() =>
          clientApi<Cart>('/api/cart/promo', { method: 'POST', body: { code } }),
        ),
      clearPromo: () =>
        mutateCart(() => clientApi<Cart>('/api/cart/promo', { method: 'DELETE' })),
    }),
    [cart, cartLoading, cartKey, reloadCart, mutateCart],
  );

  const sessionApi = useMemo<SessionCtx>(
    () => ({
      user,
      loading: sessionLoading,
      login,
      register,
      logout,
      setToken,
      refresh: refreshUser,
    }),
    [user, sessionLoading, login, register, logout, setToken, refreshUser],
  );

  return (
    <SessionContext.Provider value={sessionApi}>
      <CartContext.Provider value={cartApi}>{children}</CartContext.Provider>
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession hors Providers');
  return ctx;
}
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart hors Providers');
  return ctx;
}
