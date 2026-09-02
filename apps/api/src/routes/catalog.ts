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
