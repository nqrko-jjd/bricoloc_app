import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, CART_KEY, TOKEN_KEY } from './api';
import type { Cart, CurrentUser } from './types';
import { registerForPush } from './push';

interface Store {
  ready: boolean;
  user: CurrentUser | null;
  cart: Cart | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (t: string) => Promise<void>;
  reloadCart: () => Promise<void>;
  reloadUser: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  setQty: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  setPeriod: (p: { start: string; end: string } | null) => Promise<void>;
  setFulfilment: (body: Record<string, unknown>) => Promise<void>;
  applyPromo: (code: string) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);

  const reloadUser = useCallback(async () => {
    const t = await AsyncStorage.getItem(TOKEN_KEY);
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const r = await api<{ user: CurrentUser }>('/api/auth/me');
      setUser(r.user);
      registerForPush().catch(() => {});
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  const reloadCart = useCallback(async () => {
    let key = await AsyncStorage.getItem(CART_KEY);
    if (!key) {
      const r = await api<{ cartKey: string }>('/api/cart/new', { method: 'POST' });
      key = r.cartKey;
      await AsyncStorage.setItem(CART_KEY, key);
    }
    const c = await api<Cart>('/api/cart', { cartKey: key });
    setCart(c);
  }, []);

  useEffect(() => {
    (async () => {
      await reloadUser();
      await reloadCart().catch(() => {});
      setReady(true);
    })();
  }, [reloadUser, reloadCart]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api<{ token: string; user: CurrentUser }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      await AsyncStorage.setItem(TOKEN_KEY, r.token);
      setUser(r.user);
      await reloadCart();
      registerForPush().catch(() => {});
    },
    [reloadCart],
  );

  const register = useCallback(
    async (data: Record<string, unknown>) => {
      const r = await api<{ token: string; user: CurrentUser }>('/api/auth/register', {
        method: 'POST',
        body: data,
      });
      await AsyncStorage.setItem(TOKEN_KEY, r.token);
      setUser(r.user);
      await reloadCart();
      registerForPush().catch(() => {});
    },
    [reloadCart],
  );

  const setToken = useCallback(
    async (t: string) => {
      await AsyncStorage.setItem(TOKEN_KEY, t);
      await reloadUser();
      await reloadCart();
    },
    [reloadUser, reloadCart],
  );

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, CART_KEY]);
    setUser(null);
    setCart(null);
    await reloadCart();
  }, [reloadCart]);

  const mut = useCallback(async (fn: () => Promise<Cart>) => setCart(await fn()), []);

  const value = useMemo<Store>(
    () => ({
      ready,
      user,
      cart,
      login,
      register,
      logout,
      setToken,
      reloadCart,
      reloadUser,
      addItem: (productId, quantity = 1) =>
        mut(() => api<Cart>('/api/cart/items', { method: 'POST', body: { productId, quantity } })),
      setQty: (productId, quantity) =>
        mut(() =>
          api<Cart>(`/api/cart/items/${productId}`, { method: 'PATCH', body: { quantity } }),
        ),
      removeItem: (productId) =>
        mut(() => api<Cart>(`/api/cart/items/${productId}`, { method: 'DELETE' })),
      setPeriod: (p) =>
        mut(() => api<Cart>('/api/cart/period', { method: 'PUT', body: { period: p } })),
      setFulfilment: (body) =>
        mut(() => api<Cart>('/api/cart/fulfilment', { method: 'PUT', body })),
      applyPromo: (code) =>
        mut(() => api<Cart>('/api/cart/promo', { method: 'POST', body: { code } })),
    }),
    [ready, user, cart, login, register, logout, setToken, reloadCart, reloadUser, mut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore hors StoreProvider');
  return c;
}
