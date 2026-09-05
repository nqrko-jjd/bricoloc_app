import { DEFAULT_SETTINGS, type PricingSettings } from '@bricoloc/shared';
import { prisma } from '../db.js';

export type AppSettings = typeof DEFAULT_SETTINGS & Record<string, unknown>;

let cache: AppSettings | null = null;
let cacheAt = 0;
const TTL = 5_000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Fusionne les DEFAULT_SETTINGS avec les overrides stockes en base.
 * Merge sur un niveau pour les valeurs objet (ex. `delivery`) : un override
 * partiel (ex. sauvegarde d'un seul champ) ne doit jamais faire disparaitre
 * les autres champs par defaut — sinon la page qui lit `settings.delivery.mode`
 * plante ou affiche des valeurs manquantes des qu'un champ n'a jamais ete
 * explicitement enregistre. */
export async function getSettings(force = false): Promise<AppSettings> {
  if (!force && cache && Date.now() - cacheAt < TTL) return cache;
  const rows = await prisma.setting.findMany();
  const overrides: Record<string, unknown> = {};
  for (const r of rows) overrides[r.key] = r.value as unknown;
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [key, value] of Object.entries(overrides)) {
    const base = (DEFAULT_SETTINGS as Record<string, unknown>)[key];
    merged[key] = isPlainObject(base) && isPlainObject(value) ? { ...base, ...value } : value;
  }
  cache = merged as AppSettings;
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
