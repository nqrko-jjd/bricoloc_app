import { Router } from 'express';
import { catalogQuerySchema } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { h, notFound } from '../lib/http.js';
import {
  productInclude,
  serializeProductDetail,
  serializeProductSummary,
  similarProducts,
  withAvailability,
} from '../lib/serialize.js';

export const catalogRouter = Router();

catalogRouter.get(
  '/categories',
  h(async (_req, res) => {
    const cats = await prisma.category.findMany({ orderBy: { position: 'asc' } });
    const counts = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { published: true },
      _count: true,
    });
    res.json({
      categories: cats.map((c) => ({
        ...c,
        productCount: counts.find((x) => x.categoryId === c.id)?._count ?? 0,
      })),
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

    let items = rows.map(serializeProductSummary);
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
    const detail = serializeProductDetail(p);

    const period =
      req.query.start && req.query.end
        ? { start: new Date(String(req.query.start)), end: new Date(String(req.query.end)) }
        : null;
    const [withAvail] = await withAvailability([detail], period);

    res.json({
      product: withAvail,
      similar: await similarProducts(p.id, p.categoryId),
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
    res.json({ products: rows.map(serializeProductDetail) });
  }),
);
