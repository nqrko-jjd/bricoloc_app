'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  token: () => string | null;
}
const Ctx = createContext<StaffCtx | null>(null);

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  const token = () => (typeof window === 'undefined' ? null : localStorage.getItem(STAFF_TOKEN));

  const refresh = useCallback(async () => {
    const t = token();
    if (!t) {
      setStaff(null);
      setLoading(false);
      return;
    }
    try {
      const r = await api<{ staff: Staff }>('/api/auth/staff/me', { token: t });
      setStaff(r.staff);
    } catch {
      localStorage.removeItem(STAFF_TOKEN);
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; staff: Staff }>('/api/auth/staff/login', {
      method: 'POST',
      body: { email, password },
    });
    localStorage.setItem(STAFF_TOKEN, r.token);
    setStaff(r.staff);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STAFF_TOKEN);
    setStaff(null);
  }, []);

  return (
    <Ctx.Provider value={{ staff, loading, login, logout, token }}>{children}</Ctx.Provider>
  );
}

export function useStaff() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStaff hors StaffProvider');
  return ctx;
}

/** Appel API authentifie equipe. */
export function staffApi<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token =
    typeof window === 'undefined' ? null : localStorage.getItem(STAFF_TOKEN);
  return api<T>(path, { ...opts, token });
}
