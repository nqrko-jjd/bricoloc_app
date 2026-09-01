import { prisma } from '../db.js';

const GROUPS = ['ACCESSORY', 'CONSUMABLE', 'PPE', 'COMPLEMENTARY'] as const;
type Group = (typeof GROUPS)[number];

const LABELS: Record<Group, string> = {
  ACCESSORY: 'Accessoires nécessaires',
  CONSUMABLE: 'Consommables',
  PPE: 'Équipements de protection',
  COMPLEMENTARY: 'Machines complémentaires',
};

export interface RecommendationGroup {
  type: Group;
  label: string;
  products: unknown[];
}

/** Recommandations pour un panier : uniquement des liens metier reels (pas de bruit). */
export async function recommendationsFor(
  productIds: string[],
  excludeIds: string[] = [],
): Promise<RecommendationGroup[]> {
  if (productIds.length === 0) return [];
  const links = await prisma.productLink.findMany({
    where: { fromId: { in: productIds }, type: { in: GROUPS as unknown as string[] } },
    include: {
      to: {
        include: { category: true },
      },
    },
  });

  const exclude = new Set([...productIds, ...excludeIds]);
  const byGroup = new Map<Group, Map<string, unknown>>();
  for (const link of links) {
    if (exclude.has(link.toId)) continue;
    if (!link.to.published) continue;
    const g = link.type as Group;
    if (!byGroup.has(g)) byGroup.set(g, new Map());
    byGroup.get(g)!.set(link.toId, serialize(link.to));
  }

  const result: RecommendationGroup[] = [];
  for (const g of GROUPS) {
    const m = byGroup.get(g);
    if (m && m.size > 0) {
      result.push({ type: g, label: LABELS[g], products: [...m.values()] });
    }
  }

  // Packs contenant l'une des machines du panier.
  const packLinks = await prisma.productLink.findMany({
    where: { toId: { in: productIds }, type: 'PACK_ITEM' },
    include: { from: { include: { category: true } } },
  });
  const packs = new Map<string, unknown>();
  for (const pl of packLinks) {
    if (exclude.has(pl.fromId) || !pl.from.published) continue;
    packs.set(pl.fromId, serialize(pl.from));
  }
  if (packs.size > 0) {
    result.unshift({
      type: 'COMPLEMENTARY',
      label: 'Packs correspondant à votre chantier',
      products: [...packs.values()],
    });
  }

  return result;
}

function serialize(p: {
  id: string;
  slug: string;
  name: string;
  kind: string;
  shortDescription: string | null;
  images: unknown;
  dailyPrice: number;
  deposit: number;
  isConsumable: boolean;
  category?: { name: string; slug: string } | null;
}) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    kind: p.kind,
    shortDescription: p.shortDescription,
    image: Array.isArray(p.images) ? p.images[0] ?? null : null,
    dailyPrice: p.dailyPrice,
    deposit: p.deposit,
    isConsumable: p.isConsumable,
    category: p.category ? { name: p.category.name, slug: p.category.slug } : null,
  };
}
