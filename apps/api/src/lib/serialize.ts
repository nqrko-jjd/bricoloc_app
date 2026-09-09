import type { Prisma } from '@prisma/client';
import { pickText, type I18nText, type Locale, SOURCE_LOCALE } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { availabilityFor } from './availability.js';

/**
 * Résout les champs texte d'un produit/catégorie pour une langue.
 * Le champ scalaire (FR) reste la source ; `i18n` porte NL/EN.
 */
function loc(
  scalar: string | null | undefined,
  i18n: unknown,
  field: string,
  locale: Locale,
): string | null {
  if (locale === SOURCE_LOCALE) return scalar ?? null;
  const bag = (i18n as Record<string, I18nText> | null | undefined)?.[field];
  const v = pickText(bag, locale, SOURCE_LOCALE);
  return v || scalar || null;
}

export type ProductWithRels = Prisma.ProductGetPayload<{
  include: {
    category: true;
    units: true;
    linksFrom: { include: { to: { include: { category: true } } } };
    variants: { include: { units: true } };
    parentProduct: true;
  };
}>;

export const productInclude = {
  category: true,
  units: true,
  linksFrom: { include: { to: { include: { category: true } } } },
  // Fiches techniques rattachees (jamais montrees au client, back-office
  // seulement — cf. serializeProductDetail `internal`).
  variants: { include: { units: true } },
  parentProduct: true,
} satisfies Prisma.ProductInclude;

function unitStock(p: ProductWithRels): number {
  if (p.stockQty !== null && p.stockQty !== undefined) return p.stockQty;
  // Le stock d'une fiche vitrine = ses propres exemplaires + ceux de toutes
  // ses fiches techniques rattachées (cf. Product.parentProductId).
  const own = p.units.filter((u) => ['AVAILABLE', 'RENTED'].includes(u.state)).length;
  const fromVariants = p.variants.reduce(
    (sum, v) => sum + v.units.filter((u) => ['AVAILABLE', 'RENTED'].includes(u.state)).length,
    0,
  );
  return own + fromVariants;
}

export function serializeProductSummary(p: ProductWithRels, locale: Locale = SOURCE_LOCALE) {
  return {
    id: p.id,
    slug: p.slug,
    name: loc(p.name, p.i18n, 'name', locale) ?? p.name,
    kind: p.kind,
    brand: p.brand,
    supplier: p.supplier,
    shortDescription: loc(p.shortDescription, p.i18n, 'shortDescription', locale),
    images: (p.images as string[]) ?? [],
    image: (p.images as string[])?.[0] ?? null,
    category: p.category
      ? {
          slug: p.category.slug,
          name: loc(p.category.name, p.category.i18n, 'name', locale) ?? p.category.name,
          bolt: p.category.bolt,
        }
      : null,
    dailyPrice: p.dailyPrice,
    weekendPrice: p.weekendPrice,
    weekPrice: p.weekPrice,
    deposit: p.deposit,
    isConsumable: p.isConsumable,
    isDemo: p.isDemo,
    isNew: p.isNew,
    availabilityMode: p.availabilityMode,
    deliveryPolicy: p.deliveryPolicy,
    totalStock: unitStock(p),
  };
}

export function serializeProductDetail(
  p: ProductWithRels,
  locale: Locale = SOURCE_LOCALE,
  rating: { avg: number; count: number } = { avg: 0, count: 0 },
  opts: { internal?: boolean } = {},
) {
  // Provenance / réf. / prix d'achat des consommables : interne uniquement (back-office).
  const internal = opts.internal === true;
  const links = (type: string) =>
    p.linksFrom
      // Les consommables / EPI / accessoires « adaptés » sont des références
      // (à acheter chez un fournisseur), pas des articles de location publiés :
      // on ne leur impose pas `published`. Packs & produits complémentaires si.
      .filter(
        (l) =>
          l.type === type &&
          (l.to.published || ['CONSUMABLE', 'PPE', 'ACCESSORY'].includes(type)),
      )
      .map((l) => ({
        id: l.to.id,
        slug: l.to.slug,
        name: loc(l.to.name, l.to.i18n, 'name', locale) ?? l.to.name,
        kind: l.to.kind,
        quantity: l.quantity,
        dailyPrice: l.to.dailyPrice,
        weekPrice: l.to.weekPrice,
        monthPrice: l.to.monthPrice,
        deposit: l.to.deposit,
        image: (l.to.images as string[])?.[0] ?? null,
        isConsumable: l.to.isConsumable,
        brand: l.to.brand,
        shortDescription: loc(l.to.shortDescription, l.to.i18n, 'shortDescription', locale),
        // Référence + revendeur + prix d'achat : back-office seulement.
        ...(internal
          ? {
              supplierRef: l.to.supplierRef,
              supplierUrl: l.to.supplierUrl,
              supplierListPrice: l.to.supplierListPrice,
              partSupplier: l.to.partSupplier,
            }
          : {}),
      }));
  const seo = (p.seo as { title?: I18nText; description?: I18nText } | null) ?? {};
  return {
    ...serializeProductSummary(p, locale),
    description: loc(p.description, p.i18n, 'description', locale),
    recommendedUses: (p.recommendedUses as string[]) ?? [],
    specs: (p.specs as Record<string, string>) ?? {},
    includedAccessories: (p.includedAccessories as string[]) ?? [],
    manualUrl: p.manualUrl,
    documents: (p.documents as { label: string; url: string }[]) ?? [],
    monthPrice: p.monthPrice,
    tiers: (p.tiers as { minDays: number; perDay: number }[]) ?? [],
    proDiscountPct: p.proDiscountPct,
    model: p.model,
    supplierRef: p.supplier === 'LOISELET' ? p.supplierRef : null,
    weightKg: p.weightKg,
    bulky: p.bulky,
    seo: {
      title: pickText(seo.title, locale, SOURCE_LOCALE) || null,
      description: pickText(seo.description, locale, SOURCE_LOCALE) || null,
    },
    rating,
    recommendedAccessories: links('ACCESSORY'),
    consumables: links('CONSUMABLE'),
    ppe: links('PPE'),
    complementary: links('COMPLEMENTARY'),
    packItems: links('PACK_ITEM'),
    // Champs internes (back-office) : provenance, réf. et prix d'achat.
    ...(internal
      ? {
          published: p.published,
          stockQty: p.stockQty,
          partSupplier: p.partSupplier,
          supplierUrl: p.supplierUrl,
          supplierRef: p.supplierRef,
          supplierListPrice: p.supplierListPrice,
          purchasePrice: p.purchasePrice,
          internalRef: p.internalRef,
          // Machine externe (louée chez un partenaire) : supplier != "BRICOLOC".
          supplier: p.supplier,
          availabilityMode: p.availabilityMode,
          partnerCostPerDay: p.partnerCostPerDay,
          partnerRef: p.partnerRef,
          partnerUrl: p.partnerUrl,
          partnerWebsite: p.partnerWebsite,
          suppliers:
            (p.suppliers as
              | { name?: string; ref?: string; url?: string; listPrice?: number | null; purchasePrice?: number | null }[]
              | null) ?? [],
          // Fiches techniques : cf. Product.parentProductId (schema.prisma).
          parentProductId: p.parentProductId,
          technical: p.technical,
          parentProduct: p.parentProduct
            ? { id: p.parentProduct.id, slug: p.parentProduct.slug, name: p.parentProduct.name }
            : null,
          variants: p.variants.map((v) => ({
            id: v.id,
            slug: v.slug,
            name: v.name,
            brand: v.brand,
            model: v.model,
            internalRef: v.internalRef,
            supplier: v.supplier,
            availabilityMode: v.availabilityMode,
            partnerRef: v.partnerRef,
            partnerUrl: v.partnerUrl,
            published: v.published,
            image: (v.images as string[])?.[0] ?? null,
            unitsCount: v.units.length,
            availableCount: v.units.filter((u) => u.state === 'AVAILABLE').length,
          })),
        }
      : {}),
  };
}

/** Note moyenne + nombre d'avis publiés, groupés par produit. */
export async function ratingsFor(productIds: string[]): Promise<Map<string, { avg: number; count: number }>> {
  const rows = await prisma.review.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds }, status: 'PUBLISHED' },
    _avg: { rating: true },
    _count: true,
  });
  const map = new Map<string, { avg: number; count: number }>();
  for (const r of rows) {
    map.set(r.productId, {
      avg: Math.round((r._avg.rating ?? 0) * 10) / 10,
      count: r._count,
    });
  }
  return map;
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

export async function similarProducts(
  productId: string,
  categoryId: string | null,
  locale: Locale = SOURCE_LOCALE,
) {
  if (!categoryId) return [];
  const rows = await prisma.product.findMany({
    where: { categoryId, id: { not: productId }, published: true, kind: 'MACHINE' },
    include: productInclude,
    take: 4,
  });
  return rows.map((r) => serializeProductSummary(r, locale));
}
