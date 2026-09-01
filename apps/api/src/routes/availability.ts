import { Router } from 'express';
import { availabilityCheckSchema } from '@bricoloc/shared';
import { prisma } from '../db.js';
import { h } from '../lib/http.js';
import { checkMany } from '../lib/availability.js';
import { productInclude, serializeProductSummary } from '../lib/serialize.js';

export const availabilityRouter = Router();

availabilityRouter.post(
  '/check',
  h(async (req, res) => {
    const data = availabilityCheckSchema.parse(req.body);
    const start = new Date(data.period.start);
    const end = new Date(data.period.end);
    const { ok, results } = await checkMany(start, end, data.items);

    // Enrichit avec le nom + les alternatives serialisees.
    const productIds = new Set<string>();
    results.forEach((r) => {
      productIds.add(r.productId);
      r.alternativeProductIds.forEach((id) => productIds.add(id));
    });
    const products = await prisma.product.findMany({
      where: { id: { in: [...productIds] } },
      include: productInclude,
    });
    const map = new Map(products.map((p) => [p.id, serializeProductSummary(p)]));

    res.json({
      ok,
      period: { start: start.toISOString(), end: end.toISOString() },
      results: results.map((r) => ({
        ...r,
        product: map.get(r.productId) ?? null,
        alternatives: r.alternativeProductIds.map((id) => map.get(id)).filter(Boolean),
      })),
    });
  }),
);
