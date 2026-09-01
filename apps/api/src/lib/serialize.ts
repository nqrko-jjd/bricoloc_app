import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { availabilityFor } from './availability.js';

export type ProductWithRels = Prisma.ProductGetPayload<{
  include: {
    category: true;
    units: true;
    linksFrom: { include: { to: { include: { category: true } } } };
  };
}>;

export const productInclude = {
  category: true,
  units: true,
  linksFrom: { include: { to: { include: { category: true } } } },
} satisfies Prisma.ProductInclude;

function unitStock(p: ProductWithRels): number {
  if (p.stockQty !== null && p.stockQty !== undefined) return p.stockQty;
  return p.units.filter((u) => ['AVAILABLE', 'RENTED'].includes(u.state)).length;
}

export function serializeProductSummary(p: ProductWithRels) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    kind: p.kind,
    shortDescription: p.shortDescription,
    images: (p.images as string[]) ?? [],
    image: (p.images as string[])?.[0] ?? null,
    category: p.category
      ? { slug: p.category.slug, name: p.category.name, bolt: p.category.bolt }
      : null,
    dailyPrice: p.dailyPrice,
    weekendPrice: p.weekendPrice,
    weekPrice: p.weekPrice,
    deposit: p.deposit,
    isConsumable: p.isConsumable,
    isDemo: p.isDemo,
    totalStock: unitStock(p),
  };
}

export function serializeProductDetail(p: ProductWithRels) {
  const links = (type: string) =>
    p.linksFrom
      .filter((l) => l.type === type && l.to.published)
      .map((l) => ({
        id: l.to.id,
        slug: l.to.slug,
        name: l.to.name,
        kind: l.to.kind,
        quantity: l.quantity,
        dailyPrice: l.to.dailyPrice,
        deposit: l.to.deposit,
        image: (l.to.images as string[])?.[0] ?? null,
        isConsumable: l.to.isConsumable,
      }));
  return {
    ...serializeProductSummary(p),
    description: p.description,
    recommendedUses: (p.recommendedUses as string[]) ?? [],
    specs: (p.specs as Record<string, string>) ?? {},
    includedAccessories: (p.includedAccessories as string[]) ?? [],
    manualUrl: p.manualUrl,
    documents: (p.documents as { label: string; url: string }[]) ?? [],
    monthPrice: p.monthPrice,
    tiers: (p.tiers as { minDays: number; perDay: number }[]) ?? [],
    proDiscountPct: p.proDiscountPct,
    recommendedAccessories: links('ACCESSORY'),
    consumables: links('CONSUMABLE'),
    ppe: links('PPE'),
    complementary: links('COMPLEMENTARY'),
    packItems: links('PACK_ITEM'),
  };
}

/** Ajoute la disponibilite pour une periode donnee a une liste de produits serialises. */
export async function withAvailability<T extends { id: string }>(
  items: T[],
  period: { start: Date; end: Date } | null,
  requestedQty = 1,
): Promise<(T & { availability: Awaited<ReturnType<typeof availabilityFor>> | null })[]> {
  if (!period) return items.map((i) => ({ ...i, availability: null }));
  const out = [];
  for (const i of items) {
    out.push({
      ...i,
      availability: await availabilityFor(i.id, period.start, period.end, requestedQty),
    });
  }
  return out;
}

export async function similarProducts(productId: string, categoryId: string | null) {
  if (!categoryId) return [];
  const rows = await prisma.product.findMany({
    where: { categoryId, id: { not: productId }, published: true, kind: 'MACHINE' },
    include: productInclude,
    take: 4,
  });
  return rows.map(serializeProductSummary);
}
