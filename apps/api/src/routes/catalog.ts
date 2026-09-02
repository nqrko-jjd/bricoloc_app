import { Router } from 'express';
import { catalogQuerySchema, isLocale, type Locale } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { h, notFound } from '../lib/http.js';
import {
  productInclude,
  ratingsFor,
  serializeProductDetail,
  serializeProductSummary,
  similarProducts,
  withAvailability,
} from '../lib/serialize.js';

const qLocale = (req: { query: Record<string, unknown> }): Locale =>
  isLocale(req.query.locale) ? req.query.locale : 'fr';

export const catalogRouter = Router();

catalogRouter.get(
  '/categories',
  h(async (req, res) => {
    const locale = qLocale(req);
    const cats = await prisma.category.findMany({ orderBy: { position: 'asc' } });
    const counts = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { published: true },
      _count: true,
    });
    res.json({
      categories: cats.map((c) => {
        const i18n = c.i18n as Record<string, { nl?: string; en?: string }> | null;
        const name =
          locale !== 'fr' && i18n?.name?.[locale] ? i18n.name[locale]! : c.name;
        const description =
          locale !== 'fr' && i18n?.description?.[locale] ? i18n.description[locale]! : c.description;
        return {
          id: c.id,
          slug: c.slug,
          name,
          description,
          bolt: c.bolt,
          image: c.image,
          icon: c.icon,
          position: c.position,
          productCount: counts.find((x) => x.categoryId === c.id)?._count ?? 0,
        };
      }),
    });
  }),
);

catalogRouter.get(
  '/products',
  h(async (req, res) => {
    const q = catalogQuerySchema.parse(req.query);
    const period =
      q.start && q.end ? { start: new Date(q.start), end: new Date(q.end) } : null;

    const where: Record<string, unknown> = { published: true };
    if (q.kind) where.kind = q.kind;
    if (q.category) where.category = { slug: q.category };
    if (q.q) {
      where.OR = [
        { name: { contains: q.q } },
        { shortDescription: { contains: q.q } },
        { description: { contains: q.q } },
      ];
    }

    const orderBy =
      q.sort === 'price_asc'
        ? { dailyPrice: 'asc' as const }
        : q.sort === 'price_desc'
          ? { dailyPrice: 'desc' as const }
          : q.sort === 'name'
            ? { name: 'asc' as const }
            : { createdAt: 'desc' as const };

    const total = await prisma.product.count({ where });
    const rows = await prisma.product.findMany({
      where,
      include: productInclude,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });

    const ratings = await ratingsFor(rows.map((r) => r.id));
    let items = rows.map((r) => ({
      ...serializeProductSummary(r, q.locale),
      rating: ratings.get(r.id) ?? null,
    }));
    let withAvail = await withAvailability(items, period);

    // Filtre "disponible sur toute la periode" quand des dates sont fournies.
    if (period && req.query.onlyAvailable === 'true') {
      withAvail = withAvail.filter((p) => p.availability?.status === 'AVAILABLE');
    }

    res.json({
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
      period: period
        ? { start: period.start.toISOString(), end: period.end.toISOString() }
        : null,
      products: withAvail,
    });
  }),
);

/**
 * Suggestions pour la barre de recherche.
 *  - avec `q` (≥ 2 car.) : produits + catégories qui correspondent
 *  - sans `q` : les outils les plus loués (« souvent utilisés »)
 */
catalogRouter.get(
  '/suggest',
  h(async (req, res) => {
    const locale = qLocale(req);
    const raw = String(req.query.q ?? '').trim();
    const q = raw.slice(0, 60);

    if (q.length < 2) {
      // Top produits par nombre de lignes de réservation (fallback : avis puis récence).
      const grouped = await prisma.reservationItem.groupBy({
        by: ['productId'],
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 12,
      });
      let rows = grouped.length
        ? await prisma.product.findMany({
            where: { id: { in: grouped.map((g) => g.productId) }, published: true, kind: { not: 'CONSUMABLE' } },
            include: productInclude,
          })
        : [];
      if (rows.length < 6) {
        const extra = await prisma.product.findMany({
          where: {
            published: true,
            kind: 'MACHINE',
            id: { notIn: rows.map((r) => r.id) },
          },
          include: productInclude,
          orderBy: { createdAt: 'desc' },
          take: 8,
        });
        rows = [...rows, ...extra];
      }
      const order = new Map(grouped.map((g, i) => [g.productId, i]));
      rows.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
      return res.json({
        query: '',
        popular: true,
        products: rows.slice(0, 6).map((r) => serializeProductSummary(r, locale)),
        categories: [],
      });
    }

    const [byName, byDesc, cats] = await Promise.all([
      prisma.product.findMany({
        where: { published: true, OR: [{ name: { contains: q } }, { brand: { contains: q } }] },
        include: productInclude,
        orderBy: { name: 'asc' },
        take: 7,
      }),
      prisma.product.findMany({
        where: { published: true, shortDescription: { contains: q } },
        include: productInclude,
        orderBy: { name: 'asc' },
        take: 7,
      }),
      prisma.category.findMany({ where: { name: { contains: q } }, take: 3 }),
    ]);
    const seen = new Set(byName.map((p) => p.id));
    const products = [...byName, ...byDesc.filter((p) => !seen.has(p.id))].slice(0, 7);

    res.json({
      query: q,
      popular: false,
      products: products.map((r) => serializeProductSummary(r, locale)),
      categories: cats.map((c) => {
        const i18n = c.i18n as Record<string, { nl?: string; en?: string }> | null;
        return {
          slug: c.slug,
          name: locale !== 'fr' && i18n?.name?.[locale] ? i18n.name[locale]! : c.name,
        };
      }),
    });
  }),
);

catalogRouter.get(
  '/products/:slug',
  h(async (req, res) => {
    const p = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: productInclude,
    });
    if (!p || !p.published) throw notFound('Produit introuvable');
    const locale = qLocale(req);
    const ratings = await ratingsFor([p.id]);
    const detail = serializeProductDetail(p, locale, ratings.get(p.id) ?? { avg: 0, count: 0 });

    const period =
      req.query.start && req.query.end
        ? { start: new Date(String(req.query.start)), end: new Date(String(req.query.end)) }
        : null;
    const [withAvail] = await withAvailability([detail], period);

    res.json({
      product: withAvail,
      similar: await similarProducts(p.id, p.categoryId, locale),
    });
  }),
);

catalogRouter.get(
  '/compare',
  h(async (req, res) => {
    const slugs = String(req.query.slugs ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
    const rows = await prisma.product.findMany({
      where: { slug: { in: slugs }, published: true },
      include: productInclude,
    });
    res.json({ products: rows.map((r) => serializeProductDetail(r)) });
  }),
);
