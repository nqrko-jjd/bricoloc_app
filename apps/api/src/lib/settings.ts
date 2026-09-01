import { DEFAULT_SETTINGS, type PricingSettings } from '@bricoloc/shared';
import { prisma } from '../db.js';

export type AppSettings = typeof DEFAULT_SETTINGS & Record<string, unknown>;

let cache: AppSettings | null = null;
let cacheAt = 0;
const TTL = 5_000;

/** Fusionne les DEFAULT_SETTINGS avec les overrides stockes en base. */
export async function getSettings(force = false): Promise<AppSettings> {
  if (!force && cache && Date.now() - cacheAt < TTL) return cache;
  const rows = await prisma.setting.findMany();
  const overrides: Record<string, unknown> = {};
  for (const r of rows) overrides[r.key] = r.value as unknown;
  cache = { ...DEFAULT_SETTINGS, ...overrides } as AppSettings;
  cacheAt = Date.now();
  return cache;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
  cache = null;
}

export function pricingSettings(s: AppSettings): PricingSettings {
  return {
    sameDayCutoffHour: Number(s.sameDayCutoffHour ?? 18),
    weekendRuleEnabled: Boolean(s.weekendRuleEnabled ?? true),
    weekendReturnGraceHour: Number(s.weekendReturnGraceHour ?? 10),
    proDiscountPctDefault: Number(s.proDiscountPctDefault ?? 0.1),
  };
}

export function vatRate(s: AppSettings): number {
  return Number(s.vatRate ?? 0.21);
}
