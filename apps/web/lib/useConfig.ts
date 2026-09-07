'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { PublicConfig } from './types';

/** Charge `/api/public/config` une seule fois pour toute la page. */
let cached: Promise<PublicConfig> | null = null;

export function loadConfig(): Promise<PublicConfig> {
  if (!cached) {
    cached = api<PublicConfig>('/api/public/config').catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

export function useConfig(): PublicConfig | null {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  useEffect(() => {
    let alive = true;
    loadConfig()
      .then((c) => alive && setConfig(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
