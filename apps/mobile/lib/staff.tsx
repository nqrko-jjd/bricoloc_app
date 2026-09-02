import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const STAFF_TOKEN = 'bricoloc_staff_token';

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface StaffCtx {
  staff: Staff | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<StaffCtx | null>(null);

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const t = await AsyncStorage.getItem(STAFF_TOKEN);
    if (!t) {
      setStaff(null);
      setReady(true);
      return;
    }
    try {
      const r = await api<{ staff: Staff }>('/api/auth/staff/me', { token: t });
      setStaff(r.staff);
    } catch {
      await AsyncStorage.removeItem(STAFF_TOKEN);
      setStaff(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; staff: Staff }>('/api/auth/staff/login', {
      method: 'POST',
      body: { email, password },
      token: null,
    });
    await AsyncStorage.setItem(STAFF_TOKEN, r.token);
    setStaff(r.staff);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STAFF_TOKEN);
    setStaff(null);
  }, []);

  return <Ctx.Provider value={{ staff, ready, login, logout }}>{children}</Ctx.Provider>;
}

export function useStaff() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStaff hors StaffProvider');
  return c;
}

/** Appel API authentifié équipe (jeton staff, jamais le jeton client). */
export async function staffApi<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await AsyncStorage.getItem(STAFF_TOKEN);
  return api<T>(path, { ...opts, token });
}
